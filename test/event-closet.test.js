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
  if (event.type === 'changed-name') {
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

const createdEvent = name => ({
  aggregate: 'user', id: 'user123', type: 'created', name,
});

const userChangeName = (projection, { name }) => {
  if (!projection.created) {
    throw new Error('user doesnt exist');
  }
  return { type: 'changed-name', name };
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

  expect(event).toMatchObject(createdEvent('John Doe'));
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
  expect(listener.mock.calls[0][0]).toMatchObject(createdEvent('John Doe'));
});

test('rebuild projections and snapshots from an existing event history', async () => {
  const storage = inMemoryStorage([
    { ...createdEvent('John Doe'), sequence: 1, insertDate: new Date().toISOString() },
  ]);
  const closet = EventCloset({ storage, snapshotEvery: 1 });
  closet.registerAggregate('user', decisionProjection);
  closet.registerProjection('nb-users', ['user'], nbUsersProjection);
  closet.registerEntityProjection('user', 'identity', identityProjection);
  closet.registerEntityProjection('user', 'identity2', identityProjection, { snapshotEvery: 10 });
  closet.registerEntityProjection('user', 'identity3', identityProjection, { snapshotEvery: null });

  await closet.rebuild();

  expect(await closet.getProjection('nb-users')).toBe(1);
  expect(await closet.getEntityProjection('user', 'user123', 'identity')).toEqual({ name: 'John Doe' });
  expect(await storage.getSnapshot('user', 'user123', '__decision__')).toEqual({ sequence: 1, state: { created: true } });
  expect(await storage.getSnapshot('user', 'user123', 'identity')).toEqual({ sequence: 1, state: { name: 'John Doe' } });
  expect(await storage.getSnapshot('user', 'user123', 'identity2')).toBeUndefined();
  expect(await storage.getSnapshot('user', 'user123', 'identity3')).toBeUndefined();
});

test('works with snapshots activated', async () => {
  const storage = inMemoryStorage();
  const closet = EventCloset({ storage, snapshotEvery: 2 });
  closet.registerAggregate('user', decisionProjection);
  closet.registerCommand('user', 'create', createUser);
  closet.registerCommand('user', 'rename', userChangeName);
  closet.registerEntityProjection('user', 'identity', identityProjection);

  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });
  await closet.handleCommand('user', 'user123', 'rename', { name: 'Jane Doe' });
  await closet.handleCommand('user', 'user123', 'rename', { name: 'Calamity Jane' });

  await new Promise(setImmediate); // wait for snapshots creation
  expect(await closet.getEntityProjection('user', 'user123', 'identity')).toEqual({ name: 'Calamity Jane' });
  expect(await storage.getSnapshot('user', 'user123', '__decision__')).toEqual({ sequence: 2, state: { created: true } });
  expect(await storage.getSnapshot('user', 'user123', 'identity')).toEqual({ sequence: 2, state: { name: 'Jane Doe' } });
});

test('snapshotEvery option in registerAggregate overrides the global option', async () => {
  const storage = inMemoryStorage();
  const closet = EventCloset({ storage });
  closet.registerAggregate('user', decisionProjection, { snapshotEvery: 1 });
  closet.registerCommand('user', 'create', createUser);

  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  await new Promise(setImmediate); // wait for snapshots creation
  expect(await storage.getSnapshot('user', 'user123', '__decision__')).toEqual({ sequence: 1, state: { created: true } });
});

test('snapshotEvery option in registerEntityProjection overrides the global option', async () => {
  const storage = inMemoryStorage();
  const closet = EventCloset({ storage });
  closet.registerAggregate('user', decisionProjection);
  closet.registerEntityProjection('user', 'identity', identityProjection, { snapshotEvery: 1 });
  closet.registerCommand('user', 'create', createUser);

  await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

  await new Promise(setImmediate); // wait for snapshots creation
  expect(await storage.getSnapshot('user', 'user123', 'identity')).toEqual({ sequence: 1, state: { name: 'John Doe' } });
});
