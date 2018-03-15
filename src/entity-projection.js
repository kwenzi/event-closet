import INIT_EVENT from './init-event';
import streamPromise from './stream-promise';

export default (storage, aggregate, name, projection, snapshotStoringActivated) => {
  const INITIAL_SNAPSHOT = { sequence: 0, state: projection(undefined, INIT_EVENT) };

  const getStoredSnapshot = async (id) => {
    if (!snapshotStoringActivated) return INITIAL_SNAPSHOT;
    const snapshot = await storage.getSnapshot(aggregate, id, name);
    if (!snapshot) return INITIAL_SNAPSHOT;
    return snapshot;
  };

  const getSnapshot = async (id) => {
    let { state, sequence } = await getStoredSnapshot(id);
    const events = storage.getEvents(aggregate, id, sequence);
    await streamPromise(events, (event) => {
      state = projection(state, event);
      ({ sequence } = event);
    });
    return { state, sequence };
  };

  const getState = async id => (await getSnapshot(id)).state;

  const storeSnapshot = async (id) => {
    const snapshot = await getSnapshot(id);
    await storage.storeSnapshot(aggregate, id, name, snapshot);
  };

  return { getState, getSnapshot, storeSnapshot };
};
