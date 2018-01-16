import { EventEmitter } from 'events';
import toArray from 'stream-to-array';
import Aggregate, { getAllEvents } from '../src/aggregate';
import { inMemoryStorage } from '../src';

const decisionProjection = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};

const createValidatedUser = (projection, name) => {
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

  await aggregate.handleCommand('user123', projection => createValidatedUser(projection, 'John Doe'));

  expect(listenerMock.mock.calls).toEqual([
    [createdEvent],
    [validatedEvent],
  ]);
});

test('getAllEvents return events from storage, without internal fields', async () => {
  const storage = inMemoryStorage([
    { ...createdEvent, sequence: 0, insertDate: new Date() },
  ]);

  expect(await toArray(getAllEvents(storage))).toEqual([createdEvent]);
});
