import { rm } from 'node:fs/promises';
import mongoose from 'mongoose';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { connectDatabase, disconnectDatabase } from '../src/db';

export const app = createApp();

export async function setupDatabase() {
  await connectDatabase(config.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

export async function teardownDatabase() {
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
  await rm(config.LOCAL_STORAGE_DIR, { recursive: true, force: true });
}

export async function makePdf(pages = 3): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) pdf.addPage([595, 842]);
  return Buffer.from(await pdf.save());
}

/** A 1x1 transparent PNG. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

let counter = 0;
export async function signUp(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  counter += 1;
  const body = {
    name: 'Test Owner',
    email: `owner${counter}-${Date.now()}@example.com`,
    password: 'correct horse battery',
    ...overrides,
  };
  const res = await request(app).post('/auth/signup').send(body).expect(201);
  return { token: res.body.token as string, user: res.body.user, password: body.password };
}
