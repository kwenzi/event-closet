# event-store

## installation

```bash
npm install @kwenzi/event-store
```

## usage

```javascript
import EventStore from '@kwenzi/event-store';

const store = EventStore(); // default options

// add an aggregate
const userDecisionReducer = (state = { created: false }, event) => {
  if (event.type === 'created') {
    return { created: true };
  }
  return state;
};
store.addAggregate('user', userDecisionReducer);

// add a read projection
const nbUsersReducer = (state = 0, event) => {
  if (event.aggregate === 'user' && event.type === 'created') {
    return state + 1;
  }
  return state;
};
store.addProjection('nb-users', nbUsersReducer);

const createUser = (userState, name) => {
  if (userState.created) {
    throw new Error('user already created');
  }
  // return the new event to store
  // ('aggregate' and 'id' properties will be automatically set)
  return { type: 'created', name: name };
};
// an event happens!
await store.handleCommand('user', 'user123', userState => createUser(userState,  'John Doe'));

// get projection current state
const nbUsers = await store.getProjection('nb-users'); // returns 1
```
