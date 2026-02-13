import React, { useEffect, useRef } from 'react';

/**
 * IncomingCallScreen — fullscreen overlay for incoming calls.
 * Rendered by CallProvider at root level.
 * Works from ANY screen (chat, contacts, profile, etc).
 */

// Simple ringtone (Web Audio API)
function createRingtone() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        let isPlaying = false;
        let intervalId = null;

        const playTone = () => {
            if (!isPlaying) return;
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 440;
            osc.type = 'sine';
            gain.gain.value = 0.2;
            osc.start();
            setTimeout(() => { try { osc.stop(); } catch (_) { } }, 400);
        };

        return {
            play: () => {
                if (isPlaying) return;
                isPlaying = true;
                audioContext.resume();
                playTone();
                intervalId = setInterval(playTone, 1000);
            },
            stop: () => {
                isPlaying = false;
                if (intervalId) { clearInterval(intervalId); intervalId = null; }
            }
        };
    } catch (_) {
        return { play: () => { }, stop: () => { } };
    }
}

function IncomingCallScreen({
    callerName,
    callerAvatar,
    callType,
    isGroup,
    initiatorName,
    onAccept,
    onDecline,
}) {
    const ringtoneRef = useRef(null);

    useEffect(() => {
        ringtoneRef.current = createRingtone();
        ringtoneRef.current.play();
        return () => {
            ringtoneRef.current?.stop();
        };
    }, []);

    const handleAccept = () => {
        ringtoneRef.current?.stop();
        onAccept?.();
    };

    const handleDecline = () => {
        ringtoneRef.current?.stop();
        onDecline?.();
    };

    const initial = String(callerName || '?').trim().charAt(0).toUpperCase();
    const subtitle = isGroup
        ? `Входящий групповой ${callType === 'video' ? 'видео' : ''}звонок${initiatorName ? ` · ${initiatorName}` : ''}`
        : `Входящий ${callType === 'video' ? 'видео' : 'аудио'}звонок`;

    return (
        <div style={styles.overlay}>
            <div style={styles.content}>
                {/* Animated rings */}
                <div style={styles.ringsWrap}>
                    <div style={{ ...styles.ring, ...styles.ring1 }} />
                    <div style={{ ...styles.ring, ...styles.ring2 }} />
                    <div style={{ ...styles.ring, ...styles.ring3 }} />
                    <div style={styles.avatar}>
                        {callerAvatar
                            ? <img src={callerAvatar} alt="" style={styles.avatarImg} />
                            : <span style={styles.avatarInitial}>{isGroup ? '👥' : initial}</span>
                        }
                    </div>
                </div>

                <h2 style={styles.name}>{callerName}</h2>
                <p style={styles.subtitle}>{subtitle}</p>

                <div style={styles.actions}>
                    <button style={styles.declineBtn} onClick={handleDecline} title="Отклонить">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                    </button>
                    <button style={styles.acceptBtn} onClick={handleAccept} title="Принять">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {callType === 'video' ? (
                                <>
                                    <polygon points="23 7 16 12 23 17 23 7" />
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                </>
                            ) : (
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            )}
                        </svg>
                    </button>
                </div>
            </div>

            <style>{CSS}</style>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
        fontFamily: 'sans-serif',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
    },
    ringsWrap: {
        position: 'relative',
        width: '140px',
        height: '140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
    },
    ring: {
        position: 'absolute',
        borderRadius: '50%',
        border: '2px solid rgba(88, 101, 242, 0.6)',
        opacity: 0,
    },
    ring1: { width: '100%', height: '100%', animation: 'ic-pulse 2s infinite 0s' },
    ring2: { width: '130%', height: '130%', animation: 'ic-pulse 2s infinite 0.5s' },
    ring3: { width: '160%', height: '160%', animation: 'ic-pulse 2s infinite 1s' },
    avatar: {
        position: 'relative',
        zIndex: 2,
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #5865f2, #7c3aed)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 40px rgba(88, 101, 242, 0.4)',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'cover',
    },
    avatarInitial: {
        color: '#fff',
        fontSize: '40px',
        fontWeight: '700',
    },
    name: {
        color: '#fff',
        fontSize: '26px',
        fontWeight: '600',
        margin: '0 0 8px',
        textAlign: 'center',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: '15px',
        margin: '0 0 48px',
        textAlign: 'center',
    },
    actions: {
        display: 'flex',
        gap: '48px',
        alignItems: 'center',
    },
    declineBtn: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        border: 'none',
        background: '#ed4245',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s',
        boxShadow: '0 4px 20px rgba(237, 66, 69, 0.4)',
    },
    acceptBtn: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        border: 'none',
        background: '#3ba55c',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s',
        boxShadow: '0 4px 20px rgba(59, 165, 92, 0.4)',
        animation: 'ic-btn-pulse 1.5s infinite',
    },
};

const CSS = `
@keyframes ic-pulse {
  0% { opacity: 0.8; transform: scale(0.8); }
  100% { opacity: 0; transform: scale(1.1); }
}
@keyframes ic-btn-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
`;

export default IncomingCallScreen;
