const { Long } = require('bson');

function toLong(value) {
  if (value instanceof Long) return value;
  if (typeof value === 'bigint') return Long.fromString(value.toString());
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error('HRUM amount must be a finite integer');
    }
    return Long.fromNumber(value);
  }
  if (typeof value === 'string') {
    if (!/^-?\\d+$/.test(value)) throw new Error('HRUM amount string must be an integer');
    return Long.fromString(value);
  }
  throw new Error('Unsupported HRUM amount type');
}

function longAdd(a, b) {
  return toLong(a).add(toLong(b));
}

function longNeg(value) {
  return toLong(value).negate();
}

function longGte(a, b) {
  return toLong(a).greaterThanOrEqual(toLong(b));
}

function longIsZero(v) {
  return toLong(v).equals(Long.ZERO);
}

function longToString(v) {
  return toLong(v).toString();
}

module.exports = {
  Long,
  toLong,
  longAdd,
  longNeg,
  longGte,
  longIsZero,
  longToString
};

