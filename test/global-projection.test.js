import { EventEmitter } from 'events';
import GlobalProjection from '../src/global-projection';
import { inMemoryStorage } from '../src';

const nbUsersProjection = (state = 0, event) => {
  if (event.type === 'created') {
    return state + 1;
  }
  return state;
};

const createdEvent = {
  aggregate: 'user', id: 'user123', type: 'created', name: 'John Doe',
};

test('projection listen to events', async () => {
  const bus = new EventEmitter();
  const projection = GlobalProjection(inMemoryStorage(), bus, 'nb-users', ['user'], nbUsersProjection);
  expect(await projection.getState()).toBe(0);
  bus.emit('event', createdEvent);
  expect(await projection.getState()).toBe(1);
});

test('onChange is run on projection change', async () => {
  const bus = new EventEmitter();
  const onChange = jest.fn();
  const projection = GlobalProjection(inMemoryStorage(), bus, 'nb-users', ['user'], nbUsersProjection, {
    onChange,
  });
  bus.emit('event', createdEvent);
  expect(await projection.getState()).toBe(1);
  expect(onChange).toHaveBeenCalledWith(1, createdEvent);
});
