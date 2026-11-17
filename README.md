# Teacher session booking API

Small Express 5 / TypeScript backend using MongoDB and Mongoose. Routes call controllers directly; models define persistence. All six assignment APIs are implemented.

## Setup

Requirements: Node.js 20+ and a running MongoDB instance (local MongoDB or Atlas).

```bash
npm install
cp .env.example .env
# Set MONGODB_URI in .env; PORT defaults to 3000.
npm run seed:teacher
npm run dev
```

The seed script prints a teacher ID and reuses the same example teacher on subsequent runs. It is a testing convenience; there is no additional teacher creation endpoint. Substitute its ID in the requests below. Startup connects to MongoDB and waits for model indexes, including the unique user-email index, before accepting requests.

```bash
npm run typecheck
npm test
npm run build
npm start
```

Tests use an isolated real MongoDB process through `mongodb-memory-server`, never the database from `.env`. The first test run needs network access to download its MongoDB binary and a compatible host with MongoDB system libraries. To use an already installed MongoDB binary instead:

```bash
MONGOMS_SYSTEM_BINARY=/usr/bin/mongod MONGOMS_SYSTEM_BINARY_VERSION_CHECK=false npm test
```

## API examples

Base URL: `http://localhost:3000`. Requests with bodies use `Content-Type: application/json`.

### 1. Create user

```bash
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Sam Lee","email":"sam@example.com","phone":"9876543210"}'
```

Returns `201` and the user document. All three fields are required strings. Email is trimmed, lowercased and validated; duplicates return `409`, enforced by a database unique index.

### 2. Create session

```bash
curl -X POST http://localhost:3000/sessions \
  -H 'Content-Type: application/json' \
  -d '{"teacherId":"<teacherId>","startTime":"2099-05-12T10:00:00Z","endTime":"2099-05-12T11:00:00Z"}'
```

Returns `201` with status `AVAILABLE`, `userId: null`, and `completedAt: null`. Teacher must exist and end time must be strictly after start time. Client-supplied status, userId and completedAt are ignored.

### 3. Available sessions

```bash
curl "http://localhost:3000/sessions/available?dateTimestamp=$(node -p 'Date.parse("2099-05-12T12:00:00Z")')"
```

Returns `200` with an array sorted by start time. Uses an aggregation pipeline to select `AVAILABLE` sessions starting within the supplied UTC date, including midnight and excluding the next midnight.

### 4. Book session

```bash
curl -X POST http://localhost:3000/sessions/<sessionId>/book \
  -H 'Content-Type: application/json' -d '{"userId":"<userId>"}'
```

Returns `200` with the updated session. User must exist. A single conditional `findOneAndUpdate` matches both session ID and `AVAILABLE` status and sets `BOOKED` plus user ID. Concurrent attempts therefore have only one winner; other attempts return `409`.

### 5. Complete session

```bash
curl -X PATCH http://localhost:3000/sessions/<sessionId>/complete
```

Returns `200` with status `COMPLETED` and server-generated `completedAt`. Only `BOOKED` sessions can transition; repeated or invalid transitions return `409`. Completion is conditional and atomic too.

### 6. User sessions

```bash
curl http://localhost:3000/users/<userId>/sessions
```

Returns `200`:

```json
{ "upcomingSessions": [], "completedSessions": [] }
```

Uses aggregation with `$match` and `$facet`. Upcoming sessions are `BOOKED` sessions with `startTime >= now`, sorted earliest first. Completed sessions have status `COMPLETED`, sorted by completion time newest first. Arrays contain full session documents. Other users' sessions and past, uncompleted bookings are excluded.

## Documented implementation decisions

The assignment does not define request body formats, timestamp units/timezone, or the precise meaning of upcoming. This implementation uses the formats above, Unix **milliseconds** for `dateTimestamp`, UTC day boundaries, and ISO 8601 datetime strings with seconds and an explicit timezone (`Z` or an offset). Invalid calendar dates are rejected. Session selection is based on start time, rather than overlap with a day.

No extra restrictions on past session creation, booking past sessions, overlapping teacher sessions, or completing before end time are imposed, because the assignment does not require them. `experience` is a non-negative number of years. Only user emails are unique, as required by the assignment.

## Errors and testing

Errors have the shape `{ "message": "..." }`. Invalid fields, dates, timestamps or ObjectIds return `400`; missing users, teachers or sessions return `404`; duplicate emails or invalid state transitions return `409`; unexpected failures return `500` without internal details. Unknown routes return `404`.

Import `postman/collection.json` into Postman. Set `teacherId` from the seed script; the collection automatically saves created `userId` and `sessionId`. Run requests in order. The collection initializes tomorrow's session times and UTC date timestamp automatically, and uses a fresh email per run.

Focused integration tests exercise email uniqueness, validation, UTC boundaries, concurrent booking, completion rules, missing resources, and user-history separation using actual database operations.
