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
    <div className="pp-card" style={styles.card}>
      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.topRow}>
            <div style={styles.titleRow}>
              <div style={styles.iconWrap} aria-hidden="true">
                <HrumIcon size={28} style={styles.iconGlow} />
              </div>
              <div>
                <div style={styles.kicker}>Экономика</div>
                <div style={styles.title}>Хрумы</div>
              </div>
            </div>
            <button type="button" onClick={wallet?.refresh} className="pp-btn" style={styles.ghostBtn} disabled={isLoading}>
              Обновить
            </button>
          </div>

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

          <div style={styles.actions}>
            <button type="button" onClick={onOpenHistory} className="pp-btn" style={styles.primaryBtn}>
              История
            </button>
            <button type="button" onClick={onOpenShop} className="pp-btn" style={styles.primaryBtn}>
              Магазин
            </button>
            <button type="button" onClick={onOpenTasks} className="pp-btn" style={styles.primaryBtn}>
              Задания
            </button>
          </div>

          <div style={styles.hint}>
            Баланс приходит с backend и обновляется после наград/покупок. На фронте нет локальных пересчётов.
          </div>
        </div>

        <div style={styles.heroRight} aria-hidden="true">
          <div style={styles.coinStack}>
            <div style={{ ...styles.coin, ...styles.coinBack }}>
              <HrumIcon size={120} style={styles.coinImgBack} />
            </div>
            <div style={{ ...styles.coin, ...styles.coinFront }}>
              <HrumIcon size={160} style={styles.coinImgFront} />
            </div>
          </div>
          <div style={styles.heroGlow} />
          <div style={styles.heroGrid} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    borderRadius: 26,
    border: '1px solid var(--pp-border)',
    background:
      'radial-gradient(1200px 500px at 0% 0%, rgba(168,85,247,0.16), rgba(0,0,0,0) 55%), radial-gradient(900px 420px at 90% 10%, rgba(99,102,241,0.14), rgba(0,0,0,0) 55%), var(--pp-glass)',
    boxShadow: 'var(--pp-shadow)',
    backdropFilter: 'blur(14px)',
    padding: 20,
    overflow: 'hidden'
  },
  hero: { display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, alignItems: 'stretch' },
  heroLeft: { minWidth: 0, display: 'flex', flexDirection: 'column' },
  heroRight: {
    position: 'relative',
    borderRadius: 22,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.18)',
    overflow: 'hidden',
    minHeight: 220
  },
  topRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.30), rgba(168,85,247,0.22))',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)'
  },
  iconGlow: { filter: 'drop-shadow(0 10px 20px rgba(168,85,247,0.35))' },
  kicker: { color: '#94a3b8', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#e2e8f0', fontWeight: 950, fontSize: 18, letterSpacing: 0.2 },
  ghostBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.28)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 900
  },
  balanceLabel: { color: '#94a3b8', fontWeight: 900, fontSize: 12 },
  balanceValue: { color: '#e2e8f0', fontWeight: 950, fontSize: 44, letterSpacing: 0.6, lineHeight: 1.03, marginTop: 4 },
  balanceUnit: { color: '#cbd5e1', fontWeight: 900, fontSize: 14, opacity: 0.95 },
  errorText: { color: '#fca5a5', fontWeight: 900, fontSize: 12 },
  actions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14 },
  primaryBtn: {
    height: 42,
    padding: '0 14px',
    borderRadius: 14,
    border: '1px solid rgba(168,85,247,0.38)',
    background: 'var(--pp-grad)',
    color: '#fff',
    fontWeight: 950,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, filter 0.15s ease'
  },
  hint: { marginTop: 12, color: '#94a3b8', fontWeight: 800, fontSize: 12, lineHeight: 1.35 },

  coinStack: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' },
  coin: { position: 'absolute', display: 'grid', placeItems: 'center', borderRadius: 28 },
  coinBack: { transform: 'translate(28px, -8px) rotate(-10deg)', opacity: 0.55, filter: 'blur(0.2px)' },
  coinFront: { transform: 'translate(-12px, 10px) rotate(8deg)', animation: 'ppFloat 4.6s ease-in-out infinite' },
  coinImgBack: { filter: 'drop-shadow(0 18px 34px rgba(0,0,0,0.45)) saturate(1.05)' },
  coinImgFront: { filter: 'drop-shadow(0 22px 44px rgba(0,0,0,0.55)) saturate(1.12)' },
  heroGlow: {
    position: 'absolute',
    inset: -40,
    background:
      'radial-gradient(420px 300px at 60% 35%, rgba(168,85,247,0.22), rgba(0,0,0,0) 60%), radial-gradient(360px 260px at 40% 65%, rgba(99,102,241,0.20), rgba(0,0,0,0) 60%)'
  },
  heroGrid: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
    backgroundSize: '24px 24px',
    maskImage: 'radial-gradient(160px 160px at 50% 50%, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)',
    opacity: 0.9
  }
};
