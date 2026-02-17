const mongoose = require('mongoose');

const OBJECT_ID_HEX_RE = /^[a-fA-F0-9]{24}$/;

function toObjectIdSafe(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.toLowerCase() === 'system') return null;
    if (!OBJECT_ID_HEX_RE.test(trimmed)) return null;
    return new mongoose.Types.ObjectId(trimmed);
  }

  // Covers legacy numeric IDs and non-ObjectId scalars.
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return null;
  }

  // Handle plain BSON ObjectId-like objects defensively.
  if (typeof value === 'object' && typeof value.toHexString === 'function') {
    try {
      const hex = String(value.toHexString());
      if (!OBJECT_ID_HEX_RE.test(hex)) return null;
      return new mongoose.Types.ObjectId(hex);
    } catch (_) {
      return null;
    }
  }

  return null;
}

module.exports = { toObjectIdSafe };
