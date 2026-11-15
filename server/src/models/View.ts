import { Schema, model, type InferSchemaType } from 'mongoose';

const pageTimeSchema = new Schema(
  {
    page: { type: Number, required: true, min: 1 },
    durationMs: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

/** One reading session of one link. Created by POST /v/:slug/access, never by a plain page request. */
const viewSchema = new Schema({
  linkId: { type: Schema.Types.ObjectId, ref: 'Link', required: true },
  documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
  viewerEmail: { type: String, default: null, lowercase: true, trim: true },
  startedAt: { type: Date, default: () => new Date() },
  lastSeenAt: { type: Date, default: () => new Date() },
  /** Active reading time: tab visible and the reader not idle. */
  totalDurationMs: { type: Number, default: 0, min: 0 },
  /** One entry per page, created up front so heartbeats can $inc by index. */
  pages: { type: [pageTimeSchema], default: [] },
  maxPageReached: { type: Number, default: 1, min: 1 },
  device: { type: String, default: null },
  browser: { type: String, default: null },
  os: { type: String, default: null },
  country: { type: String, default: null },
  /** Salted SHA-256 of the viewer's IP address. The raw address is never stored. */
  ipHash: { type: String, default: null },
  isBot: { type: Boolean, default: false },
});

viewSchema.index({ documentId: 1, startedAt: -1 });
viewSchema.index({ linkId: 1, startedAt: -1 });

export type ViewRecord = InferSchemaType<typeof viewSchema>;
export const View = model('View', viewSchema);
