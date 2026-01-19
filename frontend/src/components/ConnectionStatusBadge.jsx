import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function pickSelectedCandidatePair(statsMap) {
  // candidate-pair: selected (Chrome) / nominated (some impl)
  const pairs = [];
  statsMap.forEach((s) => {
    if (s && s.type === 'candidate-pair') pairs.push(s);
  });

  const selected = pairs.find((p) => p?.selected) || pairs.find((p) => p?.nominated && p?.state === 'succeeded');
  if (selected) return selected;

  // fallback: best succeeded with highest bytesSent/bytesReceived
  const succeeded = pairs.filter((p) => p?.state === 'succeeded');
  if (succeeded.length === 0) return null;

  succeeded.sort((a, b) => {
    const aScore = (a?.bytesSent || 0) + (a?.bytesReceived || 0);
    const bScore = (b?.bytesSent || 0) + (b?.bytesReceived || 0);
    return bScore - aScore;
  });
  return succeeded[0] || null;
}

function toMs(sec) {
  if (typeof sec !== 'number' || !Number.isFinite(sec)) return null;
  return Math.round(sec * 1000);
}

function safeStr(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

function getConnectionModeLabel({ connectionKind, isRelay }) {
  // connectionKind = 'p2p' | 'sfu'
  if (connectionKind === 'sfu') return { label: 'SFU', color: '#60a5fa', dot: '🔵' };
  if (isRelay) return { label: 'TURN', color: '#f59e0b', dot: '🟡' };
  return { label: 'P2P', color: '#22c55e', dot: '🟢' };
}

const cardStyles = {
  row: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, lineHeight: 1.4 },
  key: { color: 'rgba(255,255,255,0.70)' },
  val: { color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }
};

const ConnectionStatusBadge = React.memo(function ConnectionStatusBadge({
  getPeerConnection,
  connectionKind,
  placement = 'top-right'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshot, setSnapshot] = useState({
    iceConnectionState: null,
    connectionState: null,
    rttMs: null,
    localCandidateType: null,
    remoteCandidateType: null,
    localProtocol: null,
    remoteProtocol: null,
    localAddress: null,
    remoteAddress: null,
    isRelay: false,
    updatedAt: null
  });

  const intervalRef = useRef(null);

  const poll = useCallback(async () => {
    const pc = typeof getPeerConnection === 'function' ? getPeerConnection() : null;
    if (!pc || typeof pc.getStats !== 'function') {
      setSnapshot((prev) => ({
        ...prev,
        iceConnectionState: pc?.iceConnectionState || null,
        connectionState: pc?.connectionState || null,
        updatedAt: Date.now()
      }));
      return;
    }

    const report = await pc.getStats();
    const statsMap = new Map();
    report.forEach((v, k) => statsMap.set(k, v));

    const pair = pickSelectedCandidatePair(statsMap);
    const localCand = pair?.localCandidateId ? statsMap.get(pair.localCandidateId) : null;
    const remoteCand = pair?.remoteCandidateId ? statsMap.get(pair.remoteCandidateId) : null;

    const localType = localCand?.candidateType || null;
    const remoteType = remoteCand?.candidateType || null;
    const localProtocol = localCand?.protocol || null;
    const remoteProtocol = remoteCand?.protocol || null;

    const isRelay = localType === 'relay' || remoteType === 'relay';

    setSnapshot({
      iceConnectionState: pc.iceConnectionState || null,
      connectionState: pc.connectionState || null,
      rttMs: toMs(pair?.currentRoundTripTime),
      localCandidateType: localType,
      remoteCandidateType: remoteType,
      localProtocol,
      remoteProtocol,
      localAddress: localCand?.address || localCand?.ip || null,
      remoteAddress: remoteCand?.address || remoteCand?.ip || null,
      isRelay,
      updatedAt: Date.now()
    });
  }, [getPeerConnection]);

  useEffect(() => {
    // Всегда лёгкий polling раз в 2с (stats не тяжёлые), чтобы бейдж был актуален.
    // При закрытой панели UI не засоряем рендерами: обновление state всё равно нужно для цвета/лейбла.
    intervalRef.current = setInterval(() => {
      poll().catch(() => {});
    }, 2000);

    // Первое обновление сразу
    poll().catch(() => {});

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [poll]);

  const mode = useMemo(() => {
    return getConnectionModeLabel({ connectionKind, isRelay: snapshot.isRelay });
  }, [connectionKind, snapshot.isRelay]);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const containerPos = useMemo(() => {
    // Не мешает видео: чуть отступаем от safe-area.
    const base = {
      position: 'absolute',
      zIndex: 30,
      pointerEvents: 'auto'
    };

    if (placement === 'top-left') return { ...base, top: '12px', left: '12px' };
    if (placement === 'bottom-left') return { ...base, bottom: '12px', left: '12px' };
    if (placement === 'bottom-right') return { ...base, bottom: '12px', right: '12px' };
    return { ...base, top: '12px', right: '12px' };
  }, [placement]);

  return (
    <div style={containerPos}>
      <button
        type="button"
        onClick={toggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer'
        }}
        title="Статус соединения"
      >
        <span aria-hidden style={{ fontSize: 13 }}>{mode.dot}</span>
        <span>{mode.label}</span>
        <span aria-hidden style={{ opacity: 0.75 }}>{isOpen ? '▾' : '▸'}</span>
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: 10,
            width: 320,
            maxWidth: 'min(320px, calc(100vw - 24px))',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(10, 12, 20, 0.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 14px 50px rgba(0,0,0,0.45)',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
                📡 Соединение
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 800,
                color: mode.color
              }}>
                {mode.label}
              </div>
            </div>
          </div>

          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>ICE</div>
              <div style={cardStyles.val}>{safeStr(snapshot.iceConnectionState || '—')}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>PC state</div>
              <div style={cardStyles.val}>{safeStr(snapshot.connectionState || '—')}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>RTT</div>
              <div style={cardStyles.val}>{snapshot.rttMs != null ? `${snapshot.rttMs} ms` : '—'}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>Transport</div>
              <div style={cardStyles.val}>{safeStr(snapshot.localProtocol || snapshot.remoteProtocol || '—')}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>Local cand</div>
              <div style={cardStyles.val}>{safeStr(snapshot.localCandidateType || '—')}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>Remote cand</div>
              <div style={cardStyles.val}>{safeStr(snapshot.remoteCandidateType || '—')}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>Local addr</div>
              <div style={cardStyles.val}>{safeStr(snapshot.localAddress || '—')}</div>
            </div>
            <div style={cardStyles.row}>
              <div style={cardStyles.key}>Remote addr</div>
              <div style={cardStyles.val}>{safeStr(snapshot.remoteAddress || '—')}</div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              {snapshot.updatedAt ? `обновлено: ${new Date(snapshot.updatedAt).toLocaleTimeString()}` : ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ConnectionStatusBadge;
