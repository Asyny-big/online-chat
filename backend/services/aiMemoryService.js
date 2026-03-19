const mongoose = require('mongoose');
const AiMemory = require('../models/AiMemory');

const MAX_RECENT_ACTIONS = Math.max(Number(process.env.AI_MEMORY_RECENT_ACTIONS_LIMIT || 8), 1);
const MAX_RECENT_ISSUES = Math.max(Number(process.env.AI_MEMORY_RECENT_ISSUES_LIMIT || 6), 1);
const MAX_PREFERENCES = Math.max(Number(process.env.AI_MEMORY_PREFERENCES_LIMIT || 6), 1);
const MEMORY_PROMPT_MAX_LENGTH = Math.max(Number(process.env.AI_MEMORY_PROMPT_MAX_LENGTH || 1200), 200);
const CLEANUP_INTERVAL_MS = Math.max(Number(process.env.AI_MEMORY_CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000), 60 * 1000);
const TRANSIENT_RETENTION_DAYS = Math.max(Number(process.env.AI_MEMORY_TRANSIENT_RETENTION_DAYS || 45), 1);

const ISSUE_RULES = [
  { key: 'lagging_connection', label: 'Лагает связь', pattern: /\b(лагает|лаги|тормозит|фризит|зависает)\b/i },
  { key: 'poor_audio', label: 'Плохо слышно', pattern: /\b(плохо слышно|не слышно|пропадает звук|заикается звук|звук пропадает)\b/i },
  { key: 'poor_video_call', label: 'Проблема с видеозвонком', pattern: /\b(видеозвонок.*(лагает|тормозит)|звонок тормозит|связь плохая)\b/i }
];

const PREFERENCE_PATTERNS = [
  /\bпредпочитаю\s+([^.!?\n]{3,120})/i,
  /\bмне удобнее\s+([^.!?\n]{3,120})/i,
  /\bлучше\s+([^.!?\n]{3,120})/i,
  /\bхочу\s+([^.!?\n]{3,120})/i
];

const TRANSIENT_KEYS = new Set([
  'last_user_message',
  'last_issue',
  'last_action',
  'recent_actions',
  'recent_issues'
]);
const ALLOWED_MEMORY_KEYS = new Set([
  'last_user_message',
  'last_issue',
  'last_action',
  'recent_actions',
  'recent_issues',
  'preferences'
]);
const SHORT_CONFIRMATION_PATTERN = /^(?:\u0434\u0430|\u043e\u043a|\u043e\u043a\u0435\u0439|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u044e|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c|\u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0439|\u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0439|\u043e\u0442\u043c\u0435\u043d\u0430|\u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c|\u043d\u0435\u0442|\u0441\u0442\u043e\u043f)$/iu;

function isValidUserId(userId) {
  return mongoose.Types.ObjectId.isValid(String(userId || ''));
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(key) {
  return normalizeText(key);
}

function normalizeFingerprint(value) {
  return normalizeText(value).toLowerCase();
}

function buildEntryFingerprint(entry) {
  return normalizeFingerprint(
    entry?.fingerprint
    || entry?.key
    || entry?.label
    || entry?.text
    || entry?.action
  );
}

async function saveMemory(userId, key, value) {
  if (!isValidUserId(userId)) return null;

  const normalizedKey = normalizeKey(key);
  if (!normalizedKey || !ALLOWED_MEMORY_KEYS.has(normalizedKey)) return null;

  try {
    return await AiMemory.findOneAndUpdate(
      { userId, key: normalizedKey },
      {
        $set: {
          value,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    console.warn('[AI] memory save failed:', error?.message || error);
    return null;
  }
}

async function atomicUpsertListMemory(userId, key, item, limit) {
  if (!isValidUserId(userId)) return null;

  const normalizedKey = normalizeKey(key);
  const normalizedLimit = Math.max(Number(limit || 1), 1);
  if (!normalizedKey || !ALLOWED_MEMORY_KEYS.has(normalizedKey)) return null;

  const normalizedItem = {
    ...item,
    fingerprint: buildEntryFingerprint(item),
    updatedAt: item?.updatedAt || new Date().toISOString()
  };

  try {
    await AiMemory.updateOne(
      { userId, key: normalizedKey },
      [
        {
          $set: {
            updatedAt: '$$NOW',
            value: {
              $slice: [
                {
                  $concatArrays: [
                    [normalizedItem],
                    {
                      $filter: {
                        input: {
                          $cond: [
                            { $isArray: '$value' },
                            '$value',
                            []
                          ]
                        },
                        as: 'entry',
                        cond: {
                          $ne: [
                            {
                              $toLower: {
                                $trim: {
                                  input: {
                                    $ifNull: [
                                      '$$entry.fingerprint',
                                      {
                                        $ifNull: [
                                          '$$entry.key',
                                          {
                                            $ifNull: [
                                              '$$entry.label',
                                              {
                                                $ifNull: [
                                                  '$$entry.text',
                                                  { $ifNull: ['$$entry.action', ''] }
                                                ]
                                              }
                                            ]
                                          }
                                        ]
                                      }
                                    ]
                                  }
                                }
                              }
                            },
                            normalizedItem.fingerprint
                          ]
                        }
                      }
                    }
                  ]
                },
                normalizedLimit
              ]
            }
          }
        }
      ],
      { upsert: true }
    );
  } catch (error) {
    console.warn('[AI] atomic memory list update failed:', error?.message || error);
    return null;
  }

  try {
    return await AiMemory.findOne({ userId, key: normalizedKey }).lean();
  } catch (_) {
    return null;
  }
}

async function getMemory(userId) {
  if (!isValidUserId(userId)) return {};

  try {
    const docs = await AiMemory.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

    return docs.reduce((accumulator, doc) => {
      accumulator[doc.key] = doc.value;
      return accumulator;
    }, {});
  } catch (error) {
    console.warn('[AI] memory read failed:', error?.message || error);
    return {};
  }
}

function extractIssueEntries(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const issueRules = [
    { key: 'lagging_connection', label: 'Лагает связь', pattern: /\b(лагает|лаги|тормозит|фризит|зависает)\b/i },
    { key: 'poor_audio', label: 'Плохо слышно', pattern: /\b(плохо слышно|не слышно|пропадает звук|заикается звук|звук пропадает)\b/i },
    { key: 'poor_video_call', label: 'Проблема с видеозвонком', pattern: /\b(видеозвонок.*(лагает|тормозит)|звонок тормозит|связь плохая)\b/i }
  ];

  return issueRules
    .filter((rule) => rule.pattern.test(normalized))
    .map((rule) => ({
      key: rule.key,
      label: rule.label,
      text: normalized.slice(0, 200),
      fingerprint: normalizeFingerprint(rule.key),
      updatedAt: new Date().toISOString()
    }));
}

function extractPreferences(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const preferencePatterns = [
    /\bпредпочитаю\s+([^.!?\n]{3,120})/i,
    /\bмне удобнее\s+([^.!?\n]{3,120})/i,
    /\bлучше\s+([^.!?\n]{3,120})/i,
    /\bхочу\s+([^.!?\n]{3,120})/i
  ];

  return preferencePatterns
    .map((pattern) => pattern.exec(normalized)?.[1] || '')
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => ({
      key: value.toLowerCase(),
      text: value,
      fingerprint: normalizeFingerprint(value),
      updatedAt: new Date().toISOString()
    }));
}

async function rememberUserMessage({ userId, text }) {
  const normalized = normalizeText(text);
  if (!normalized || !isValidUserId(userId)) return;
  if (SHORT_CONFIRMATION_PATTERN.test(normalized)) return;

  await saveMemory(userId, 'last_user_message', normalized.slice(0, 1000));

  const issues = extractIssueEntries(normalized);
  for (const issue of issues) {
    await saveMemory(userId, 'last_issue', issue);
    await atomicUpsertListMemory(userId, 'recent_issues', issue, MAX_RECENT_ISSUES);
  }

  const preferences = extractPreferences(normalized);
  for (const preference of preferences) {
    await atomicUpsertListMemory(userId, 'preferences', preference, MAX_PREFERENCES);
  }
}

async function rememberAction({ userId, action, params, result, success = true }) {
  if (!isValidUserId(userId)) return;

  const normalizedAction = String(action || '').trim();
  const fingerprintBase = `${normalizedAction}:${Boolean(success)}:${normalizeText(result?.responseText || '').slice(0, 120)}`;
  const entry = {
    key: `${Date.now()}:${normalizedAction}:${success ? 'ok' : 'error'}`,
    action: normalizedAction,
    success: Boolean(success),
    params: params && typeof params === 'object' ? params : {},
    summary: normalizeText(result?.responseText || '').slice(0, 240),
    fingerprint: normalizeFingerprint(fingerprintBase),
    updatedAt: new Date().toISOString()
  };

  await saveMemory(userId, 'last_action', entry);
  await atomicUpsertListMemory(userId, 'recent_actions', entry, MAX_RECENT_ACTIONS);
}

function buildMemoryPrompt(memory) {
  if (!memory || typeof memory !== 'object') return '';

  const sections = [];
  const recentIssues = Array.isArray(memory.recent_issues)
    ? memory.recent_issues.map((entry) => entry?.label).filter(Boolean).slice(0, 3)
    : [];
  const preferences = Array.isArray(memory.preferences)
    ? memory.preferences.map((entry) => entry?.text).filter(Boolean).slice(0, 3)
    : [];
  const recentActions = Array.isArray(memory.recent_actions)
    ? memory.recent_actions.map((entry) => entry?.action).filter(Boolean).slice(0, 4)
    : [];

  if (memory.last_issue?.label) {
    sections.push(`Последняя известная проблема пользователя: ${memory.last_issue.label}.`);
  }
  if (recentIssues.length > 0) {
    sections.push(`Недавние проблемы: ${recentIssues.join('; ')}.`);
  }
  if (preferences.length > 0) {
    sections.push(`Предпочтения пользователя: ${preferences.join('; ')}.`);
  }
  if (recentActions.length > 0) {
    sections.push(`Недавние действия AI: ${recentActions.join(', ')}.`);
  }
  if (sections.length > 0) {
    return sections.join(' ').slice(0, MEMORY_PROMPT_MAX_LENGTH);
  }

  if (memory.last_issue?.label) {
    sections.push(`Последняя известная проблема пользователя: ${memory.last_issue.label}.`);
  }

  if (Array.isArray(memory.recent_issues) && memory.recent_issues.length > 0) {
    const issues = memory.recent_issues
      .map((entry) => entry?.label)
      .filter(Boolean)
      .slice(0, 3);
    if (issues.length > 0) {
      sections.push(`Недавние проблемы: ${issues.join('; ')}.`);
    }
  }

  if (Array.isArray(memory.preferences) && memory.preferences.length > 0) {
    const preferences = memory.preferences
      .map((entry) => entry?.text)
      .filter(Boolean)
      .slice(0, 3);
    if (preferences.length > 0) {
      sections.push(`Предпочтения пользователя: ${preferences.join('; ')}.`);
    }
  }

  if (Array.isArray(memory.recent_actions) && memory.recent_actions.length > 0) {
    const actions = memory.recent_actions
      .map((entry) => entry?.action)
      .filter(Boolean)
      .slice(0, 4);
    if (actions.length > 0) {
      sections.push(`Недавние действия AI: ${actions.join(', ')}.`);
    }
  }

  return sections.join(' ').slice(0, MEMORY_PROMPT_MAX_LENGTH);
}

async function cleanupAiMemory() {
  const cutoff = new Date(Date.now() - TRANSIENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    await AiMemory.deleteMany({
      key: { $in: Array.from(TRANSIENT_KEYS) },
      updatedAt: { $lt: cutoff }
    });
  } catch (error) {
    console.warn('[AI] memory cleanup failed:', error?.message || error);
  }
}

const memoryCleanupTimer = setInterval(cleanupAiMemory, CLEANUP_INTERVAL_MS);
memoryCleanupTimer.unref?.();

module.exports = {
  saveMemory,
  getMemory,
  rememberUserMessage,
  rememberAction,
  buildMemoryPrompt,
  cleanupAiMemory
};
