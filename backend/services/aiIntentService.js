const mongoose = require('mongoose');

const CONNECTION_ISSUE_PATTERN = /\b(лагает|лаги|тормозит|плохо слышно|не слышно|звук пропадает|звонок тормозит|видеозвонок.*лагает|связь плохая)\b/i;
const GROUP_NAME_QUOTED_PATTERN = /[«"]([^"»]{2,80})[»"]/;
const GROUP_NAME_NAMED_PATTERN = /\b(?:группу|группа)\s+(?:для|под|с названием)\s+([^.!?\n]{2,80})/i;
const CAPABILITIES_PATTERN = /\b(что ты умеешь|твои возможности|capabilities)\b/i;
const CHAT_LIST_PATTERN = /\b(мои чаты|покажи чаты|какие у меня чаты|список чатов)\b/i;
const CREATE_GROUP_PATTERN = /\b(создай|сделай)\b.*\bгрупп/i;
const START_CALL_PATTERN = /\b(позвони|начни звонок|созвонись)\b/i;

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isConnectionIssueText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return CONNECTION_ISSUE_PATTERN.test(normalized);

  return /\b(лагает|лаги|тормозит|плохо слышно|не слышно|звук пропадает|звонок тормозит|видеозвонок.*лагает|связь плохая)\b/i
    .test(normalized);
}

function extractGroupName(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  const normalizedQuoted = normalized.match(GROUP_NAME_QUOTED_PATTERN);
  if (normalizedQuoted?.[1]) {
    return normalizedQuoted[1].trim();
  }

  const normalizedNamed = normalized.match(GROUP_NAME_NAMED_PATTERN);
  if (normalizedNamed?.[1]) {
    return normalizedNamed[1].trim();
  }

  const quoted = normalized.match(/[«"]([^"»]{2,80})[»"]/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const named = normalized.match(/\b(?:группу|группа)\s+(?:для|под|с названием)\s+([^.!?\n]{2,80})/i);
  if (named?.[1]) {
    return named[1].trim();
  }

  return '';
}

function resolveFallbackAiPlan({ text }) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  if (isConnectionIssueText(normalized)) {
    return {
      type: 'actions',
      reason: 'connection_support_fallback',
      actions: [
        { action: 'get_server_status', params: {} },
        { action: 'suggest_fix_connection', params: { usePreviousServerStatus: true } }
      ]
    };
  }

  if (CAPABILITIES_PATTERN.test(normalized)) {
    return {
      type: 'action',
      reason: 'capabilities_fallback',
      action: 'explain_feature',
      params: { feature: 'capabilities' }
    };
  }

  if (CHAT_LIST_PATTERN.test(normalized)) {
    return {
      type: 'action',
      reason: 'chat_list_fallback',
      action: 'get_user_chats',
      params: {}
    };
  }

  if (CREATE_GROUP_PATTERN.test(normalized)) {
    const name = extractGroupName(normalized);
    if (name) {
      return {
        type: 'action',
        reason: 'create_group_fallback',
        action: 'create_group',
        params: { name }
      };
    }
  }

  const explicitUserId = normalized.match(/\b[0-9a-f]{24}\b/i)?.[0] || '';
  if (START_CALL_PATTERN.test(normalized) && mongoose.Types.ObjectId.isValid(explicitUserId)) {
    return {
      type: 'action',
      reason: 'start_call_fallback',
      action: 'start_call',
      params: { userId: explicitUserId }
    };
  }

  if (/\b(что ты умеешь|твои возможности|capabilities)\b/i.test(normalized)) {
    return {
      type: 'action',
      reason: 'capabilities_fallback',
      action: 'explain_feature',
      params: { feature: 'capabilities' }
    };
  }

  if (/\b(мои чаты|покажи чаты|какие у меня чаты|список чатов)\b/i.test(normalized)) {
    return {
      type: 'action',
      reason: 'chat_list_fallback',
      action: 'get_user_chats',
      params: {}
    };
  }

  if (/\b(создай|сделай)\b.*\bгрупп/i.test(normalized)) {
    const name = extractGroupName(normalized);
    if (name) {
      return {
        type: 'action',
        reason: 'create_group_fallback',
        action: 'create_group',
        params: { name }
      };
    }
  }

  const legacyExplicitUserId = normalized.match(/\b[0-9a-f]{24}\b/i)?.[0] || '';
  if (/\b(позвони|начни звонок|созвонись)\b/i.test(normalized) && mongoose.Types.ObjectId.isValid(legacyExplicitUserId)) {
    return {
      type: 'action',
      reason: 'start_call_fallback',
      action: 'start_call',
      params: { userId: legacyExplicitUserId }
    };
  }

  return null;
}

function resolveSupportShortcut(text) {
  if (!isConnectionIssueText(text)) {
    return null;
  }

  return {
    type: 'actions',
    reason: 'smart_support_shortcut',
    actions: [
      { action: 'get_server_status', params: {} },
      { action: 'suggest_fix_connection', params: { usePreviousServerStatus: true } }
    ]
  };
}

module.exports = {
  isConnectionIssueText,
  resolveFallbackAiPlan,
  resolveSupportShortcut
};
