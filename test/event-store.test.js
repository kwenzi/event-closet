import EventStore, { inMemoryStorage } from '../src';

const decisionProjection = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};

const identityProjection = (state = {}, event) => {
  if (event.type === 'created') {
    return { name: event.name };
  }
  return state;
};

const nbUsersProjection = (state = 0, event) => {
  if (event.type === 'created') {
    return state + 1;
  }
  return state;
};

const createUser = (projection, name) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  return { type: 'created', name };
};

const createdEvent = {
  aggregate: 'user', id: 'user123', type: 'created', name: 'John Doe',
};

test('full example', async () => {
  const store = EventStore();

  store.registerAggregate('user', decisionProjection, {
    identity: identityProjection,
  });

  store.registerProjection('nb-users', ['user'], nbUsersProjection);

  await store.handleCommand('user', 'user123', projection => createUser(projection, 'John Doe'));

  const nbUsers = await store.getProjection('nb-users');
  expect(nbUsers).toBe(1);

  const identity = await store.getEntityProjection('user', 'user123', 'identity');
  expect(identity).toEqual({ name: 'John Doe' });
});

test('handleCommand returns the created event', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjection);

  const event = await store.handleCommand('user', 'user123', projection => createUser(projection, 'John Doe'));

  expect(event).toEqual(createdEvent);
});

test('handleCommand rejects when an error happens in decision projection', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjection);
  await store.handleCommand('user', 'user123', projection => createUser(projection, 'John Doe'));

  await expect(store.handleCommand('user', 'user123', projection => createUser(projection, 'John Doe')))
    .rejects.toEqual(new Error('user already created'));
});

test('register a projection, add events, then call getProjection to get the resulting state', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjection);
  store.registerProjection('nb-users', ['user'], nbUsersProjection);
  expect(await store.getProjection('nb-users')).toBe(0);

  await store.handleCommand('user', 'user123', projection => createUser(projection, 'John Doe'));

  expect(await store.getProjection('nb-users')).toBe(1);
});

test('register a listener, when an event is added the listener is called', async () => {
  const store = EventStore();
  store.registerAggregate('user', decisionProjection);
  const listener = jest.fn();
  store.onEvent(listener);

  await store.handleCommand('user', 'user123', projection => createUser(projection, 'John Doe'));

  expect(listener.mock.calls).toHaveLength(1);
  expect(listener.mock.calls[0][0]).toEqual(createdEvent);
});

test('rebuild projections from an existing event history', async () => {
  const store = EventStore({
    storage: inMemoryStorage([{ ...createdEvent, sequence: 0, insertDate: new Date() }]),
  });
  store.registerAggregate('user', decisionProjection);
  store.registerProjection('nb-users', ['user'], nbUsersProjection);
  await store.rebuildProjections();
  expect(await store.getProjection('nb-users')).toBe(1);
});
