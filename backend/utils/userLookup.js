const User = require('../models/User');

function compactPhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.trim().replace(/[\s\-()]/g, '');
}

function extractDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeRuDigits(digits) {
  if (!digits) return '';

  if (digits.length === 10 && digits.startsWith('9')) {
    return `7${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }

  if (digits.length === 11 && digits.startsWith('7')) {
    return digits;
  }

  return digits;
}

function buildPhoneLookupCandidates(phone) {
  const compact = compactPhone(phone);
  const digits = extractDigits(compact);
  const normalizedRu = normalizeRuDigits(digits);

  const variants = new Set();

  const add = (value) => {
    const v = String(value || '').trim();
    if (!v) return;
    variants.add(v);
  };

  const addDigitsAndPlus = (value) => {
    const digitsOnly = extractDigits(value);
    if (!digitsOnly) return;
    add(digitsOnly);
    add(`+${digitsOnly}`);
  };

  add(compact);
  addDigitsAndPlus(digits);

  if (normalizedRu && normalizedRu !== digits) {
    addDigitsAndPlus(normalizedRu);
  }

  if (normalizedRu.length === 11 && normalizedRu.startsWith('7')) {
    addDigitsAndPlus(`8${normalizedRu.slice(1)}`);
  }

  if (compact.startsWith('+')) {
    add(compact.slice(1));
  } else {
    add(`+${compact}`);
  }

  return Array.from(variants);
}

function isValidPhoneExact(phone) {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;

  // Allow only common phone characters in input.
  if (!/^[+\d\s\-()]+$/.test(trimmed)) return false;

  const digits = extractDigits(trimmed);
  // Minimum 9 digits (anti-enumeration threshold), maximum 15 (E.164).
  return /^[1-9]\d{8,14}$/.test(digits);
}

async function findUserByExactPhone({ phone, excludeUserId }) {
  const candidates = buildPhoneLookupCandidates(phone);
  if (!candidates.length) return null;

  const query = {
    $or: [
      { phone: { $in: candidates } },
      { phoneNormalized: { $in: candidates } }
    ]
  };

  if (excludeUserId) query._id = { $ne: excludeUserId };

  const user = await User.findOne(query).select('_id name phone avatarUrl').lean();
  if (!user) return null;

  return {
    // Keep backward compatibility with Android DTO (UserDto).
    _id: user._id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl || null,
  };
}

module.exports = { isValidPhoneExact, findUserByExactPhone };
