import pickBy from 'lodash/pickBy';
import INIT_EVENT from './init-event';
import streamPromise from './stream-promise';

export default (storage, aggregate, name, projection, snapshotEvery) => {
  const INITIAL_SNAPSHOT = { sequence: 0, state: projection(undefined, INIT_EVENT) };

  const getStoredSnapshot = async (id) => {
    if (!snapshotEvery) return INITIAL_SNAPSHOT;
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

  const getReplayer = () => {
    if (!snapshotEvery) {
      return {
        handleEvent: () => null,
        finalize: () => Promise.resolve(),
      };
    }

    const snapshots = {};

    const handleEvent = (event) => {
      if (event.aggregate === aggregate) {
        const snapshot = snapshots[event.id] || INITIAL_SNAPSHOT;
        snapshots[event.id] = {
          state: projection(snapshot.state, event),
          sequence: event.sequence,
        };
      }
    };

    const finalize = async () => {
      const toSave = pickBy(snapshots, snapshot => snapshot.sequence >= snapshotEvery);
      const promises = Object.keys(toSave)
        .map(id => storage.storeSnapshot(aggregate, id, name, toSave[id]));
      await Promise.all(promises);
    };

    return { handleEvent, finalize };
  };

  return {
    getState, getSnapshot, storeSnapshot, getReplayer,
  };
};
