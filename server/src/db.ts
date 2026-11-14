import mongoose from 'mongoose';
import './models/User';
import './models/Document';
import './models/Link';
import './models/View';

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Build indexes (unique email and slug) before accepting requests.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
