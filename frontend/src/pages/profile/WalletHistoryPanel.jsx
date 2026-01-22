import React, { useEffect } from 'react';
import { useTransactions } from '../../economy/EconomyStore';
import { HrumIcon } from '../../economy/hrumIcon';

function formatTxDate(value) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function txLabel(reasonCode, meta) {
  const code = String(reasonCode || '');
  if (code === 'earn:daily_login') return 'Ежедневный вход';
  if (code === 'earn:message') return 'Награда за сообщение';
  if (code === 'earn:call_start') return 'Награда за звонок';
  if (code === 'earn:task') return meta?.taskId ? `Задание: ${meta.taskId}` : 'Задание';
  if (code === 'spend:shop') return meta?.sku ? `Покупка: ${meta.sku}` : 'Покупка в магазине';
  return code || '—';
}

function splitDelta(deltaHrum) {
  const raw = String(deltaHrum ?? '').trim();
  if (!raw) return { sign: '+', abs: '0', isSpend: false };
  if (raw.startsWith('-')) return { sign: '−', abs: raw.slice(1), isSpend: true };
  if (raw.startsWith('+')) return { sign: '+', abs: raw.slice(1), isSpend: false };
  return { sign: '+', abs: raw, isSpend: false };
}

function SkeletonRow() {
  return (
    <div style={styles.row}>
      <div style={styles.skelAmt} />
      <div style={styles.skelLine} />
    </div>
  );
}

export default function WalletHistoryPanel() {
  const tx = useTransactions();

  useEffect(() => {
    if (tx.items.length === 0 && !tx.loading && !tx.error) tx.refresh();
  }, [tx]);

  return (
    <div className="pp-card" style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap} aria-hidden="true">
            <span style={styles.iconGlyph}>≋</span>
          </div>
          <div>
            <div style={styles.kicker}>Ledger</div>
            <div style={styles.title}>История операций</div>
          </div>
        </div>
        <button type="button" onClick={tx.refresh} className="pp-btn" style={styles.ghostBtn} disabled={tx.loading}>
          Обновить
        </button>
      </div>

      {tx.loading && tx.items.length === 0 ? (
        <div style={styles.list}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : tx.error ? (
        <div style={styles.errorBox}>
          <div style={styles.errorTitle}>Не удалось загрузить историю</div>
          <button type="button" onClick={tx.refresh} style={styles.primaryBtn}>
            Повторить
          </button>
        </div>
      ) : tx.items.length === 0 ? (
        <div style={styles.emptyBox}>Операций пока нет</div>
      ) : (
        <div style={styles.list}>
          {tx.items.map((t) => {
            const { sign, abs, isSpend } = splitDelta(t?.deltaHrum);
            return (
              <div key={t?.id || `${t?.createdAt}-${t?.deltaHrum}`} style={styles.row}>
                <div style={{ ...styles.amount, ...(isSpend ? styles.amountSpend : styles.amountEarn) }}>
                  {sign}
                  {abs}{' '}
                  <span style={styles.amountUnit}>
                    <HrumIcon size={14} style={{ marginRight: 6, opacity: 0.95 }} />
                    Хрумы
                  </span>
                </div>
                <div style={styles.main}>
                  <div style={styles.reason}>{txLabel(t?.reasonCode, t?.meta)}</div>
                  <div style={styles.date}>{formatTxDate(t?.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const shimmer = {
  background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
  backgroundSize: '200% 100%',
  animation: 'ppShimmer 1.15s ease-in-out infinite'
};

const styles = {
  card: {
    marginTop: 16,
    borderRadius: 26,
    border: '1px solid var(--pp-border)',
    background: 'var(--pp-glass)',
    boxShadow: 'var(--pp-shadow)',
    backdropFilter: 'blur(14px)',
    padding: 18
  },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  titleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'linear-gradient(135deg, rgba(148,163,184,0.18), rgba(99,102,241,0.14))',
    color: '#e2e8f0',
    fontWeight: 950
  },
  iconGlyph: { fontSize: 16, filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.35))' },
  kicker: { color: '#94a3b8', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#e2e8f0', fontWeight: 950, fontSize: 18, letterSpacing: 0.2 },
  ghostBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(2,6,23,0.35)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 900
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.24)'
  },
  amount: { fontWeight: 950, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  amountEarn: { color: '#22c55e' },
  amountSpend: { color: '#ef4444' },
  amountUnit: { color: '#cbd5e1', fontWeight: 900, fontSize: 12, display: 'inline-flex', alignItems: 'center' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' },
  reason: { color: '#e2e8f0', fontWeight: 850, fontSize: 12, textAlign: 'right', wordBreak: 'break-word' },
  date: { color: '#94a3b8', fontWeight: 750, fontSize: 11 },

  errorBox: {
    borderRadius: 18,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.08)',
    padding: 14,
    color: '#fecaca',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  errorTitle: { fontWeight: 950 },
  primaryBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(168,85,247,0.35)',
    background: 'linear-gradient(135deg, rgba(168,85,247,0.95), rgba(99,102,241,0.95))',
    color: '#fff',
    fontWeight: 950,
    cursor: 'pointer'
  },
  emptyBox: {
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,6,23,0.18)',
    padding: 14,
    color: '#94a3b8',
    fontWeight: 900,
    fontSize: 12
  },

  skelAmt: { width: 140, height: 12, borderRadius: 999, ...shimmer },
  skelLine: { width: 210, height: 12, borderRadius: 999, ...shimmer }
};
