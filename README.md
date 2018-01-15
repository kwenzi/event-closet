# event-store

## installation

```bash
npm install @kwenzi/event-store
```

## usage

```javascript
import EventStore from '@kwenzi/event-store';

const store = EventStore(); // default options (uses in-memory storage, not suitable for production)

// add an aggregate
const decisionProjectionReducer = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};
store.registerAggregate('user', decisionProjectionReducer);

// add a read projection
const nbUsersReducer = (state = 0, event) => {
  if (event.aggregate === 'user' && event.type === 'created') {
    return state + 1;
  }
  return state;
};
store.registerProjection('nb-users', ['user'], nbUsersReducer);

const createUser = (decisionProjection, name) => {
  if (decisionProjection.created) {
    throw new Error('user already created');
  }
  // return the new event to store
  // ('aggregate' and 'id' properties will be automatically set)
  return { type: 'created', name: name };
};
// a command is received!
await store.handleCommand('user', 'user123', decisionProjection => createUser(decisionProjection,  'John Doe'));

// get projection current state
const nbUsers = await store.getProjection('nb-users'); // returns 1
```

## options
```javascript
import EventStore, { mongoStorage } from '@kwenzi/event-store';

const store = EventStore({
  storage: mongoStorage('mongodb://localhost:27017/eventStore'),
  onEvent: (event) => { console.log(event); },
});
```
