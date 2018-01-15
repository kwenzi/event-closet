import { EventEmitter } from 'events';
import inMemory from './in-memory-storage';
import Aggregate, { getAllEvents } from './aggregate';
import Projection from './projection';
import streamPromise from './stream-promise';

export default (options = {}) => {
  const { storage } = {
    storage: inMemory(),
    ...options,
  };
  const bus = new EventEmitter();
  const aggregates = {};
  const readProjections = {};

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
    await Promise.all(Object.values(readProjections)
      .map(projection => projection.initialize()));
    await streamPromise(getAllEvents(storage), (event) => {
      bus.emit('event-replay', event);
    });
  };

  return {
    onEvent,
    registerAggregate,
    handleCommand,
    registerProjection,
    getProjection,
    rebuildProjections,
  };
};

export const inMemoryStorage = inMemory;
