let audioContextInstance = null;
let unlockListenersAttached = false;
const lastToneAtByKey = new Map();

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  if (!audioContextInstance) {
    audioContextInstance = new Ctx();
  }

  return audioContextInstance;
}

function tryResumeAudioContext() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function canPlayTone(key, minIntervalMs) {
  const now = Date.now();
  const normalizedKey = String(key || 'default');
  const lastPlayedAt = Number(lastToneAtByKey.get(normalizedKey) || 0);

  if (minIntervalMs > 0 && now - lastPlayedAt < minIntervalMs) {
    return false;
  }

  lastToneAtByKey.set(normalizedKey, now);
  return true;
}

function playMessageTone(ctx) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  const oscOne = ctx.createOscillator();
  oscOne.type = 'sine';
  oscOne.frequency.setValueAtTime(880, now);
  oscOne.frequency.exponentialRampToValueAtTime(1100, now + 0.08);
  oscOne.connect(gain);
  oscOne.start(now);
  oscOne.stop(now + 0.09);

  const oscTwo = ctx.createOscillator();
  oscTwo.type = 'triangle';
  oscTwo.frequency.setValueAtTime(1320, now + 0.09);
  oscTwo.connect(gain);
  oscTwo.start(now + 0.09);
  oscTwo.stop(now + 0.18);
}

function playIncomingCallSynth(ctx) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.085, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

  const noteOffsets = [0, 0.22, 0.44];
  const frequencies = [740, 988, 740];

  noteOffsets.forEach((offset, index) => {
    const osc = ctx.createOscillator();
    osc.type = index % 2 === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequencies[index], now + offset);
    osc.connect(gain);
    osc.start(now + offset);
    osc.stop(now + offset + 0.16);
  });
}

export function initNotificationSound() {
  if (typeof window === 'undefined' || unlockListenersAttached) return;

  unlockListenersAttached = true;

  const unlock = () => {
    tryResumeAudioContext();
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    }
  };

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
}

export function playNotificationTone(options = {}) {
  const {
    key = 'message',
    minIntervalMs = 900,
    variant = 'message'
  } = options;

  if (!canPlayTone(key, minIntervalMs)) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') return false;

  if (variant === 'incoming-call') {
    playIncomingCallSynth(ctx);
  } else {
    playMessageTone(ctx);
  }

  return true;
}

export function playIncomingCallTone(options = {}) {
  return playNotificationTone({
    key: 'incoming-call',
    minIntervalMs: 2500,
    variant: 'incoming-call',
    ...options
  });
}
