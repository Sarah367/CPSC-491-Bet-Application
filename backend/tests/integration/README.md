# Backend integration tests

HTTP-level tests that send real requests to the Express app with
[Supertest](https://github.com/ladjs/supertest). Unlike the unit tests in
`backend/tests/`, which test one piece at a time, these check the whole request
path: routing, `express.json()`, middleware, controllers, and response codes.

## Conventions

- Location: `backend/tests/integration/`
- File names: `<area>.integration.test.js` (e.g. `bets.integration.test.js`)
- Import the app from `src/app.js`, never `src/server.js`. `app.js` exports the
  Express app without calling `listen()`, so Supertest can call it directly
  without starting a server or using a port.
- Always mock `src/config/firebaseAdmin` with `jest.mock(...)` so tests never
  contact the real Firebase project and don't need a service account key.
  Control authentication by setting `auth.verifyIdToken` to resolve with a
  decoded token (e.g. `{ uid: "test-uid", email_verified: true }`) or reject.

## Running

From `backend/`:

```bash
npm test                                   # all tests, unit + integration
npx jest tests/integration                 # integration tests only
npx jest tests/integration/api.integration.test.js   # one file
```

They run in CI automatically: the backend job already runs `npm test`, and Jest
picks up every `*.test.js` file.