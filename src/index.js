import { EventEmitter } from 'events';
import inMemory from './in-memory-storage';
import mongo from './mongo-storage';
import Aggregate from './aggregate';
import Projection from './projection';
import streamPromise from './stream-promise';

export default (options = {}) => {
  const { storage, snapshotEvery } = {
    storage: inMemory(),
    snapshotEvery: null,
    ...options,
  };
  const bus = new EventEmitter();
  const aggregates = {};
  const projections = {};

  const onEvent = (callback) => {
    bus.on('event', callback);
  };

  const registerAggregate = (name, decisionProjection) => {
    aggregates[name] = Aggregate(storage, bus, name, decisionProjection, snapshotEvery);
  };

  const registerEntityProjection = (aggregate, name, projection) => {
    aggregates[aggregate].registerReadProjection(name, projection);
  };

  const registerCommand = (aggregate, name, command) => {
    aggregates[aggregate].registerCommand(name, command);
  };

  const registerProjection = (name, onAggregates, projection, opts) => {
    projections[name] = Projection(storage, bus, name, onAggregates, projection, opts);
  };

  const handleCommand = async (aggregate, id, command, data) =>
    aggregates[aggregate].handleCommand(id, command, data);

  const getEntityProjection = async (aggregate, id, projection) =>
    aggregates[aggregate].getProjection(id, projection);

  const getProjection = async name => projections[name].getState();

  const rebuildProjections = async () => {
    await Promise.all(Object.values(projections)
      .map(projection => projection.initialize()));
    await streamPromise(storage.getAllEvents(), (event) => {
      bus.emit('event-replay', event);
    });
  };

  return {
    onEvent,
    registerAggregate,
    registerEntityProjection,
    getEntityProjection,
    registerCommand,
    handleCommand,
    registerProjection,
    getProjection,
    rebuildProjections,
  };
};

export const inMemoryStorage = inMemory;
export const mongoStorage = mongo;
