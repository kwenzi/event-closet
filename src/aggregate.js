import Queue from 'promise-queue';
import dummyEvent from './dummyEvent';

module.exports = (storage, bus, aggregate, decisionProjectionReducer) => {
  const queues = {};

  const addEvent = async (event) => {
    await storage.storeEvent(event);
    bus.emit('event', event);
  };

  const getDecisionProjection = async (id) => {
    let projection = decisionProjectionReducer(undefined, dummyEvent);
    const stream = storage.getEvents(aggregate, id);
    await new Promise((resolve, reject) => {
      stream.on('data', (event) => { projection = decisionProjectionReducer(projection, event); });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    return projection;
  };

  const handleCommand = async (id, commandHandler) => {
    const projection = await getDecisionProjection(id);
    const newEvent = commandHandler(projection);
    await addEvent({
      ...newEvent,
      aggregate,
      id,
    });
  };

  const putInQueue = (id, f) => {
    if (!queues[id]) {
      queues[id] = new Queue(1);
    }
    return queues[id].add(f);
  };

  return {
    addEvent: event => putInQueue(event.id, () => addEvent(event)),
    handleCommand: (id, commandHandler) =>
      putInQueue(id, () => handleCommand(id, commandHandler)),
  };
};
