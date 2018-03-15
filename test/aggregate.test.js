import { EventEmitter } from 'events';
import Aggregate from '../src/aggregate';
import { inMemoryStorage } from '../src';

const decisionProjection = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};

const createUser = (projection, { name }) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  return { type: 'created', name };
};

const validateUser = () => ({ type: 'validated' });

const createValidatedUser = (projection, { name }) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  return [{ type: 'created', name }, { type: 'validated' }];
};

const createdEvent = {
  aggregate: 'user', id: 'user123', type: 'created', name: 'John Doe',
};

const validatedEvent = {
  aggregate: 'user', id: 'user123', type: 'validated',
};

test('command handler can return an array of events', async () => {
  const bus = new EventEmitter();
  const listenerMock = jest.fn();
  bus.on('event', listenerMock);
  const aggregate = Aggregate(inMemoryStorage(), bus, 'user', decisionProjection);
  aggregate.registerCommand('create-validated', createValidatedUser);

  await aggregate.handleCommand('user123', 'create-validated', { name: 'John Doe' });

  expect(listenerMock).toHaveBeenCalledTimes(2);
  expect(listenerMock.mock.calls[0][0]).toMatchObject(createdEvent);
  expect(listenerMock.mock.calls[1][0]).toMatchObject(validatedEvent);
});

test('use snapshots in storage', async () => {
  const storage = inMemoryStorage();
  storage.getSnapshot = jest.fn().mockReturnValue({ sequence: 2, state: { created: true } });
  const aggregate = Aggregate(storage, new EventEmitter(), 'user', decisionProjection, { snapshotEvery: 2 });
  aggregate.registerCommand('create-validated', createValidatedUser);

  await expect(aggregate.handleCommand('user123', 'create-validated', { name: 'John Doe' }))
    .rejects.toEqual(new Error('user already created'));

  expect(storage.getSnapshot).toHaveBeenCalledWith('user', 'user123', '__decision__');
});

test('save snapshot every 2 event', async () => {
  const storage = inMemoryStorage();
  storage.storeSnapshot = jest.fn().mockReturnValue(Promise.resolve());
  const aggregate = Aggregate(storage, new EventEmitter(), 'user', decisionProjection, { snapshotEvery: 2 });
  aggregate.registerCommand('create', createUser);
  aggregate.registerCommand('validate', validateUser);

  await aggregate.handleCommand('user123', 'create', { name: 'John Doe' });
  expect(storage.storeSnapshot).not.toHaveBeenCalled();

  await aggregate.handleCommand('user123', 'validate');
  await new Promise(setImmediate); // storeSnapshot wont be called immediately
  expect(storage.storeSnapshot).toHaveBeenCalledWith('user', 'user123', '__decision__', { sequence: 2, state: { created: true } });
});
