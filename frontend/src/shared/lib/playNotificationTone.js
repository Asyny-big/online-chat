let audioContextInstance = null;
let unlockListenersAttached = false;

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

export function playNotificationTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') return;

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
