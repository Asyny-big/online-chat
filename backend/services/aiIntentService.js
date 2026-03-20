const mongoose = require('mongoose');

const CONNECTION_ISSUE_PATTERN = /\b(лагает|лаги|тормозит|плохо слышно|не слышно|звук пропадает|звонок тормозит|видеозвонок.*лагает|связь плохая|сокет.*отвали|realtime|socket)\b/i;
const SERVER_PERFORMANCE_PATTERN = /\b(почему тормозит сервер|сервер тормозит|сервер лагает|высокая нагрузка|медленный api|slow request|медленные запросы|backend тормозит)\b/i;
const CALL_ISSUE_PATTERN = /\b(звонок.*лагает|звонок.*тормозит|webrtc|turn|sfu|livekit|видео.*лагает|обрывается звонок)\b/i;
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
}

function isServerPerformanceText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return SERVER_PERFORMANCE_PATTERN.test(normalized);
}

function isCallIssueText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return CALL_ISSUE_PATTERN.test(normalized);
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

  return '';
}

function buildServerDiagnosticsPlan(issue) {
  return {
    type: 'actions',
    reason: 'server_diagnostics_shortcut',
    actions: [
      { action: 'system_diagnostics', params: {} },
      { action: 'analyze_slow_requests', params: {} },
      { action: 'check_realtime_health', params: {} },
      { action: 'check_calls_health', params: {} },
      { action: 'explain_issue', params: { issue } }
    ]
  };
}

function buildRealtimeDiagnosticsPlan(issue) {
  return {
    type: 'actions',
    reason: 'realtime_diagnostics_shortcut',
    actions: [
      { action: 'system_diagnostics', params: {} },
      { action: 'check_realtime_health', params: {} },
      { action: 'check_calls_health', params: {} },
      { action: 'explain_issue', params: { issue } }
    ]
  };
}

function resolveFallbackAiPlan({ text }) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  if (isServerPerformanceText(normalized)) {
    return buildServerDiagnosticsPlan(normalized);
  }

  if (isCallIssueText(normalized) || isConnectionIssueText(normalized)) {
    return buildRealtimeDiagnosticsPlan(normalized);
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

  return null;
}

function resolveSupportShortcut(text) {
  if (isServerPerformanceText(text)) {
    return buildServerDiagnosticsPlan(normalizeText(text));
  }

  if (isCallIssueText(text) || isConnectionIssueText(text)) {
    return buildRealtimeDiagnosticsPlan(normalizeText(text));
  }

  return null;
}

module.exports = {
  isConnectionIssueText,
  resolveFallbackAiPlan,
  resolveSupportShortcut
};
