import { Schema, model, type InferSchemaType } from 'mongoose';

const linkSchema = new Schema({
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  /** Public URL part: /v/:slug. Random, at least 10 characters. */
  slug: { type: String, required: true, unique: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  requireEmail: { type: Boolean, default: false },
  /** bcrypt hash of the link password, or null when the link has none. */
  passwordHash: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  allowDownload: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  /** When the first-open email went out (phase 4). */
  notifiedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

export type LinkRecord = InferSchemaType<typeof linkSchema>;
export const Link = model('Link', linkSchema);
