const { Types } = require('mongoose');

function encodeCursor(payload) {
  if (!payload) return null;
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;

  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(raw);
  } catch (_) {
    try {
      const raw = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
}

function parseObjectId(id) {
  if (!id || !Types.ObjectId.isValid(id)) return null;
  return new Types.ObjectId(id);
}

function normalizeLimit(value, fallback = 20, max = 50) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function buildObjectIdCursor(items) {
  const last = Array.isArray(items) && items.length ? items[items.length - 1] : null;
  if (!last?._id) return null;
  return encodeCursor({ id: String(last._id) });
}

function applyObjectIdCursorFilter(query, cursorPayload, field = '_id') {
  const cursorId = parseObjectId(cursorPayload?.id);
  if (!cursorId) return query;
  query[field] = { $lt: cursorId };
  return query;
}

module.exports = {
  encodeCursor,
  decodeCursor,
  parseObjectId,
  normalizeLimit,
  buildObjectIdCursor,
  applyObjectIdCursorFilter
};
