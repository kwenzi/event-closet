import Queue from 'promise-queue';
import isEqual from 'lodash/isEqual';
import initEvent from './init-event';

export default (storage, bus, name, aggregates, projection) => {
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

  const handleEvent = async (event) => {
    if (aggregates.includes(event.aggregate)) {
      const state = await getState();
      const newState = projection(state, event);
      if (!isEqual(state, newState)) {
        await storeState(newState);
      }
    }
  };

  const putInQueue = f => (...args) => queue.add(() => f(...args));

  bus.on('event', putInQueue(handleEvent));
  bus.on('event-replay', putInQueue(handleEvent));


  return {
    initialize: putInQueue(initialize),
    getState: putInQueue(getState),
  };
};
