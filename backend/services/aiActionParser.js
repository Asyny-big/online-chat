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
    const action = String(parsed?.action || '').trim();
    const params = parsed?.params && typeof parsed.params === 'object' && !Array.isArray(parsed.params)
      ? parsed.params
      : {};

    if (!action) {
      return {
        type: 'text',
        text
      };
    }

    return {
      type: 'action',
      action,
      params,
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
