import { EventEmitter } from 'events';
import Aggregate from '../src/aggregate';
import { inMemoryStorage } from '../src';

const decisionProjection = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};

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
