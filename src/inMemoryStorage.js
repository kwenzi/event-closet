import Stream from 'stream';

export default (events = []) => {
  const projections = {};

  const storeEvent = async (e) => {
    events.push(e);
  };

  const getEvents = async (aggregate, id) =>
    events.filter(e => e.aggregate === aggregate && e.id === id);

  const getAllEvents = () => {
    const readable = new Stream.Readable({ objectMode: true });
    events.forEach((e) => { readable.push(e); });
    readable.push(null);
    return readable;
  };

  const storeProjection = async (name, state) => {
    projections[name] = state;
  };

  const getProjection = async name => projections[name];

  return {
    storeEvent, getEvents, getAllEvents, storeProjection, getProjection,
  };
};
