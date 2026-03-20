const mongoose = require('mongoose');
const User = require('../models/User');

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function compactPhone(phone) {
  if (typeof phone !== 'string') return '';
  return phone.trim().replace(/[\s\-()]/g, '');
}

function extractDigits(phone) {
  return normalizePhone(phone);
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
  const raw = String(phone || '').trim();
  const compact = compactPhone(raw);
  const digits = extractDigits(raw);
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

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

async function findUserDocumentByPhone({ phone, excludeUserId, includeSystem = false, select = '_id name phone phoneNormalized avatarUrl isSystem systemKey' }) {
  const candidates = buildPhoneLookupCandidates(phone);
  if (!candidates.length) return null;

  const query = {
    $or: [
      { phone: { $in: candidates } },
      { phoneNormalized: { $in: candidates } }
    ]
  };

  if (!includeSystem) {
    query.isSystem = { $ne: true };
  }

  if (excludeUserId) query._id = { $ne: excludeUserId };

  return User.findOne(query).select(select);
}

async function findUserByExactPhone({ phone, excludeUserId }) {
  const user = await findUserDocumentByPhone({
    phone,
    excludeUserId,
    select: '_id name phone avatarUrl'
  }).lean();
  if (!user) return null;

  return {
    // Keep backward compatibility with Android DTO (UserDto).
    _id: user._id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl || null,
  };
}

async function resolveUser(input, options = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : { identifier: input };
  const select = options.select || '_id name phone phoneNormalized avatarUrl isSystem systemKey';
  const userId = String(source.userId || source.id || '').trim();
  const phone = String(source.phone || '').trim();
  const identifier = String(source.identifier || '').trim();
  const username = String(source.username || source.name || '').trim();
  const objectIdCandidate = userId || (mongoose.Types.ObjectId.isValid(identifier) ? identifier : '');

  if (objectIdCandidate && mongoose.Types.ObjectId.isValid(objectIdCandidate)) {
    if (options.excludeUserId && String(options.excludeUserId) === objectIdCandidate) {
      return null;
    }

    const user = await User.findOne({
      _id: objectIdCandidate,
      ...(options.includeSystem ? {} : { isSystem: { $ne: true } })
    }).select(select);

    if (!user) {
      return null;
    }

    return {
      userId: String(user._id),
      user,
      resolvedBy: 'id'
    };
  }

  const phoneCandidates = [phone, identifier]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .filter((value) => isValidPhoneExact(value));

  for (const candidate of phoneCandidates) {
    const phoneUser = await findUserDocumentByPhone({
      phone: candidate,
      excludeUserId: options.excludeUserId,
      includeSystem: options.includeSystem,
      select
    });

    if (phoneUser) {
      return {
        userId: String(phoneUser._id),
        user: phoneUser,
        resolvedBy: 'phone'
      };
    }
  }

  if (options.allowUsername === false) {
    return null;
  }

  const usernameCandidate = username || identifier;
  if (!usernameCandidate) {
    return null;
  }

  const escapedIdentifier = escapeRegExp(usernameCandidate);
  const usernameMatches = await User.find({
    name: { $regex: `^${escapedIdentifier}$`, $options: 'i' },
    ...(options.includeSystem ? {} : { isSystem: { $ne: true } }),
    ...(options.excludeUserId ? { _id: { $ne: options.excludeUserId } } : {})
  })
    .select(select)
    .limit(2);

  if (usernameMatches.length === 1) {
    return {
      userId: String(usernameMatches[0]._id),
      user: usernameMatches[0],
      resolvedBy: 'username'
    };
  }

  if (usernameMatches.length > 1) {
    return {
      userId: null,
      user: null,
      resolvedBy: 'username',
      ambiguous: true
    };
  }

  return null;
}

module.exports = {
  normalizePhone,
  buildPhoneLookupCandidates,
  isValidPhoneExact,
  findUserByExactPhone,
  resolveUser
};
