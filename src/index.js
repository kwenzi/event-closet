import { EventEmitter } from 'events';
import inMemory from './in-memory-storage';
import mongo from './mongo-storage';
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
  const projections = {};

  const onEvent = (callback) => {
    bus.on('event', callback);
  };

  const registerAggregate = (name, decisionProjection) => {
    aggregates[name] = Aggregate(storage, bus, name, decisionProjection);
  };

  const registerEntityProjection = (aggregate, name, projection) => {
    aggregates[aggregate].registerReadProjection(name, projection);
  };

  const registerProjection = (name, onAggregates, projection) => {
    projections[name] = Projection(storage, bus, name, onAggregates, projection);
  };

  const handleCommand = async (aggregate, id, commandHandler) =>
    aggregates[aggregate].handleCommand(id, commandHandler);

  const getEntityProjection = async (aggregate, id, projection) =>
    aggregates[aggregate].getProjection(id, projection);

  const getProjection = async name => projections[name].getState();

  const rebuildProjections = async () => {
    await Promise.all(Object.values(projections)
      .map(projection => projection.initialize()));
    await streamPromise(getAllEvents(storage), (event) => {
      bus.emit('event-replay', event);
    });
  };

  return {
    onEvent,
    registerAggregate,
    registerEntityProjection,
    handleCommand,
    getEntityProjection,
    registerProjection,
    getProjection,
    rebuildProjections,
  };
};

export const inMemoryStorage = inMemory;
export const mongoStorage = mongo;
