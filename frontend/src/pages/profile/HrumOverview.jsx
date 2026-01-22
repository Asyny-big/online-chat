import React, { useMemo } from 'react';
import { useWallet } from '../../economy/EconomyStore';
import { HrumIcon } from '../../economy/hrumIcon';

function SkeletonNumber() {
  return (
    <div
      style={{
        width: 180,
        height: 18,
        borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
        backgroundSize: '200% 100%',
        animation: 'ppShimmer 1.15s ease-in-out infinite'
      }}
    />
  );
}

export default function HrumOverview({ onOpenHistory, onOpenShop, onOpenTasks }) {
  const wallet = useWallet();

  const balanceHrum = useMemo(() => String(wallet?.balanceHrum ?? '0'), [wallet?.balanceHrum]);
  const isLoading = wallet?.loading;

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap}>
            <HrumIcon size={20} />
          </div>
          <div>
            <div style={styles.kicker}>Экономика</div>
            <div style={styles.title}>Хрумы</div>
          </div>
        </div>
        <button type="button" onClick={wallet?.refresh} style={styles.ghostBtn} disabled={isLoading}>
          Обновить
        </button>
      </div>

      <div style={styles.balanceRow}>
        <div style={styles.balanceLeft}>
          <div style={styles.balanceLabel}>Текущий баланс</div>
          {isLoading ? (
            <SkeletonNumber />
          ) : (
            <div style={styles.balanceValue}>
              {balanceHrum}
              <span style={styles.balanceUnit}> Хрумов</span>
            </div>
          )}
          {wallet?.error ? <div style={styles.errorText}>{wallet.error}</div> : null}
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={onOpenHistory} style={styles.primaryBtn}>
            История
          </button>
          <button type="button" onClick={onOpenShop} style={styles.primaryBtn}>
            Магазин
          </button>
          <button type="button" onClick={onOpenTasks} style={styles.primaryBtn}>
            Задания
          </button>
        </div>
      </div>

      <div style={styles.hint}>
        Баланс приходит с backend и обновляется после наград/покупок. На фронте нет локальных пересчётов.
      </div>
    </div>
  );
}

const styles = {
  card: {
    borderRadius: 22,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.55)',
    boxShadow: '0 14px 40px rgba(0,0,0,0.38)',
    backdropFilter: 'blur(12px)',
    padding: 18
  },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.26), rgba(168,85,247,0.18))'
  },
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
  balanceRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' },
  balanceLeft: { minWidth: 280, display: 'flex', flexDirection: 'column', gap: 6 },
  balanceLabel: { color: '#94a3b8', fontWeight: 900, fontSize: 12 },
  balanceValue: { color: '#e2e8f0', fontWeight: 950, fontSize: 34, letterSpacing: 0.4, lineHeight: 1.05 },
  balanceUnit: { color: '#cbd5e1', fontWeight: 900, fontSize: 14 },
  errorText: { color: '#fca5a5', fontWeight: 900, fontSize: 12 },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  primaryBtn: {
    height: 42,
    padding: '0 14px',
    borderRadius: 14,
    border: '1px solid rgba(168,85,247,0.35)',
    background: 'linear-gradient(135deg, rgba(168,85,247,0.95), rgba(99,102,241,0.95))',
    color: '#fff',
    fontWeight: 950,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, filter 0.15s ease'
  },
  hint: { marginTop: 12, color: '#94a3b8', fontWeight: 800, fontSize: 12, lineHeight: 1.35 }
};

