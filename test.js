const { MongoClient } = require('mongodb');
const Store = require('./index');

const aggregate = 'myAggregate';
const id = 'some_id';
const somethingHappened = {
  aggregate, id, type: 'somethingHappened', order: 1,
};
const somethingHappened2 = {
  aggregate, id, type: 'somethingHappened', order: 2,
};
const somethingHappened3 = {
  aggregate, id, type: 'somethingHappened', order: 3,
};
const otherIdEvent = {
  aggregate, id: 'other_id', type: 'somethingHappened',
};
let db;
let store;

beforeAll(async () => {
  db = await MongoClient.connect('mongodb://localhost:27017/event-store-test', {});
});

beforeEach(() => {
  store = Store(db);
});

afterEach(() => db.dropDatabase());

afterAll(() => db.close(true));

describe('event store 2', () => {
  test('will not fail', () => {
    expect(true).toBeTruthy();
  });

  test('after adding an event, get returns that event', async () => {
    const res = await store.handleCommand(aggregate, id, () => [somethingHappened]);
    expect(res).toEqual([somethingHappened]);
    const events = await store.get(aggregate, id);
    expect(events.length).toBe(1);
    expect(events[0]).toEqual(somethingHappened);
  });

  test('handler can return a single event', async () => {
    const res = await store.handleCommand(aggregate, id, () => somethingHappened);
    expect(res).toEqual(somethingHappened);
    const events = await store.get(aggregate, id);
    expect(events.length).toBe(1);
    expect(events[0]).toEqual(somethingHappened);
  });

  test('after adding several events, get returns those events in order', async () => {
    await store.handleCommand(aggregate, id, () => [somethingHappened, somethingHappened2]);
    const events = await store.get(aggregate, id);
    expect(events.length).toBe(2);
    expect(events[0]).toEqual(somethingHappened);
    expect(events[1]).toEqual(somethingHappened2);
  });

  test('after adding an event, get on other id doesnt return that event', async () => {
    await store.handleCommand(aggregate, id, () => [somethingHappened]);
    const events = await store.get(aggregate, 'other_id');
    expect(events.length).toBe(0);
  });

  test('after adding an event, get on other aggregate doesnt return that event', async () => {
    await store.handleCommand(aggregate, id, () => [somethingHappened]);
    const events = await store.get('other_aggregate', id);
    expect(events.length).toBe(0);
  });

  test('after adding an event and reinstanciate the store, get returns that event', async () => {
    await store.handleCommand(aggregate, id, () => [somethingHappened]);
    const otherStore = Store(db);
    const events = await otherStore.get(aggregate, id);
    expect(events.length).toBe(1);
    expect(events[0]).toEqual(somethingHappened);
  });

  test('after adding an event, another handleCommand gives that event as input', async () => {
    await store.handleCommand(aggregate, id, () => [somethingHappened]);
    await store.handleCommand(aggregate, id, (events) => {
      expect(events.length).toBe(1);
      expect(events[0]).toEqual(somethingHappened);
      return [];
    });
  });

  test('when handleCommand is called immediately after another handleCommand, the result of the first one is the input of the second', async () => {
    // no await
    store.handleCommand(aggregate, id, () => [somethingHappened]);
    // no await
    store.handleCommand(aggregate, id, (events) => {
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(somethingHappened);
      return [somethingHappened2];
    });
    // no await
    store.handleCommand(aggregate, id, (events) => {
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(somethingHappened);
      expect(events[1]).toEqual(somethingHappened2);
      return [somethingHappened3];
    });
    await store.handleCommand(aggregate, id, (events) => {
      expect(events).toHaveLength(3);
      expect(events[0]).toEqual(somethingHappened);
      expect(events[1]).toEqual(somethingHappened2);
      expect(events[2]).toEqual(somethingHappened3);
      return [];
    });
  });

  test('onEvent is called for each event stored', async () => {
    const onEvent = jest.fn();
    store = Store(db, onEvent);
    store.handleCommand(aggregate, id, () => [somethingHappened, somethingHappened2]);
    await store.handleCommand(aggregate, id, () => [somethingHappened3]);
    expect(onEvent.mock.calls).toHaveLength(3);
    expect(onEvent.mock.calls[0][0]).toEqual(somethingHappened);
    expect(onEvent.mock.calls[1][0]).toEqual(somethingHappened2);
    expect(onEvent.mock.calls[2][0]).toEqual(somethingHappened3);
  });

  test('insert_date and sequence numbers are saved in base', async () => {
    store.handleCommand(aggregate, id, () => [somethingHappened, somethingHappened2]);
    await store.handleCommand(aggregate, id, () => [somethingHappened3]);
    const events = await store.get(aggregate, id, {});
    expect(events).toHaveLength(3);
    expect(events[0].sequence).toBe(0);
    expect(events[1].sequence).toBe(1);
    expect(events[2].sequence).toBe(2);
    expect(events[0].insert_date).toBeInstanceOf(Date);
    expect(events[0].insert_date.getHours()).toBe(new Date().getHours());
  });

  test('replayAll send each event to the listener in the right order', async () => {
    // fill store
    store.handleCommand(aggregate, id, () => [somethingHappened, somethingHappened2]);
    store.handleCommand(aggregate, 'other_id', () => otherIdEvent);
    await store.handleCommand(aggregate, id, () => somethingHappened3);
    // reinstanciate store and replay events
    const onEvent = jest.fn();
    store = Store(db, onEvent);
    await store.replayAll();
    expect(onEvent.mock.calls).toHaveLength(4);
    expect(onEvent.mock.calls[0][0]).toEqual(somethingHappened);
    expect(onEvent.mock.calls[1][0]).toEqual(somethingHappened2);
    expect(onEvent.mock.calls[2][0]).toEqual(otherIdEvent);
    expect(onEvent.mock.calls[3][0]).toEqual(somethingHappened3);
  });

  test('if handler fails, its promise fail but others are not affected', async () => {
    store.handleCommand(aggregate, id, () => somethingHappened);
    expect(store.handleCommand(aggregate, id, () => { throw new Error('some error'); }))
      .rejects.toEqual(new Error('some error'));
    await store.handleCommand(aggregate, id, () => somethingHappened2);
    const events = await store.get(aggregate, id);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual(somethingHappened);
    expect(events[1]).toEqual(somethingHappened2);
  });
});
