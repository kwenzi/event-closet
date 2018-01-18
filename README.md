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

const createUser = (projection, name) => {
  if (projection.created) {
    throw new Error('user already created');
  }
  // return the new event to store
  // ('aggregate' and 'id' properties will be automatically set)
  return { type: 'created', name: name };
};
// a command is received!
await closet.handleCommand('user', 'user123', projection => createUser(projection,  'John Doe'));

// get projection current state
const nbUsers = await closet.getProjection('nb-users'); // returns 1
```

## What are events?
Events are plain javascript object. They have some special fields and any number of custom fields.
```javascript
const event = {
  // special mandatory fields
  aggregate: 'user',
  id: 'user123',
  type: 'created',
  sequence: 1,
  insertDate: new Date(),
  // user-defined fields
  name: 'John Doe',
}
```

## options
```javascript
const closet = EventCloset({ /* your options here */ });
```

### storage (default: `inMemoryStorage()`)
See below to read how storages work.

## api

### registerAggregate
Call this function to add an aggregate to your closet.
```javascript
const name = 'user';
const decisionProjection = (state, event) => { /* something */ return newState; };
const readProjections = {
  'user-name': (state, event) => { /* something */ return newState; },
}
closet.registerAggregate(name, decisionProjection, readProjections)
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
await closet.handleCommand(aggregate, id, commandHandler);
```
- `commandHandler` is a function that is given the decision projection and that return a new event to store, or an array of new events.

  The produced events are plain javascript objects (see "What is an event" above). The only special field that the function must fill is `type`, all other special fields will be rewritten before insertion.

### getEntityProjection
Call this function to get a projection of a single entity of your closet.
```javascript
const aggregate = 'user';
const id = 'user123';
const projection = 'user-name';
const userName = await closet.getEntityProjection(aggregate, id, projection);
```

### registerProjection
Call this function to add a new projection to your closet.
```javascript
const name = 'nb-users';
const onAggregates = ['user'];
const projection = (state, event) => { /* something */ return newState; };
closet.registerProjection(name, onAggregates, projection);
```
- `name` is the unique identifier of the projection.
- `onAggregates` is an array of the aggregates we will listen to.
- `projection` is the reducer function we will apply to the events.

### getProjection
Call this function to get the current state of a projection.
```javascript
const nbUsers = await closet.getProjection('nb-users');
```

### onEvent
Call this function to register a listener to all new events.
```javascript
closet.onEvent((event) => { /* do something */ });
```

### rebuildProjections
Projections are persisted in the underlying storage. Call this function to rebuild them from the first event.
```javascript
await closet.rebuildProjections();
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
  getEvents: (aggregate, id) => {
    // return a Readable Stream of events
  },
  getAllEvents: () => {
    // return a Readable Stream of events
  },
  storeProjection: async (name, state) => {
    // store a read projection
  },
  getProjection: async (name) => {
    // get a read projection
  },
};
const closet = EventCloset({ storage });
```
