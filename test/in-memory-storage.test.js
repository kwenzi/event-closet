import toArray from 'stream-to-array';
import { inMemoryStorage } from '../src';

const jane1 = {
  aggregate: 'user',
  id: 'jane',
  sequence: 1,
  insertDate: '2018-03-09T11:09:51.206Z',
  type: 'created',
  name: 'Jane Dowe',
};

const julia1 = {
  aggregate: 'user',
  id: 'julia',
  sequence: 1,
  insertDate: '2018-03-09T11:09:51.207Z',
  type: 'created',
  name: 'Julia Doe',
};

const jane2 = {
  aggregate: 'user',
  id: 'jane',
  sequence: 2,
  insertDate: '2018-03-09T11:09:51.208Z',
  type: 'saved',
};

const jane3 = {
  aggregate: 'user',
  id: 'jane',
  sequence: 3,
  insertDate: '2018-03-09T11:09:51.208Z',
  type: 'verified',
};

test('can store and retrieve events', async () => {
  const storage = inMemoryStorage();
  await storage.storeEvent(jane1);
  await storage.storeEvent(julia1);
  await storage.storeEvent(jane2);
  await storage.storeEvent(jane3);
  const janeEvts = await toArray(await storage.getEvents('user', 'jane'));
  expect(janeEvts).toEqual([jane1, jane2, jane3]);
  const janeLastEvts = await toArray(await storage.getEvents('user', 'jane', 2));
  expect(janeLastEvts).toEqual([jane3]);
  const allEvts = await toArray(await storage.getAllEvents());
  expect(allEvts).toEqual([jane1, julia1, jane2, jane3]);
});

test('can store and retrieve projections', async () => {
  const storage = inMemoryStorage();
  const proj = { foo: 'bar' };
  const proj2 = { foo: 'baz' };
  await storage.storeProjection('proj', proj);
  await storage.storeProjection('proj2', proj2);
  expect(await storage.getProjection('proj')).toEqual(proj);
  expect(await storage.getProjection('proj2')).toEqual(proj2);
});

test('can store and retrieve snapshots', async () => {
  const storage = inMemoryStorage();
  const snapshot = { sequence: 50, state: { foo: 'bar' } };
  const snapshot2 = { sequence: 50, state: { foo: 'baz' } };
  await storage.storeSnapshot('aggregate', 'id', 'proj', snapshot);
  await storage.storeSnapshot('aggregate', 'id', 'proj2', snapshot2);
  expect(await storage.getSnapshot('aggregate', 'id', 'proj')).toEqual(snapshot);
  expect(await storage.getSnapshot('aggregate', 'id', 'proj2')).toEqual(snapshot2);
});
