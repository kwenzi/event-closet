import Stream from 'stream';

const arrayToStream = (arr) => {
  const stream = new Stream.Readable({ objectMode: true });
  arr.forEach((e) => { stream.push(e); });
  stream.push(null);
  return stream;
};

export default (events = []) => {
  const projections = {};
  let snapshots = [];

  const storeEvent = async (e) => {
    events.push(e);
  };

  const getEvents = (aggregate, id, fromSequence = -1) => {
    const filter = e => e.aggregate === aggregate && e.id === id && e.sequence > fromSequence;
    return arrayToStream(events.filter(filter));
  };

  const getAllEvents = () => arrayToStream(events);

  const storeProjection = async (name, state) => {
    projections[name] = state;
  };

  const getProjection = async name => (projections[name] === undefined ? null : projections[name]);

  const storeSnapshot = async (aggregate, id, projection, snapshot) => {
    snapshots = snapshots
      .filter(s => !(s.aggregate === aggregate && s.id === id && s.projection === projection))
      .concat({
        aggregate, id, projection, snapshot,
      });
  };

  const getSnapshot = async (aggregate, id, projection) => {
    const res = snapshots
      .find(s => s.aggregate === aggregate && s.id === id && s.projection === projection);
    return res ? res.snapshot : undefined;
  };

  return {
    storeEvent, getEvents, getAllEvents, storeProjection, getProjection, storeSnapshot, getSnapshot,
  };
};
