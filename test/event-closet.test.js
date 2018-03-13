import EventCloset, { inMemoryStorage } from '../src';

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

const createUser = (projection, { name }) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  return { type: 'created', name };
};

const createdEvent = {
  aggregate: 'user', id: 'user123', type: 'created', name: 'John Doe',
};

test('usage example', async () => {
  const closet = EventCloset();

  closet.registerAggregate('user', decisionProjection);

  closet.registerEntityProjection('user', 'identity', identityProjection);

  closet.registerCommand('user', 'create', createUser);

  closet.registerProjection('nb-users', ['user'], nbUsersProjection);

  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  const nbUsers = await closet.getProjection('nb-users');
  expect(nbUsers).toBe(1);

  const identity = await closet.getEntityProjection('user', 'user123', 'identity');
  expect(identity).toEqual({ name: 'John Doe' });
});

test('handleCommand returns the created event', async () => {
  const closet = EventCloset();
  closet.registerAggregate('user', decisionProjection);
  closet.registerCommand('user', 'create', createUser);

  const event = await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  expect(event).toMatchObject(createdEvent);
});

test('handleCommand rejects when an error happens in decision projection', async () => {
  const closet = EventCloset();
  closet.registerAggregate('user', decisionProjection);
  closet.registerCommand('user', 'create', createUser);
  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  await expect(closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' }))
    .rejects.toEqual(new Error('user already created'));
});

test('register a projection, add events, then call getProjection to get the resulting state', async () => {
  const closet = EventCloset();
  closet.registerAggregate('user', decisionProjection);
  closet.registerProjection('nb-users', ['user'], nbUsersProjection);
  closet.registerCommand('user', 'create', createUser);
  expect(await closet.getProjection('nb-users')).toBe(0);

  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  expect(await closet.getProjection('nb-users')).toBe(1);
});

test('register a listener, when an event is added the listener is called', async () => {
  const closet = EventCloset();
  closet.registerAggregate('user', decisionProjection);
  closet.registerCommand('user', 'create', createUser);
  const listener = jest.fn();
  closet.onEvent(listener);

  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0]).toMatchObject(createdEvent);
});

test('rebuild projections from an existing event history', async () => {
  const closet = EventCloset({
    storage: inMemoryStorage([
      { ...createdEvent, sequence: 0, insertDate: new Date().toISOString() },
    ]),
  });
  closet.registerAggregate('user', decisionProjection);
  closet.registerProjection('nb-users', ['user'], nbUsersProjection);
  await closet.rebuildProjections();
  expect(await closet.getProjection('nb-users')).toBe(1);
});
