# event-closet

## installation

```bash
npm install event-closet
```

## example

```javascript
import EventCloset from 'event-closet';

const closet = EventCloset(); // default options (uses in-memory storage, not suitable for production)

// add an aggregate
const decisionProjection = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};
closet.registerAggregate('user', decisionProjection);

// add a read projection
const nbUsersProjection = (state = 0, event) => {
  if (event.type === 'created') {
    return state + 1;
  }
  return state;
};
closet.registerProjection('nb-users', ['user'], nbUsersProjection);

// add a command
const createUser = (projection, { name }) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  // return the new event to store
  // (mandatory fields like 'aggregate' and 'id' will be automatically set)
  return { type: 'created', name };
};
closet.registerCommand('user', 'create', createUser);

// a command is received!
await closet.handleCommand('user', 'user123', 'create', { name: 'John Doe' });

// get projection current state
const nbUsers = await closet.getProjection('nb-users'); // returns 1
```

Or with the promises syntax instead of async/await:

```javascript
closet.handleCommand('user', 'user123', { name: 'John Doe' })
.then(() => closet.getProjection('nb-users'))
.then((nbUsers) => {
  // nbUsers === 1
});
```

## What are events?
Events are plain javascript object. They have some special fields and any number of custom fields.
```javascript
const event = {
  // special mandatory fields
  aggregate: 'user',
  id: 'user123',
  sequence: 1,
  insertDate: new Date().toISOString(),
  // user-defined fields
  type: 'created',
  version: 1,
  name: 'John Doe',
}
```

## options
```javascript
const closet = EventCloset({ /* your options here */ });
```

### storage (default: `inMemoryStorage()`)
See below to read how storages work.

### snapshotEvery (default: `null`)
If it's a number, the closet will save snapshots of the entities projections every N events in order to avoid having to replay all the events stack to get the projections state.

If it's `null`, no snapshot will be taken.

### logger (default: no logging)
An object that has `info` and `error` methods to let the closet write logs.

## api

### registerAggregate
Call this function to add an aggregate to your closet.
```javascript
const name = 'user';
const decisionProjection = (state, event) => { /* something */ return newState; };
const options = { snapshotEvery: 50 };
closet.registerAggregate(name, decisionProjection, options);
```
- `decisionProjection` is the reducer function that will be used to generate the projection in `handleCommand`.
- `options` can contain the following values:
  - `snapshotEvery` to override the global `snapshotEvery` option for this aggregate.


### registerEntityProjection
Call this function to add a projection that we can later apply on a single entity of the aggregate with `getEntityProjection`.
```javascript
const aggregate = 'user';
const name = 'identity';
const projection = (state, event) => { /* something */ return newState; }
const options = { snapshotEvery: 50 };
closet.registerEntityProjection(aggregate, name, projection, options);
```
- `projection` is the reducer function that will be used to generate the projection in `getEntityProjection`.
- `options` can contain the following values:
  - `snapshotEvery` to override the global `snapshotEvery` option for this projection.

### registerCommand
Call this function to add a command handler: something that will receive the current decision projection of the entity and some context data and will return the new event(s) to store.
```javascript
const aggregate = 'user';
const name = 'create';
const commandHandler = (projection, params) => { /* something */ return newEvents }
closet.registerCommand(aggregate, name, commandHandler);
```
- `commandHandler` is a function that is given the decision projection + the command params and that return a new event to store, or an array of new events.

  The produced events are plain javascript objects (see "What is an event" above). The special fields will be filled in by the closet, only user fields must be present in the object.

### handleCommand
Call this function when a command is actually received.
```javascript
const aggregate = 'user';
const id = 'user123';
const command = 'create';
const params = { /* command params */ };
await closet.handleCommand(aggregate, id, command, params);
```
**Return value**: the event(s) returned by the handler.

### getEntityProjection
Call this function to get a projection of a single entity of your closet.
```javascript
const aggregate = 'user';
const id = 'user123';
const projection = 'identity';
const identity = await closet.getEntityProjection(aggregate, id, projection);
```
**Return value**: the result of the projection applied to all the entity's events.

### registerProjection
Call this function to add a new projection to your closet.
```javascript
const name = 'nb-users';
const onAggregates = ['user'];
const projection = (state, event) => { /* something */ return newState; };
const options = {
  onChange: (state, event) => { /* do something */ }
};
closet.registerProjection(name, onAggregates, projection, options);
```
- `onAggregates` is an array of the aggregates we will listen to.
- `projection` is the reducer function that we will apply to the events.
- `options` can contain the following values:
  - `onChange`, a handler that will be called each time the projection changes with 2 arguments: the new state and the event.

### getProjection
Call this function to get the current state of a projection.
```javascript
const nbUsers = await closet.getProjection('nb-users');
```
**Return value**: the result of the projection applied to all the events.

### onEvent
Call this function to register a listener to all new events.
```javascript
closet.onEvent((event) => { /* do something */ });
```

### rebuild
Projections and snapshots are persisted in the underlying storage. Call this function to rebuild them from the first event.
```javascript
await closet.rebuild();
```

## storage

### inMemoryStorage
Everything is stored in memory, everything is lost when the app exits.
```javascript
import EventCloset, { inMemoryStorage } from 'event-closet';

const closet = EventCloset({ storage: inMemoryStorage() });
```

### mongoStorage
There are 2 ways of using it:

- give the mongo url (and optionaly the connect options), call connect.
```javascript
import EventCloset, { mongoStorage } from 'event-closet';

const storage = mongoStorage({
  url: 'mongodb://localhost:27017/eventCloset',
  connectOptions: {},
});
await storage.connect();
const closet = EventCloset({ storage });
/* ... */
storage.close(); // to end connection
```

- give it an already connected `db` object.
```javascript
import EventCloset, { mongoStorage } from 'event-closet';
import { MongoClient } from 'mongodb';

const db = await MongoClient.connect(url, options);
const closet = EventCloset({
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

### Custom storage
To support any other type of storage, you can pass a custom storage object (async function are expected to return promises):
```javascript
import EventCloset from 'event-closet';

const storage = {
  storeEvent: async (event) => {
    // store a new event
  },
  getEvents: (aggregate, id, fromSequence) => {
    // return a Readable Stream of events sorted by sequence
    // if fromSequence is provided, return only events of higher sequence
  },
  getAllEvents: () => {
    // return a Readable Stream of events sorted by insertDate then sequence
  },
  storeProjection: async (name, state) => {
    // store a read projection
  },
  getProjection: async (name) => {
    // get a read projection
  },
  storeSnapshot: async (aggregate, id, projection, snapshot) => {
    // store a snapshot
  },
  getSnapshot: async (aggregate, id, projection) => {
    // get a snapshot
  },
};
const closet = EventCloset({ storage });
```
