import { EventEmitter } from 'events';
import inMemory from './inMemoryStorage';
import Aggregate from './aggregate';
import Projection from './projection';

export default (options = {}) => {
  const opts = {
    storage: inMemory(),
    ...options,
  };
  const { storage } = opts;
  const bus = new EventEmitter();

  const aggregates = {};
  const readProjections = {};

  const addEvent = async (event) => {
    await aggregates[event.aggregate].addEvent(event);
  };

  const getEvents = async (aggregate, id) => storage.getEvents(aggregate, id);

  const onEvent = (callback) => {
    bus.on('event', callback);
  };

  const registerAggregate = (name, decisionProjectionReducer) => {
    aggregates[name] = Aggregate(storage, bus, name, decisionProjectionReducer);
  };

  const registerProjection = (name, onAggregates, reducer) => {
    readProjections[name] = Projection(storage, bus, name, onAggregates, reducer);
  };

  const handleCommand = async (aggregate, id, commandHandler) => {
    await aggregates[aggregate].handleCommand(id, commandHandler);
  };

  const getProjection = async name => readProjections[name].getState();

  const rebuildProjections = async () => {
    const projections = Object.keys(readProjections);
    await Promise.all(projections.map(projection => projection.initialize()));
    const events = storage.getAllEvents();
    events.forEach((event) => { bus.emit('event-replay', event); });
  };

  return {
    addEvent,
    getEvents,
    onEvent,
    registerAggregate,
    handleCommand,
    registerProjection,
    getProjection,
    rebuildProjections,
  };
};

export const inMemoryStorage = inMemory;
