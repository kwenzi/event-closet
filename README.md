# event-store

## installation

```bash
npm install @kwenzi/event-store
```

## example

```javascript
import EventStore from '@kwenzi/event-store';

const store = EventStore(); // default options (uses in-memory storage, not suitable for production)

// add an aggregate
const decisionProjection = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};
store.registerAggregate('user', decisionProjection);

// add a read projection
const nbUsersProjection = (state = 0, event) => {
  if (event.type === 'created') {
    return state + 1;
  }
  return state;
};
store.registerProjection('nb-users', ['user'], nbUsersProjection);

const createUser = (projection, name) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  // return the new event to store
  // ('aggregate' and 'id' properties will be automatically set)
  return { type: 'created', name: name };
};
// a command is received!
await store.handleCommand('user', 'user123', projection => createUser(projection,  'John Doe'));

// get projection current state
const nbUsers = await store.getProjection('nb-users'); // returns 1
```

## options
```javascript
import EventStore, { mongoStorage } from '@kwenzi/event-store';

const storage = mongoStorage('mongodb://localhost:27017/eventStore');
await storage.connect();
const store = EventStore({ storage });
```
See below to read how storages work.

## api

### registerAggregate
Call this function to add an aggregate to your store.
```javascript
const name = 'user';
const decisionProjection = (state, event) => { /* something */ return newState; };
const readProjections = {
  'user-name': (state, event) => { /* something */ return newState; },
}
store.registerAggregate(name, decisionProjection, readProjections)
```
- `name` is the unique identifier of the aggregate.
- `decisionProjection` is the reducer function that will be used to generate the projection in `handleCommand`.
- `readProjections` is a collection of projections that we can later apply on a single entity of the aggregate with `getEntityProjection`.

### handleCommand
Call this function to handle a command on a specific entity that must generate new events.
```javascript
const aggregate = 'user';
const id = 'user123';
const commandHandler = projection => { /* something */ return newEvents; }
await store.handleCommand(aggregate, id, commandHandler);
```
- `commandHandler` is a function that is given the decision projection and that return a new event to store, or an array of new events.

### getEntityProjection
Call this function to get a projection of a single entity of your store.
```javascript
const aggregate = 'user';
const id = 'user123';
const projection = 'user-name';
const userName = await store.getEntityProjection(aggregate, id, projection);
```

### registerProjection
Call this function to add a new projection to your store.
```javascript
const name = 'nb-users';
const onAggregates = ['user'];
const projection = (state, event) => { /* something */ return newState; };
store.registerProjection(name, onAggregates, projection);
```
- `name` is the unique identifier of the projection.
- `onAggregates` is an array of the aggregates we will listen to.
- `projection` is the reducer function we will apply to the events.

### getProjection
Call this function to get the current state of a projection.
```javascript
const nbUsers = await store.getProjection('nb-users');
```

### onEvent
Call this function to register a listener to all new events.
```javascript
store.onEvent((event) => { /* do something */ });
```

### rebuildProjections
Projections are persisted in the underlying storage. Call this function to rebuild them from the first event.
```javascript
await store.rebuildProjections();
```

## storage

### inMemoryStorage
Everything is stored in memory, everything is lost when the app exits.
```javascript
import EventStore, { inMemoryStorage } from '@kwenzi/event-store';
const store = EventStore({ storage: inMemoryStorage() });
```

### mongoStorage
There are 2 ways of using it:

- give the mongo url (and optionaly the connect options), call connect.
```javascript
import EventStore, { mongoStorage } from '@kwenzi/event-store';

const storage = mongoStorage({
  url: 'mongodb://localhost:27017/eventStore',
  connectOptions: {},
});
await storage.connect();
const store = EventStore({ storage });
/* ... */
storage.close(); // to end connection
```

- give it an already connected `db` object.
```javascript
import EventStore, { mongoStorage } from '@kwenzi/event-store';
import { MongoClient } from 'mongodb';

const db = await MongoClient.connect(url, options);
const store = EventStore({
  storage: mongoStorage({ db });
});
```

Other options available:
```javascript
const storage = mongostorage({
  eventsCollection: 'events', // name of the mongo events collection
  projectionsCollection: 'projections', // name of the mongo projections collection
});
```
