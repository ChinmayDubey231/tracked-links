import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
