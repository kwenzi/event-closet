import Queue from 'promise-queue';
import dummyEvent from './dummyEvent';

module.exports = (storage, bus, aggregate, decisionProjectionReducer) => {
  const queues = {};

  const addEvent = async (event) => {
    await storage.storeEvent(event);
    bus.emit('event', event);
  };

  const handleCommand = async (id, commandHandler) => {
    const events = await storage.getEvents(aggregate, id);
    const initialValue = decisionProjectionReducer(undefined, dummyEvent);
    const decisionProjection = events.reduce(decisionProjectionReducer, initialValue);
    const newEvent = commandHandler(decisionProjection);
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
