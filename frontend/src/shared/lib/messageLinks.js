const MESSAGE_LINK_REGEX = /https?:\/\/[^\s<>()]+|(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>()]*)?/gi;
const TRAILING_PUNCTUATION = new Set(['.', ',', '!', '?', ':', ';', ')', ']', '}', '"', '\'', '»']);

function trimTrailingPunctuation(value) {
  let end = value.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(value[end - 1])) {
    end -= 1;
  }
  return value.slice(0, end);
}

function normalizeLinkHref(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseMessageTextParts(text) {
  const source = String(text || '');
  if (!source) return [];

  const parts = [];
  let lastIndex = 0;

  for (const match of source.matchAll(MESSAGE_LINK_REGEX)) {
    const rawMatch = String(match[0] || '');
    const matchIndex = Number(match.index);
    if (!rawMatch || !Number.isInteger(matchIndex) || matchIndex < lastIndex) continue;

    const previousChar = source[matchIndex - 1] || '';
    if (previousChar === '@') continue;

    const visibleText = trimTrailingPunctuation(rawMatch);
    if (!visibleText) continue;

    const normalizedHref = normalizeLinkHref(visibleText);
    const visibleEnd = matchIndex + visibleText.length;

    if (matchIndex > lastIndex) {
      parts.push({
        type: 'text',
        text: source.slice(lastIndex, matchIndex)
      });
    }

    parts.push({
      type: 'link',
      text: visibleText,
      href: normalizedHref
    });

    lastIndex = visibleEnd;
  }

  if (lastIndex < source.length) {
    parts.push({
      type: 'text',
      text: source.slice(lastIndex)
    });
  }

  if (parts.length === 0) {
    return [{ type: 'text', text: source }];
  }

  return parts;
}

