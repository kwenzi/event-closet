import Queue from 'promise-queue';
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

  const handleEvent = async (event) => {
    if (aggregates.includes(event.aggregate)) {
      const state = await getState();
      const newState = projection(state, event);
      await storeState(newState);
      params.onChange(newState, event);
    }
  };

  const getReplayer = () => {
    let state = initialState();

    const handleEvent2 = (event) => {
      if (aggregates.includes(event.aggregate)) {
        state = projection(state, event);
      }
    };

    const finalize = async () => {
      await storeState(state);
    };

    return { handleEvent: handleEvent2, finalize };
  };

  const putInQueue = f => (...args) => queue.add(() => f(...args));

  bus.on('event', putInQueue(event => handleEvent(event)));

  return {
    getState: putInQueue(getState),
    getReplayer,
  };
};
