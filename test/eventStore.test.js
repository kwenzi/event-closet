import EventStore from '../src';

const decisionProjectionReducer = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};

const nbUsersReducer = (state = 0, event) => {
  if (event.type === 'created') {
    return state + 1;
  }
  return state;
};

const createUser = (decisionProjection, name) => {
  if (decisionProjection.created) {
    throw new Error('user already created');
  }
  return { type: 'created', name };
};

const createdEvent = {
  aggregate: 'user', id: 'user123', type: 'created', name: 'John Doe',
};

test('full example', async () => {
  const store = EventStore();

  store.registerAggregate('user', decisionProjectionReducer);

  store.registerProjection('nb-users', ['user'], nbUsersReducer);

  await store.handleCommand(
    'user',
    'user123',
    decisionProjection => createUser(decisionProjection, 'John Doe'),
  );

  const nbUsers = await store.getProjection('nb-users');
  expect(nbUsers).toBe(1);

  await expect(store.handleCommand(
    'user',
    'user123',
    decisionProjection => createUser(decisionProjection, 'John Doe'),
  )).rejects.toEqual(new Error('user already created'));
});

test('store and get event', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjectionReducer);
  await store.addEvent(createdEvent);
  const events = await store.getEvents('user', 'user123');
  expect(events.length).toBe(1);
  expect(events[0]).toEqual(createdEvent);
});

test('register an aggregate then call handleCommand to store an event', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjectionReducer);
  await store.handleCommand(
    'user',
    'user123',
    decisionProjection => createUser(decisionProjection, 'John Doe'),
  );
  const events = await store.getEvents('user', 'user123');
  expect(events.length).toBe(1);
  expect(events[0]).toEqual(createdEvent);
});

test('register a projection, add events, then call getProjection to get the resulting state', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjectionReducer);
  store.registerProjection('nb-users', ['user'], nbUsersReducer);
  expect(await store.getProjection('nb-users')).toBe(0);
  await store.addEvent(createdEvent);
  expect(await store.getProjection('nb-users')).toBe(1);
});

test('register a listener, when an event is added the listener is called', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjectionReducer);
  const listener = jest.fn();
  store.onEvent(listener);
  await store.addEvent(createdEvent);

  expect(listener.mock.calls).toHaveLength(1);
  expect(listener.mock.calls[0][0]).toEqual(createdEvent);
});
