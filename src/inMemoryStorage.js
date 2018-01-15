export default () => {
  const events = [];
  const projections = {};

  const storeEvent = async (e) => {
    events.push(e);
  };

  const getEvents = async (aggregate, id) =>
    events.filter(e => e.aggregate === aggregate && e.id === id);

  const forEach = (callback) => {
    events.forEach(callback);
  };

  const storeProjection = async (name, state) => {
    projections[name] = state;
  };

  const getProjection = async name => projections[name];

  return {
    storeEvent, getEvents, forEach, storeProjection, getProjection,
  };
};
