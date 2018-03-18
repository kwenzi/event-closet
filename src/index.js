import { EventEmitter } from 'events';
import inMemory from './in-memory-storage';
import mongo from './mongo-storage';
import Aggregate from './aggregate';
import GlobalProjection from './global-projection';
import consumeStream from './consume-stream';
import getOptions from './get-options';

const NOOP_LOGGER = { info: () => null, error: () => null };

export default (options = {}) => {
  const { storage, snapshotEvery, logger } = getOptions(options, {
    storage: inMemory(),
    snapshotEvery: null,
    logger: NOOP_LOGGER,
  });
  const bus = new EventEmitter();
  bus.setMaxListeners(100);
  const aggregates = {};
  const projections = {};

  const onEvent = (callback) => {
    bus.on('event', callback);
  };

  const registerAggregate = (name, decisionProjection, aggregateOptions = {}) => {
    const aggregateOpts = getOptions(aggregateOptions, { snapshotEvery });
    aggregates[name] = Aggregate(
      storage, bus, name, decisionProjection,
      { snapshotEvery: aggregateOpts.snapshotEvery, logger },
    );
  };

  const registerEntityProjection = (aggregate, name, projection, projOptions = {}) => {
    aggregates[aggregate].registerReadProjection(name, projection, projOptions);
  };

  const registerCommand = (aggregate, name, command) => {
    aggregates[aggregate].registerCommand(name, command);
  };

  const registerProjection = (name, onAggregates, projection, projOptions = {}) => {
    projections[name] = GlobalProjection(storage, bus, name, onAggregates, projection, projOptions);
  };

  const handleCommand = async (aggregate, id, command, data) =>
    aggregates[aggregate].handleCommand(id, command, data);

  const getEntityProjection = async (aggregate, id, projection) =>
    aggregates[aggregate].getProjection(id, projection);

  const getProjection = async name => projections[name].getState();

  const rebuild = async () => {
    logger.info('beginning rebuild...');
    let cnt = 0;
    const replayers = Object.values(projections).map(p => p.getReplayer())
      .concat(...Object.values(aggregates).map(a => a.getReplayers()));
    await consumeStream(storage.getAllEvents(), (event) => {
      replayers.forEach(r => r.handleEvent(event));
      cnt += 1;
      if (cnt % 1000 === 0) {
        logger.info(`replayed ${cnt} events`);
      }
    });
    await Promise.all(replayers.map(r => r.finalize()));
    logger.info('rebuild complete');
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
    rebuild,
  };
};

export const inMemoryStorage = inMemory;
export const mongoStorage = mongo;
