import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document';
import { Link } from '../models/Link';
import { notFound } from './httpError';

/*
 * Owner lookups. Anything that belongs to someone else answers 404, the same
 * as a missing id, so ids can't be probed.
 */

export async function findOwnedDocument(id: string, ownerId: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('document');
  const doc = await DocumentModel.findOne({ _id: id, ownerId });
  if (!doc) throw notFound('document');
  return doc;
}

export async function findOwnedLink(id: string, ownerId: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound('link');
  const link = await Link.findOne({ _id: id, ownerId });
  if (!link) throw notFound('link');
  return link;
}
