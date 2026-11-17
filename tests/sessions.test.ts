import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { app } from '../src/app';
import { User } from '../src/models/User';
import { Teacher } from '../src/models/Teacher';
import { Session } from '../src/models/Session';

let database: MongoMemoryServer;
let teacherId: string;
let userId: string;
const future = '2099-05-12T10:00:00.000Z';

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([User.init(), Teacher.init(), Session.init()]);
});
after(async () => {
  await mongoose.disconnect();
  if (database) await database.stop();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Teacher.deleteMany({}), Session.deleteMany({})]);
  const teacher = await Teacher.create({ fullName: 'Teacher', email: 'teacher@example.com', specialization: 'Math', experience: 3 });
  const user = await User.create({ fullName: 'User', email: 'user@example.com', phone: '1234567890' });
  teacherId = teacher.id;
  userId = user.id;
});

async function createSession(startTime = future, endTime = '2099-05-12T11:00:00.000Z') {
  const response = await request(app).post('/sessions').send({ teacherId, startTime, endTime }).expect(201);
  assert.equal(response.body.status, 'AVAILABLE');
  assert.equal(response.body.userId, null);
  return response.body._id as string;
}

test('normalizes email and rejects duplicate emails, missing fields and malformed JSON', async () => {
  const body = { fullName: 'New User', email: ' NEW@example.com ', phone: '123' };
  const response = await request(app).post('/users').send(body).expect(201);
  assert.equal(response.body.email, 'new@example.com');
  await request(app).post('/users').send({ ...body, email: 'new@example.com' }).expect(409);
  await request(app).post('/users').send({ email: 'x@example.com' }).expect(400);
  await request(app).post('/users').send({ ...body, email: 'invalid' }).expect(400);
  await request(app).post('/users').set('Content-Type', 'application/json').send('{').expect(400);
});

test('validates ObjectIds, teacher existence, calendar dates and end time', async () => {
  const body = { teacherId, startTime: future, endTime: future };
  await request(app).post('/sessions').send(body).expect(400);
  await request(app).post('/sessions').send({ ...body, teacherId: 'bad' }).expect(400);
  await request(app).post('/sessions').send({ ...body, startTime: '2099-02-30T10:00:00Z' }).expect(400);
  await request(app).post('/sessions').send({ ...body, startTime: '2099-05-12' }).expect(400);
  await request(app).post('/sessions').send({ ...body, teacherId: new mongoose.Types.ObjectId().toString(), endTime: '2099-05-12T11:00:00Z' }).expect(404);
});

test('available aggregation uses UTC day boundaries and excludes booked sessions', async () => {
  const first = await createSession('2099-05-12T00:00:00Z', '2099-05-12T01:00:00Z');
  const last = await createSession('2099-05-12T23:59:59.999Z', '2099-05-13T01:00:00Z');
  await createSession('2099-05-13T00:00:00Z', '2099-05-13T01:00:00Z');
  const booked = await createSession();
  await request(app).post(`/sessions/${booked}/book`).send({ userId }).expect(200);
  const response = await request(app).get('/sessions/available').query({ dateTimestamp: Date.parse(future) }).expect(200);
  assert.deepEqual(response.body.map((session: { _id: string }) => session._id), [first, last]);
  for (const value of ['', 'abc', '1.5', '999999999999999999']) {
    await request(app).get('/sessions/available').query({ dateTimestamp: value }).expect(400);
  }
  await request(app).get('/sessions/available').expect(400);
});

test('concurrent bookings have exactly one winner and preserve the winning user', async () => {
  const id = await createSession();
  const other = await User.create({ fullName: 'Other', email: 'other@example.com', phone: '123' });
  const attempts = await Promise.all([userId, other.id].map(idOfUser =>
    request(app).post(`/sessions/${id}/book`).send({ userId: idOfUser }),
  ));
  assert.deepEqual(attempts.map(result => result.status).sort(), [200, 409]);
  const winner = attempts.find(result => result.status === 200)!;
  const stored = await Session.findById(id).orFail();
  assert.equal(stored.userId?.toString(), winner.body.userId);
  assert.equal(stored.status, 'BOOKED');
});

test('completion requires booking and cannot be repeated or booked again', async () => {
  const id = await createSession();
  await request(app).patch(`/sessions/${id}/complete`).expect(409);
  await request(app).post(`/sessions/${id}/book`).send({ userId }).expect(200);
  const response = await request(app).patch(`/sessions/${id}/complete`).expect(200);
  assert.equal(response.body.status, 'COMPLETED');
  assert.ok(Number.isFinite(Date.parse(response.body.completedAt)));
  await request(app).patch(`/sessions/${id}/complete`).expect(409);
  await request(app).post(`/sessions/${id}/book`).send({ userId }).expect(409);
});

test('missing users and sessions return 404; malformed ids return 400', async () => {
  const missing = new mongoose.Types.ObjectId().toString();
  const id = await createSession();
  await request(app).post(`/sessions/${id}/book`).send({ userId: missing }).expect(404);
  await request(app).post(`/sessions/${missing}/book`).send({ userId }).expect(404);
  await request(app).patch(`/sessions/${missing}/complete`).expect(404);
  await request(app).get(`/users/${missing}/sessions`).expect(404);
  await request(app).get('/users/bad/sessions').expect(400);
  await request(app).post('/sessions/bad/book').send({ userId }).expect(400);
});

test('user aggregation separates upcoming and completed and excludes other users and past bookings', async () => {
  const upcoming = await createSession();
  const completed = await createSession();
  const past = await createSession('2000-01-01T10:00:00Z', '2000-01-01T11:00:00Z');
  await createSession();
  for (const id of [upcoming, completed, past]) {
    await request(app).post(`/sessions/${id}/book`).send({ userId }).expect(200);
  }
  await request(app).patch(`/sessions/${completed}/complete`).expect(200);
  const response = await request(app).get(`/users/${userId}/sessions`).expect(200);
  assert.deepEqual(response.body.upcomingSessions.map((s: { _id: string }) => s._id), [upcoming]);
  assert.deepEqual(response.body.completedSessions.map((s: { _id: string }) => s._id), [completed]);
  const other = await User.create({ fullName: 'Other', email: 'other@example.com', phone: '123' });
  const empty = await request(app).get(`/users/${other.id}/sessions`).expect(200);
  assert.deepEqual(empty.body, { upcomingSessions: [], completedSessions: [] });
});
