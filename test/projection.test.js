import { EventEmitter } from 'events';
import Projection from '../src/projection';
import { inMemoryStorage } from '../src';

const nbUsersReducer = (state = 0, event) => {
  if (event.type === 'created') {
    return state + 1;
  }
  return state;
};

const createdEvent = {
  aggregate: 'user', id: 'user123', type: 'created', name: 'John Doe',
};

test('projection listen to events and replays', async () => {
  const bus = new EventEmitter();
  const projection = Projection(inMemoryStorage(), bus, 'nb-users', ['user'], nbUsersReducer);
  expect(await projection.getState()).toBe(0);
  bus.emit('event', createdEvent);
  expect(await projection.getState()).toBe(1);
  await projection.initialize();
  expect(await projection.getState()).toBe(0);
  bus.emit('event-replay', createdEvent);
  expect(await projection.getState()).toBe(1);
});
