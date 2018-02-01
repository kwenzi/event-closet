import Queue from 'promise-queue';
import through from 'through';
import initEvent from './init-event';
import streamPromise from './stream-promise';

export default (storage, bus, aggregate, decisionProjection) => {
  const queues = {};
  const readProjections = {};

  const registerReadProjection = (name, projection) => {
    readProjections[name] = projection;
  };

  const addEvent = async (event, sequence) => {
    await storage.storeEvent({
      ...event,
      sequence,
      insertDate: new Date(),
    });
    bus.emit('event', event);
  };

  const getDecisionProjection = async (id) => {
    let projection = decisionProjection(undefined, initEvent);
    let sequenceMax = -1;
    const stream = storage.getEvents(aggregate, id);
    await streamPromise(stream, (event) => {
      projection = decisionProjection(projection, event);
      sequenceMax = event.sequence;
    });
    return { projection, sequenceMax };
  };

  const handleCommand = async (id, commandHandler) => {
    const { projection, sequenceMax } = await getDecisionProjection(id);
    const res = commandHandler(projection);
    const newEvents = Array.isArray(res) ? res : [res];
    const completeEvent = e => ({ ...e, aggregate, id });
    await newEvents
      .map(completeEvent)
      .map((newEvent, index) => () => addEvent(newEvent, sequenceMax + index + 1))
      .reduce((chain, cur) => chain.then(cur), Promise.resolve());
    return Array.isArray(res) ? res.map(completeEvent) : completeEvent(res);
  };

  const getProjection = async (id, name) => {
    const projection = readProjections[name];
    let state = projection(undefined, initEvent);
    const stream = storage.getEvents(aggregate, id);
    await streamPromise(stream, (event) => {
      state = projection(state, event);
    });
    return state;
  };

  const putInQueue = (id, f) => {
    if (!queues[id]) {
      queues[id] = new Queue(1);
    }
    return queues[id].add(f);
  };

  return {
    registerReadProjection,
    handleCommand: (id, commandHandler) =>
      putInQueue(id, () => handleCommand(id, commandHandler)),
    getProjection: (id, name) =>
      putInQueue(id, () => getProjection(id, name)),
  };
};

export const getAllEvents = storage =>
  storage.getAllEvents()
    .pipe(through(function write(event) {
      const { sequence, insertDate, ...rest } = event;
      this.queue(rest);
    }));
