import { MongoClient } from 'mongodb';

export default (url, mongoOptions = {}, options = {}) => {
  let db;
  const { eventsCollection, projectionsCollection } = {
    eventsCollection: 'events',
    projectionsCollection: 'projections',
    ...options,
  };

  const init = async () => {
    db = await MongoClient.connect(url, mongoOptions);
  };

  const storeEvent = async (event) => {
    await db.collection(eventsCollection).insertOne(event);
  };

  const getEvents = (aggregate, id) =>
    db.collection(eventsCollection)
      .find({ aggregate, id })
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

  return {
    init, storeEvent, getEvents, getAllEvents, storeProjection, getProjection,
  };
};
