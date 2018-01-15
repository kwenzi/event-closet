import Stream from 'stream';

const arrayToStream = (arr) => {
  const stream = new Stream.Readable({ objectMode: true });
  arr.forEach((e) => { stream.push(e); });
  stream.push(null);
  return stream;
};

export default (events = []) => {
  const projections = {};

  const init = async () => {};

  const storeEvent = async (e) => {
    events.push(e);
  };

  const getEvents = (aggregate, id) =>
    arrayToStream(events.filter(e => e.aggregate === aggregate && e.id === id));

  const getAllEvents = () => arrayToStream(events);

  const storeProjection = async (name, state) => {
    projections[name] = state;
  };

  const getProjection = async name => (projections[name] === undefined ? null : projections[name]);

  return {
    init, storeEvent, getEvents, getAllEvents, storeProjection, getProjection,
  };
};
