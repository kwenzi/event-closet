import Queue from 'promise-queue';
import isEqual from 'lodash/isEqual';
import initEvent from './init-event';

export default (storage, bus, name, aggregates, projection, options = {}) => {
  const params = {
    onChange: () => null,
    ...options,
  };
  const queue = new Queue(1);

  const storeState = async (state) => {
    await storage.storeProjection(name, state);
  };

  const initialState = () => projection(undefined, initEvent);

  const getState = async () => {
    const state = await storage.getProjection(name);
    if (state === null) {
      return initialState();
    }
    return state;
  };

  const initialize = async () => {
    await storeState(initialState());
  };

  const handleEvent = async (event, isReplay) => {
    if (aggregates.includes(event.aggregate)) {
      const state = await getState();
      const newState = projection(state, event);
      if (!isEqual(state, newState)) {
        await storeState(newState);
        if (!isReplay) params.onChange(newState, event);
      }
    }
  };

  const putInQueue = f => (...args) => queue.add(() => f(...args));

  bus.on('event', putInQueue(event => handleEvent(event, false)));
  bus.on('event-replay', putInQueue(event => handleEvent(event, true)));

  return {
    initialize: putInQueue(initialize),
    getState: putInQueue(getState),
  };
};
