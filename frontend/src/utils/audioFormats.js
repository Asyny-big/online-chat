const AUDIO_RECORDING_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
  'audio/webm',
  'audio/ogg'
];

function normalizeAudioMimeType(value = '') {
  return String(value || '').trim().toLowerCase();
}

function createAudioProbeElement() {
  if (typeof document === 'undefined') return null;
  try {
    return document.createElement('audio');
  } catch (_) {
    return null;
  }
}

export function getAudioMimeCandidates(mimeType = '', sourceUrl = '') {
  const normalizedMimeType = normalizeAudioMimeType(mimeType);
  const normalizedUrl = String(sourceUrl || '').trim().toLowerCase();
  const candidates = [];

  const pushCandidate = (value) => {
    const normalized = normalizeAudioMimeType(value);
    if (!normalized) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  pushCandidate(normalizedMimeType);

  if (normalizedMimeType.startsWith('audio/webm')) {
    pushCandidate('audio/webm;codecs=opus');
    pushCandidate('audio/webm');
  }

  if (normalizedMimeType.startsWith('audio/ogg') || normalizedMimeType === 'audio/opus') {
    pushCandidate('audio/ogg;codecs=opus');
    pushCandidate('audio/ogg');
    pushCandidate('audio/opus');
  }

  if (normalizedMimeType.startsWith('audio/mp4') || normalizedMimeType === 'audio/m4a' || normalizedMimeType === 'audio/x-m4a') {
    pushCandidate('audio/mp4;codecs=mp4a.40.2');
    pushCandidate('audio/mp4');
  }

  if (normalizedMimeType === 'audio/mp3' || normalizedMimeType === 'audio/x-mp3' || normalizedMimeType === 'audio/mpeg') {
    pushCandidate('audio/mpeg');
  }

  if (normalizedUrl.endsWith('.m4a') || normalizedUrl.endsWith('.mp4')) {
    pushCandidate('audio/mp4;codecs=mp4a.40.2');
    pushCandidate('audio/mp4');
  }
  if (normalizedUrl.endsWith('.webm')) {
    pushCandidate('audio/webm;codecs=opus');
    pushCandidate('audio/webm');
  }
  if (normalizedUrl.endsWith('.ogg') || normalizedUrl.endsWith('.oga') || normalizedUrl.endsWith('.opus')) {
    pushCandidate('audio/ogg;codecs=opus');
    pushCandidate('audio/ogg');
    pushCandidate('audio/opus');
  }
  if (normalizedUrl.endsWith('.mp3')) {
    pushCandidate('audio/mpeg');
  }
  if (normalizedUrl.endsWith('.wav')) {
    pushCandidate('audio/wav');
  }

  return candidates;
}

export function getPreferredPlayableAudioMimeType(mimeType = '', sourceUrl = '') {
  const audio = createAudioProbeElement();
  if (!audio || typeof audio.canPlayType !== 'function') return '';

  const candidates = getAudioMimeCandidates(mimeType, sourceUrl);
  for (const candidate of candidates) {
    try {
      const support = audio.canPlayType(candidate);
      if (support === 'probably' || support === 'maybe') {
        return candidate;
      }
    } catch (_) {
      // Ignore probe failures and keep trying the next candidate.
    }
  }

  return '';
}

export function pickSupportedAudioRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  let firstSupportedMimeType = '';
  for (const candidate of AUDIO_RECORDING_CANDIDATES) {
    try {
      if (!MediaRecorder.isTypeSupported(candidate)) continue;
      if (!firstSupportedMimeType) {
        firstSupportedMimeType = candidate;
      }

      const playableMimeType = getPreferredPlayableAudioMimeType(candidate);
      if (playableMimeType) {
        return candidate;
      }
    } catch (_) {
      // Ignore capability probe failures and keep trying the next candidate.
    }
  }

  return firstSupportedMimeType;
}

export function getAudioFileExtensionFromMimeType(mimeType = '') {
  const normalizedMimeType = normalizeAudioMimeType(mimeType);
  if (normalizedMimeType.includes('ogg') || normalizedMimeType.includes('opus')) return '.ogg';
  if (normalizedMimeType.includes('mp4') || normalizedMimeType.includes('m4a')) return '.m4a';
  if (normalizedMimeType.includes('mpeg') || normalizedMimeType.includes('mp3')) return '.mp3';
  if (normalizedMimeType.includes('wav')) return '.wav';
  return '.webm';
}
