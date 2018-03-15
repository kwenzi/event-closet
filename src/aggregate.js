import Queue from 'promise-queue';
import EntityProjection from './entity-projection';

const DECISION_PROJECTION_NAME = '__decision__';

export default (storage, bus, aggregate, decisionProjection, snapshotEvery) => {
  const queues = {};
  const projections = {};
  const commands = {};

  const registerReadProjection = (name, projection, options = {}) => {
    const settings = {
      snapshotEvery,
      ...options,
    };
    const snapshotsActivated = !!settings.snapshotEvery;
    projections[name] = EntityProjection(
      storage, aggregate, name,
      projection, snapshotsActivated,
    );
    if (snapshotsActivated) {
      bus.on('event', async (event) => {
        try {
          if (event.sequence % snapshotEvery === 0) {
            await projections[name].storeSnapshot(event.id);
          }
        } catch (err) {
          // TODO log?
        }
      });
    }
  };

  const registerCommand = (name, command) => {
    commands[name] = command;
  };

  const addEvent = async (event) => {
    await storage.storeEvent(event);
    bus.emit('event', event);
  };

  const handleCommand = async (id, command, data) => {
    const decisionSnapshot = await projections[DECISION_PROJECTION_NAME].getSnapshot(id);
    const res = commands[command](decisionSnapshot.state, data);
    const newEvents = (Array.isArray(res) ? res : [res])
      .map((e, index) => ({
        ...e,
        aggregate,
        id,
        insertDate: new Date().toISOString(),
        sequence: decisionSnapshot.sequence + index + 1,
      }));
    await newEvents
      .map(newEvent => () => addEvent(newEvent))
      .reduce((chain, cur) => chain.then(cur), Promise.resolve());
    return Array.isArray(res) ? newEvents : newEvents[0];
  };

  const getProjection = async (id, name) => projections[name].getState(id);

  const putInQueue = (id, f) => {
    if (!queues[id]) {
      queues[id] = new Queue(1);
    }
    return queues[id].add(f);
  };

  registerReadProjection(DECISION_PROJECTION_NAME, decisionProjection);

  return {
    registerReadProjection,
    registerCommand,
    handleCommand: (id, command, data) =>
      putInQueue(id, () => handleCommand(id, command, data)),
    getProjection: (id, name) =>
      putInQueue(id, () => getProjection(id, name)),
  };
};
