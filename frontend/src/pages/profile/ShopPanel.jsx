import React, { useCallback, useEffect, useMemo } from 'react';
import { useShop, useTransactions, useWallet } from '../../economy/EconomyStore';
import { HrumIcon } from '../../economy/hrumIcon';
import { useHrumToast } from '../../components/HrumToast';

function ItemSkeleton() {
  return (
    <div style={styles.itemCard}>
      <div style={styles.skelPreview} />
      <div style={styles.skelLineWide} />
      <div style={{ ...styles.skelLine, width: '75%' }} />
      <div style={{ ...styles.skelLine, width: '45%' }} />
      <div style={styles.skelBtn} />
    </div>
  );
}

function previewBgByType(type) {
  const t = String(type || '');
  if (t === 'theme') return 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(168,85,247,0.22))';
  if (t === 'sticker_pack') return 'linear-gradient(135deg, rgba(34,197,94,0.22), rgba(59,130,246,0.18))';
  return 'linear-gradient(135deg, rgba(148,163,184,0.20), rgba(99,102,241,0.16))';
}

export default function ShopPanel({ mode = 'full', onOpenAll }) {
  const wallet = useWallet();
  const shop = useShop();
  const transactions = useTransactions();
  const { showInfo, showError } = useHrumToast();

  useEffect(() => {
    if (shop.items.length === 0 && !shop.loading && !shop.error) shop.refresh();
  }, [shop]);

  const visible = useMemo(() => {
    if (mode === 'preview') return shop.items.slice(0, 4);
    return shop.items;
  }, [shop.items, mode]);

  const buy = useCallback(
    async (sku) => {
      try {
        const res = await shop.buy(sku);
        if (!res) return;
        if (res?.purchased) showInfo('Куплено');
        else if (res?.reason === 'already_owned') showInfo('Уже куплено');
        else showInfo('Покупка не выполнена');
        await Promise.all([shop.refresh(), transactions.refresh(), wallet.refresh()]);
      } catch (e) {
        if (String(e?.message) === 'insufficient_hrum') showInfo('Недостаточно Хрумов');
        else showError('Ошибка покупки');
      }
    },
    [shop, transactions, wallet, showError, showInfo]
  );

  return (
    <div className="pp-card" style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap} aria-hidden="true">
            <span style={styles.iconGlyph}>▦</span>
          </div>
          <div>
            <div style={styles.kicker}>Store</div>
            <div style={styles.title}>Магазин</div>
          </div>
        </div>
        <div style={styles.headerActions}>
          {mode === 'preview' ? (
            <button type="button" onClick={onOpenAll} className="pp-btn" style={styles.ghostBtn}>
              Открыть
            </button>
          ) : (
            <button type="button" onClick={shop.refresh} className="pp-btn" style={styles.ghostBtn} disabled={shop.loading}>
              Обновить
            </button>
          )}
        </div>
      </div>

      {shop.loading && shop.items.length === 0 ? (
        <div style={styles.grid}>
          {Array.from({ length: mode === 'preview' ? 4 : 8 }).map((_, i) => (
            <ItemSkeleton key={i} />
          ))}
        </div>
      ) : shop.error ? (
        <div style={styles.errorBox}>
          <div style={styles.errorTitle}>Не удалось загрузить магазин</div>
          <button type="button" onClick={shop.refresh} style={styles.primaryBtn}>
            Повторить
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div style={styles.emptyBox}>Пока нет товаров</div>
      ) : (
        <div style={styles.grid}>
          {visible.map((it) => {
            const sku = String(it?.sku || '');
            const owned = !!it?.owned;
            const canPurchase = !!it?.canPurchase;
            const isBuying = shop.buyingSku === sku;

            const disabled = owned || isBuying || !canPurchase;
            const btnText = owned ? 'Куплено' : isBuying ? 'Покупка…' : canPurchase ? 'Купить' : 'Недостаточно';

            return (
              <div key={sku} style={styles.itemCard}>
                <div style={{ ...styles.preview, background: previewBgByType(it?.type) }}>
                  <div style={styles.previewBadge}>{String(it?.type || 'item')}</div>
                  <div style={styles.previewPattern} />
                </div>
                <div style={styles.itemTitle}>{it?.title || sku}</div>
                <div style={styles.itemDesc}>{it?.description || '—'}</div>
                <div style={styles.priceRow}>
                  <HrumIcon size={18} style={{ filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.35))' }} />
                  <div style={styles.priceText}>
                    {String(it?.priceHrum ?? '—')} <span style={styles.priceUnit}>Хрумов</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => buy(sku)}
                  className="pp-btn"
                  style={{ ...(canPurchase ? styles.primaryBtn : styles.secondaryBtn), ...(disabled || !canPurchase ? styles.btnDisabled : null) }}
                  disabled={disabled}
                >
                  {btnText}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={styles.hint}>
        Покупки списываются на backend и возвращают новый баланс. UI не делает optimistic списаний.
      </div>
    </div>
  );
}

const styles = {
  card: {
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
    background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(99,102,241,0.16))',
    color: '#e2e8f0',
    fontWeight: 950
  },
  iconGlyph: { fontSize: 16, filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.35))' },
  kicker: { color: '#94a3b8', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#e2e8f0', fontWeight: 950, fontSize: 18, letterSpacing: 0.2 },
  headerActions: { display: 'flex', gap: 10 },
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

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 },
  itemCard: {
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.14)',
    background:
      'radial-gradient(520px 160px at 30% 0%, rgba(99,102,241,0.10), rgba(0,0,0,0) 55%), rgba(2,6,23,0.28)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  preview: {
    height: 120,
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,0.14)',
    overflow: 'hidden',
    position: 'relative'
  },
  previewPattern: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(220px 140px at 30% 30%, rgba(255,255,255,0.14), rgba(0,0,0,0) 60%), radial-gradient(260px 160px at 80% 70%, rgba(0,0,0,0.20), rgba(0,0,0,0) 60%)',
    mixBlendMode: 'overlay',
    opacity: 0.9,
    pointerEvents: 'none'
  },
  previewBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(2,6,23,0.35)',
    color: '#e2e8f0',
    fontWeight: 900,
    fontSize: 11
  },
  itemTitle: { color: '#e2e8f0', fontWeight: 950, fontSize: 14, lineHeight: 1.2 },
  itemDesc: { color: '#94a3b8', fontWeight: 750, fontSize: 12, lineHeight: 1.35, minHeight: 34 },
  priceRow: { display: 'flex', alignItems: 'center', gap: 8 },
  priceText: { color: '#e2e8f0', fontWeight: 950, fontSize: 12 },
  priceUnit: { color: '#94a3b8', fontWeight: 900 },

  primaryBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(168,85,247,0.35)',
    background: 'var(--pp-grad)',
    color: '#fff',
    fontWeight: 950,
    cursor: 'pointer'
  },
  secondaryBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(2,6,23,0.32)',
    color: '#cbd5e1',
    fontWeight: 950,
    cursor: 'not-allowed'
  },
  btnDisabled: { opacity: 0.55, cursor: 'not-allowed', filter: 'grayscale(0.2)' },

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
  emptyBox: {
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,6,23,0.18)',
    padding: 14,
    color: '#94a3b8',
    fontWeight: 900,
    fontSize: 12
  },

  hint: { marginTop: 12, color: '#94a3b8', fontWeight: 800, fontSize: 12, lineHeight: 1.35 },

  skelPreview: {
    height: 110,
    borderRadius: 16,
    background: 'rgba(148,163,184,0.14)'
  },
  skelLine: {
    height: 12,
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
    backgroundSize: '200% 100%',
    animation: 'ppShimmer 1.15s ease-in-out infinite'
  },
  skelLineWide: {
    height: 12,
    width: '70%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
    backgroundSize: '200% 100%',
    animation: 'ppShimmer 1.15s ease-in-out infinite'
  },
  skelBtn: { height: 40, borderRadius: 12, background: 'rgba(148,163,184,0.14)' }
};
