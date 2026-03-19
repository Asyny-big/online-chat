function extractJsonCandidate(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  const fencedMatch = normalized.match(/```json\s*([\s\S]*?)\s*```/i)
    || normalized.match(/```\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  if (normalized.startsWith('{') && normalized.endsWith('}')) {
    return normalized;
  }

  const firstBrace = normalized.indexOf('{');
  const lastBrace = normalized.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return normalized.slice(firstBrace, lastBrace + 1).trim();
  }

  return null;
}

function normalizeParams(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) return [];

  return actions
    .map((step) => {
      const action = String(step?.action || '').trim();
      if (!action) return null;

      return {
        action,
        params: normalizeParams(step?.params)
      };
    })
    .filter(Boolean);
}

function parseAiAction(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return {
      type: 'text',
      text: ''
    };
  }

  const candidate = extractJsonCandidate(text);
  if (!candidate) {
    return {
      type: 'text',
      text
    };
  }

  try {
    const parsed = JSON.parse(candidate);
    const actions = normalizeActions(parsed?.actions);
    if (actions.length > 0) {
      return {
        type: 'actions',
        actions,
        rawText: text
      };
    }

    const action = String(parsed?.action || '').trim();
    if (!action) {
      return {
        type: 'text',
        text
      };
    }

    return {
      type: 'action',
      action,
      params: normalizeParams(parsed?.params),
      rawText: text
    };
  } catch (_) {
    return {
      type: 'text',
      text
    };
  }
}

module.exports = {
  parseAiAction
};
