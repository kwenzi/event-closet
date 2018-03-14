import Queue from 'promise-queue';
import initEvent from './init-event';
import streamPromise from './stream-promise';

export default (storage, bus, aggregate, decisionProjection, snapshotEvery) => {
  const queues = {};
  const readProjections = {};
  const commands = {};

  const registerReadProjection = (name, projection) => {
    readProjections[name] = projection;
  };

  const registerCommand = (name, command) => {
    commands[name] = command;
  };

  const addEvent = async (event) => {
    await storage.storeEvent(event);
    bus.emit('event', event);
  };

  const getDecisionProjection = async (id) => {
    let projection;
    let stream;
    if (snapshotEvery) {
      const snapshot = await storage.getSnapshot(aggregate, id, '__decision__');
      if (snapshot) {
        projection = snapshot.state;
        stream = storage.getEvents(aggregate, id, snapshot.sequence);
      } else {
        projection = decisionProjection(undefined, initEvent);
        stream = storage.getEvents(aggregate, id);
      }
    } else {
      projection = decisionProjection(undefined, initEvent);
      stream = storage.getEvents(aggregate, id);
    }
    let sequenceMax = 0;
    await streamPromise(stream, (event) => {
      projection = decisionProjection(projection, event);
      sequenceMax = event.sequence;
    });
    return { projection, sequenceMax };
  };

  const handleCommand = async (id, command, data) => {
    const { projection, sequenceMax } = await getDecisionProjection(id);
    const res = commands[command](projection, data);
    const newEvents = (Array.isArray(res) ? res : [res])
      .map((e, index) => ({
        ...e,
        aggregate,
        id,
        insertDate: new Date().toISOString(),
        sequence: sequenceMax + index + 1,
      }));
    let newProj = projection;
    await newEvents
      .map((e) => {
        newProj = decisionProjection(newProj, e);
        if (snapshotEvery && e.sequence % snapshotEvery === 0) {
          return () => storage.storeSnapshot(aggregate, e.id, '__decision__', { sequence: e.sequence, state: newProj });
        }
        return () => Promise.resolve();
      })
      .reduce((chain, cur) => chain.then(cur), Promise.resolve());
    await newEvents
      .map(newEvent => () => addEvent(newEvent))
      .reduce((chain, cur) => chain.then(cur), Promise.resolve());
    return Array.isArray(res) ? newEvents : newEvents[0];
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
    registerCommand,
    handleCommand: (id, command, data) =>
      putInQueue(id, () => handleCommand(id, command, data)),
    getProjection: (id, name) =>
      putInQueue(id, () => getProjection(id, name)),
  };
};
