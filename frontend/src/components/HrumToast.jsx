import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { HrumIcon } from '@/economy/hrumIcon';

const HrumToastContext = createContext(null);

function normalizeAmount(amountHrum) {
  const raw = String(amountHrum ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('+')) return raw.slice(1);
  if (raw.startsWith('-')) return raw;
  return raw;
}

export function HrumToastProvider({ children }) {
  const [toast, setToast] = useState(null); // { kind, message, amount, ts, ttlMs }
  const hideTimerRef = useRef(null);
  const lastMergedAtRef = useRef(0);
  const seenTxIdsRef = useRef(new Set());

  const hide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (next) => {
      const ttlMs = Math.min(Math.max(Number(next?.ttlMs) || 2500, 1500), 5000);

      setToast((prev) => {
        const now = Date.now();
        const canMerge = prev && prev.kind === next.kind && now - lastMergedAtRef.current < 2500;
        if (canMerge) {
          lastMergedAtRef.current = now;
          return { ...prev, ...next, ttlMs, ts: now };
        }
        lastMergedAtRef.current = now;
        return { ...next, ttlMs, ts: now };
      });

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => hide(), ttlMs);
    },
    [hide]
  );

  const showEarn = useCallback(
    ({ amountHrum, txId }) => {
      const amount = normalizeAmount(amountHrum);
      if (!amount) return;
      if (txId) {
        const id = String(txId);
        if (seenTxIdsRef.current.has(id)) return;
        seenTxIdsRef.current.add(id);
      }
      show({ kind: 'hrum_earn', amount });
    },
    [show]
  );

  const showInfo = useCallback((message) => {
    const msg = String(message ?? '').trim();
    if (!msg) return;
    show({ kind: 'info', message: msg });
  }, [show]);

  const showError = useCallback((message) => {
    const msg = String(message ?? '').trim();
    if (!msg) return;
    show({ kind: 'error', message: msg, ttlMs: 3000 });
  }, [show]);

  const value = useMemo(() => ({ showEarn, showInfo, showError, hide }), [showEarn, showInfo, showError, hide]);

  return (
    <HrumToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView toast={toast} onClose={hide} /> : null}
    </HrumToastContext.Provider>
  );
}

export function useHrumToast() {
  const ctx = useContext(HrumToastContext);
  if (!ctx) throw new Error('useHrumToast must be used within HrumToastProvider');
  return ctx;
}

function ToastView({ toast, onClose }) {
  const isEarn = toast.kind === 'hrum_earn';
  const isError = toast.kind === 'error';
  const isInfo = toast.kind === 'info';

  const content = isEarn ? (
    <span style={toastStyles.row}>
      <HrumIcon size={18} />
      <span style={toastStyles.text}>+{toast.amount} Хрумы</span>
    </span>
  ) : (
    <span style={toastStyles.row}>
      <HrumIcon size={18} style={{ filter: isError ? 'grayscale(0.1) brightness(1.05)' : undefined }} />
      <span style={toastStyles.text}>{toast.message}</span>
    </span>
  );

  return (
    <div style={toastStyles.wrap} role="status" aria-live="polite" onClick={onClose}>
      <div style={{ ...toastStyles.card, ...(isError ? toastStyles.cardError : null) }}>{content}</div>
    </div>
  );
}

const toastStyles = {
  wrap: {
    position: 'fixed',
    left: '50%',
    bottom: 22,
    transform: 'translateX(-50%)',
    zIndex: 100000,
    pointerEvents: 'auto',
    cursor: 'pointer'
  },
  card: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.92)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
    backdropFilter: 'blur(14px) saturate(180%)'
  },
  cardError: {
    border: '1px solid rgba(239, 68, 68, 0.35)',
    background: 'rgba(127, 29, 29, 0.32)'
  },
  row: { display: 'inline-flex', alignItems: 'center', gap: 10 },
  text: { color: '#e2e8f0', fontWeight: 800, fontSize: 14, letterSpacing: 0.1 },
  dot: { width: 10, height: 10, borderRadius: 999, background: 'rgba(148,163,184,0.8)' },
  dotError: { background: '#ef4444' },
  dotInfo: { background: '#60a5fa' }
};
