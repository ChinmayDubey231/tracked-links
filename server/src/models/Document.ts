import { Schema, model, type InferSchemaType } from 'mongoose';

const documentSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  /** Storage key of the PDF in the private bucket. Never sent to clients. */
  fileKey: { type: String, required: true },
  /** Storage key of a first-page PNG rendered in the owner's browser at upload. */
  thumbnailKey: { type: String, default: null },
  pageCount: { type: Number, required: true, min: 1 },
  sizeBytes: { type: Number, required: true, min: 1 },
  /** Incremented when the owner replaces the file; links keep pointing here. */
  version: { type: Number, default: 1 },
  replacedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => new Date() },
});

documentSchema.index({ ownerId: 1, createdAt: -1 });

export type DocumentRecord = InferSchemaType<typeof documentSchema>;
export const DocumentModel = model('Document', documentSchema);
