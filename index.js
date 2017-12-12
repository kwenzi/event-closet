const Queue = require('simple-promise-queue');

const collection = 'event';

const stripInternalFields = (event) => {
  const {
    _id, sequence, insert_date, ...rest
  } = event;
  return rest;
};

module.exports = (db, onEvent = () => null) => {
  const queue = new Queue({
    autoStart: true,
    concurrency: 1,
  });

  const addToQueue = execPromise => queue.pushTask((resolve, reject) => {
    execPromise().then(resolve).catch(reject);
  });

  const handleCommandImmediately = async (aggregate, id, handler) => {
    // get events from the database
    const events = await db.collection(collection)
      .find({ id, aggregate })
      .sort({ sequence: 1 })
      .toArray();
    // calculate current sequence number
    const maxSequence = events.length > 0 ? events[events.length - 1].sequence : -1;
    // send events to handler to get the new events
    const returnedEvents = handler(events.map(stripInternalFields));
    const newEvents = Array.isArray(returnedEvents) ? returnedEvents : [returnedEvents];
    // store the new events with sequence number and insert date
    await newEvents
      .map((e, index) => ({ ...e, sequence: maxSequence + index + 1, insert_date: new Date() }))
      .map(event => () => db.collection(collection)
        .insertOne(event)
        // for each insert, call the onEvent function
        .then(() => { onEvent(stripInternalFields(event)); }))
      .reduce((prev, cur) => prev.then(cur), Promise.resolve());
    // return the value returned by the handler
    return returnedEvents;
  };

  const handleCommand = (...args) => addToQueue(() => handleCommandImmediately(...args));

  const get = async (aggregate, id, projection = { _id: 0, sequence: 0, insert_date: 0 }) =>
    db.collection(collection)
      .find({ id, aggregate }, projection)
      .sort({ sequence: 1 })
      .toArray();

  const replayAll = async () =>
    new Promise((resolve, reject) =>
      db.collection(collection)
        .find({}, { _id: 0, sequence: 0, insert_date: 0 })
        .sort({ insert_date: 1, sequence: 1 })
        .forEach(onEvent, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }));

  return { handleCommand, get, replayAll };
};
