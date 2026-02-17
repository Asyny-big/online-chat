const mongoose = require('mongoose');
const Media = require('../../models/Media');
const {
  decodeCursor,
  normalizeLimit,
  buildObjectIdCursor,
  applyObjectIdCursorFilter
} = require('../utils/cursor');
const { httpError } = require('../utils/errors');

function toObjectIdOrFail(value, fieldName) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(value);
}

function normalizeString(value, fieldName, { required = false, max = 1024 } = {}) {
  const normalized = String(value || '').trim();
  if (required && !normalized) {
    throw httpError(400, `${fieldName} is required`);
  }
  if (normalized.length > max) {
    throw httpError(400, `${fieldName} is too long`);
  }
  return normalized;
}

function normalizeNumber(value, fieldName, { min = 0, allowNull = true } = {}) {
  if (value === undefined || value === null || value === '') {
    return allowNull ? null : min;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw httpError(400, `Invalid ${fieldName}`);
  }
  return parsed;
}

async function createMediaMeta({ ownerId, type, path, thumb, width, height, size }) {
  const ownerObjectId = toObjectIdOrFail(ownerId, 'ownerId');

  const media = await Media.create({
    ownerId: ownerObjectId,
    type: normalizeString(type, 'type', { required: true, max: 64 }),
    path: normalizeString(path, 'path', { required: true, max: 1024 }),
    thumb: normalizeString(thumb, 'thumb', { required: false, max: 1024 }),
    width: normalizeNumber(width, 'width', { min: 0, allowNull: true }),
    height: normalizeNumber(height, 'height', { min: 0, allowNull: true }),
    size: normalizeNumber(size, 'size', { min: 0, allowNull: false }) || 0
  });

  return media.toObject();
}

async function listMyMedia({ ownerId, cursor, limit }) {
  const ownerObjectId = toObjectIdOrFail(ownerId, 'ownerId');
  const normalizedLimit = normalizeLimit(limit, 20, 50);
  const query = { ownerId: ownerObjectId };

  const cursorPayload = decodeCursor(cursor);
  applyObjectIdCursorFilter(query, cursorPayload, '_id');

  const rows = await Media.find(query)
    .sort({ _id: -1 })
    .limit(normalizedLimit + 1)
    .lean();

  const hasMore = rows.length > normalizedLimit;
  const items = hasMore ? rows.slice(0, normalizedLimit) : rows;
  const nextCursor = hasMore ? buildObjectIdCursor(items) : null;

  return { items, nextCursor };
}

module.exports = {
  createMediaMeta,
  listMyMedia
};
