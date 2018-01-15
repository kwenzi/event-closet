import Aggregate from '../src/aggregate';
import { inMemoryStorage } from '../src';
import { EventEmitter } from 'events';

const decisionProjectionReducer = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};

const createValidatedUser = (decisionProjection, name) => {
  if (decisionProjection.created) {
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
  const aggregate = Aggregate(inMemoryStorage(), bus, 'user', decisionProjectionReducer);

  await aggregate.handleCommand('user123', decisionProjection => createValidatedUser(decisionProjection, 'John Doe'));

  expect(listenerMock.mock.calls).toEqual([
    [createdEvent],
    [validatedEvent],
  ]);
});

