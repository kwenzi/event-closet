import { MongoClient } from 'mongodb';
import getOptions from './get-options';

export default (options = {}) => {
  const opts = getOptions(options, {
    eventsCollection: 'events',
    projectionsCollection: 'projections',
    snapshotsCollection: 'snapshots',
    url: '',
    connectOptions: {},
    db: null,
  });
  const {
    eventsCollection, projectionsCollection, snapshotsCollection, url, connectOptions,
  } = opts;
  let { db } = opts;

  const connect = async () => {
    db = await MongoClient.connect(url, connectOptions);
  };

  const close = async () => {
    await db.close();
  };

  const storeEvent = async (event) => {
    await db.collection(eventsCollection).insertOne(event);
  };

  const getEvents = (aggregate, id, fromSequence = -1) =>
    db.collection(eventsCollection)
      .find({ aggregate, id, sequence: { $gt: fromSequence } })
      .sort({ sequence: 1 })
      .stream();

  const getAllEvents = () =>
    db.collection(eventsCollection)
      .find({})
      .sort({ insertDate: 1, sequence: 1 })
      .stream();

  const storeProjection = async (name, state) => {
    await db.collection(projectionsCollection)
      .replaceOne({ name }, { name, state }, { upsert: true });
  };

  const getProjection = async (name) => {
    const res = await db.collection(projectionsCollection).findOne({ name });
    return (res ? res.state : null);
  };

  const storeSnapshot = async (aggregate, id, projection, snapshot) => {
    await db.collection(snapshotsCollection)
      .replaceOne(
        { aggregate, id, projection },
        {
          aggregate, id, projection, snapshot,
        },
        { upsert: true },
      );
  };

  const getSnapshot = async (aggregate, id, projection) => {
    const res = await db.collection(projectionsCollection).findOne({ aggregate, id, projection });
    return (res ? res.snapshot : undefined);
  };

  return {
    connect,
    close,
    storeEvent,
    getEvents,
    getAllEvents,
    storeProjection,
    getProjection,
    storeSnapshot,
    getSnapshot,
  };
};
