import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/models/User';
import { app, setupDatabase, signUp, teardownDatabase } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

describe('POST /auth/signup', () => {
  it('creates an account, hashes the password and returns a token', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: '  Chinmay  ', email: ' New.Person@Example.com ', password: 'longenough' })
      .expect(201);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Chinmay', email: 'new.person@example.com' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await User.findOne({ email: 'new.person@example.com' });
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain('longenough');
  });

  it('rejects a duplicate email with a field message', async () => {
    const { user } = await signUp();
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Someone', email: user.email.toUpperCase(), password: 'longenough' })
      .expect(409);
    expect(res.body.error.fields.email).toMatch(/already exists/);
  });

  it('explains each invalid field', async () => {
    const res = await request(app).post('/auth/signup').send({ name: '', email: 'nope', password: 'short' }).expect(400);
    expect(res.body.error.code).toBe('invalid_input');
    expect(res.body.error.fields).toMatchObject({
      name: 'Enter your name.',
      email: expect.stringMatching(/valid email/),
      password: expect.stringMatching(/at least 8/),
    });
  });
});

describe('POST /auth/login', () => {
  it('logs in with the right password', async () => {
    const { user, password } = await signUp();
    const res = await request(app).post('/auth/login').send({ email: user.email, password }).expect(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('gives the same message for a wrong password and an unknown email', async () => {
    const { user } = await signUp();
    const wrong = await request(app).post('/auth/login').send({ email: user.email, password: 'wrong-password' }).expect(401);
    const unknown = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'whatever1' }).expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });
});

describe('GET /auth/me', () => {
  it('requires a valid token', async () => {
    await request(app).get('/auth/me').expect(401);
    await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
  });

  it('returns the current user', async () => {
    const { token, user } = await signUp();
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.user).toEqual(user);
  });
});
