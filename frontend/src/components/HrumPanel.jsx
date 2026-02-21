import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buyShopItem, claimDailyLogin, getShopItems, getTransactions, getWallet } from '@/domains/hrum/api/economyApi';
import { HrumIcon } from '@/domains/hrum/components/HrumIcon';
import { useHrumToast } from './HrumToast';

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

export default function HrumPanel({ token }) {
  const { showEarn, showInfo, showError } = useHrumToast();

  const [tab, setTab] = useState('balance'); // balance | history | shop

  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');

  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');
  const [txItems, setTxItems] = useState([]);

  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopItems, setShopItemsState] = useState([]);

  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyMeta, setDailyMeta] = useState(null); // { claimed, streak }
  const lastDailyAttemptAtRef = useRef(0);

  const [buyingSku, setBuyingSku] = useState('');
  const [ownedSkus, setOwnedSkus] = useState(() => new Set());
  const [blockedSkus, setBlockedSkus] = useState(() => new Set());

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!token) return;
    setWalletLoading(true);
    setWalletError('');
    try {
      const data = await getWallet({ token });
      if (!mountedRef.current) return;
      setWallet(data || null);
    } catch (e) {
      if (!mountedRef.current) return;
      setWalletError(e?.message || 'wallet_failed');
    } finally {
      if (mountedRef.current) setWalletLoading(false);
    }
  }, [token]);

  const refreshTx = useCallback(async () => {
    if (!token) return;
    setTxLoading(true);
    setTxError('');
    try {
      const data = await getTransactions({ token, limit: 50 });
      if (!mountedRef.current) return;
      setTxItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      if (!mountedRef.current) return;
      setTxError(e?.message || 'transactions_failed');
    } finally {
      if (mountedRef.current) setTxLoading(false);
    }
  }, [token]);

  const refreshShop = useCallback(async () => {
    if (!token) return;
    setShopLoading(true);
    setShopError('');
    try {
      const data = await getShopItems({ token });
      if (!mountedRef.current) return;
      setShopItemsState(Array.isArray(data?.items) ? data.items : []);
      if (Array.isArray(data?.ownedSkus)) {
        setOwnedSkus(new Set(data.ownedSkus.map((s) => String(s || '')).filter(Boolean)));
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setShopError(e?.message || 'shop_failed');
    } finally {
      if (mountedRef.current) setShopLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshWallet();
    refreshTx();
    // shop: грузим по требованию (вкладка)
  }, [refreshWallet, refreshTx]);

  useEffect(() => {
    if (tab === 'shop' && shopItems.length === 0 && !shopLoading) refreshShop();
  }, [tab, refreshShop, shopItems.length, shopLoading]);

  const balanceHrum = useMemo(() => String(wallet?.balanceHrum ?? '0'), [wallet]);
  const todayEarnedHrum = wallet?.todayEarnedHrum ? String(wallet.todayEarnedHrum) : null;
  const todaySpentHrum = wallet?.todaySpentHrum ? String(wallet.todaySpentHrum) : null;

  const claimDaily = useCallback(async () => {
    if (!token || dailyLoading) return;
    const now = Date.now();
    if (now - lastDailyAttemptAtRef.current < 15000) {
      showInfo('Попробуйте чуть позже');
      return;
    }
    lastDailyAttemptAtRef.current = now;
    setDailyLoading(true);
    try {
      const res = await claimDailyLogin({ token });
      if (!mountedRef.current) return;
      setDailyMeta({ claimed: !!res?.claimed, streak: res?.streak ?? null });
      if (res?.claimed && res?.amountHrum) {
        showEarn({ amountHrum: res.amountHrum });
      }
      await Promise.all([refreshWallet(), refreshTx()]);
    } catch (e) {
      if (!mountedRef.current) return;
      if (String(e?.message) === 'cooldown_active' || e?.status === 429) {
        showInfo('Ежедневный вход уже получен');
      } else if (e?.status === 401) {
        showError('Требуется авторизация');
      } else if (typeof e?.status === 'number' && e.status >= 500) {
        showError('Сервис Хрумов временно недоступен');
      } else {
        showError('Не удалось получить награду');
      }
    } finally {
      if (mountedRef.current) setDailyLoading(false);
    }
  }, [token, dailyLoading, refreshWallet, refreshTx, showEarn, showError, showInfo]);

  const buy = useCallback(
    async (sku) => {
      const nextSku = String(sku || '').trim();
      if (!token || !nextSku || buyingSku) return;
      setBuyingSku(nextSku);
      setBlockedSkus((prev) => {
        const n = new Set(prev);
        n.delete(nextSku);
        return n;
      });

      try {
        const res = await buyShopItem({ token, sku: nextSku });
        if (!mountedRef.current) return;
        if (res?.purchased) {
          setOwnedSkus((prev) => new Set(prev).add(nextSku));
          showInfo('Куплено');
          await Promise.all([refreshWallet(), refreshTx()]);
        } else if (res?.reason === 'already_owned') {
          setOwnedSkus((prev) => new Set(prev).add(nextSku));
          showInfo('Уже куплено');
        } else {
          showInfo('Не удалось купить');
        }
      } catch (e) {
        if (!mountedRef.current) return;
        if (String(e?.message) === 'insufficient_hrum') {
          setBlockedSkus((prev) => new Set(prev).add(nextSku));
          showInfo('Недостаточно Хрумов');
        } else {
          showError('Ошибка покупки');
        }
      } finally {
        if (mountedRef.current) setBuyingSku('');
      }
    },
    [token, buyingSku, refreshWallet, refreshTx, showError, showInfo]
  );

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.titleRow}>
          <HrumIcon size={18} />
          <div style={styles.title}>Хрумы</div>
        </div>
        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => setTab('balance')}
            style={{ ...styles.tabBtn, ...(tab === 'balance' ? styles.tabBtnActive : null) }}
          >
            Баланс
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            style={{ ...styles.tabBtn, ...(tab === 'history' ? styles.tabBtnActive : null) }}
          >
            История
          </button>
          <button
            type="button"
            onClick={() => setTab('shop')}
            style={{ ...styles.tabBtn, ...(tab === 'shop' ? styles.tabBtnActive : null) }}
          >
            Магазин
          </button>
        </div>
      </div>

      {tab === 'balance' && (
        <div style={styles.body}>
          <div style={styles.balanceRow}>
            <div style={styles.balanceLeft}>
              <HrumIcon size={20} />
              {walletLoading ? (
                <div style={styles.skeletonWide} />
              ) : walletError ? (
                <div style={styles.errorInline}>
                  <span style={styles.errorText}>Не удалось загрузить баланс</span>
                  <button type="button" style={styles.linkBtn} onClick={refreshWallet}>
                    Повторить
                  </button>
                </div>
              ) : (
                <div style={styles.balanceText}>
                  <span style={styles.balanceValue}>{balanceHrum}</span>
                  <span style={styles.balanceUnit}>Хрумы</span>
                </div>
              )}
            </div>
            <button type="button" onClick={refreshWallet} style={styles.secondaryBtn} disabled={walletLoading}>
              Обновить
            </button>
          </div>

          <div style={styles.metrics}>
            <div style={styles.metricRow}>
              <div style={styles.metricLabel}>Заработано сегодня</div>
              <div style={styles.metricValue}>
                {todayEarnedHrum ? (
                  <span style={styles.earn}>+{todayEarnedHrum}</span>
                ) : (
                  <span style={styles.metricEmpty}>—</span>
                )}{' '}
                <span style={styles.metricUnit}>Хрумы</span>
              </div>
            </div>
            <div style={styles.metricRow}>
              <div style={styles.metricLabel}>Потрачено сегодня</div>
              <div style={styles.metricValue}>
                {todaySpentHrum ? (
                  <span style={styles.spend}>−{todaySpentHrum}</span>
                ) : (
                  <span style={styles.metricEmpty}>—</span>
                )}{' '}
                <span style={styles.metricUnit}>Хрумы</span>
              </div>
            </div>
          </div>

          <div style={styles.actionsRow}>
            <button type="button" onClick={claimDaily} style={styles.primaryBtn} disabled={dailyLoading}>
              {dailyLoading ? 'Проверяем…' : 'Ежедневный вход'}
            </button>
            {dailyMeta?.streak ? (
              <div style={styles.pill}>Серия: {dailyMeta.streak}</div>
            ) : (
              <div style={{ ...styles.pill, ...styles.pillMuted }}>Серия: —</div>
            )}
          </div>

          <div style={styles.hint}>
            Баланс и суммы приходят с backend; на фронтенде не хранится и не пересчитывается.
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={styles.body}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>Операции</div>
            <button type="button" onClick={refreshTx} style={styles.secondaryBtn} disabled={txLoading}>
              Обновить
            </button>
          </div>

          {txLoading ? (
            <div style={styles.list}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={styles.txRow}>
                  <div style={styles.skeletonAmount} />
                  <div style={styles.skeletonWide} />
                </div>
              ))}
            </div>
          ) : txError ? (
            <div style={styles.errorBox}>
              <div style={styles.errorTitle}>Не удалось загрузить историю</div>
              <div style={styles.errorActions}>
                <button type="button" onClick={refreshTx} style={styles.primaryBtn}>
                  Повторить
                </button>
              </div>
            </div>
          ) : txItems.length === 0 ? (
            <div style={styles.emptyBox}>Операций пока нет</div>
          ) : (
            <div style={styles.list}>
              {txItems.map((t) => {
                const { sign, abs, isSpend } = splitDelta(t?.deltaHrum);
                return (
                  <div key={t?.id || `${t?.createdAt}-${t?.deltaHrum}`} style={styles.txRow}>
                    <div style={{ ...styles.amount, ...(isSpend ? styles.amountSpend : styles.amountEarn) }}>
                      {sign}
                      {abs}{' '}
                      <span style={styles.amountUnit}>
                        <HrumIcon size={14} style={{ marginRight: 6, opacity: 0.95 }} />
                        Хрумы
                      </span>
                    </div>
                    <div style={styles.txMain}>
                      <div style={styles.txReason}>{txLabel(t?.reasonCode, t?.meta)}</div>
                      <div style={styles.txDate}>{formatTxDate(t?.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'shop' && (
        <div style={styles.body}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitle}>Магазин</div>
            <button type="button" onClick={refreshShop} style={styles.secondaryBtn} disabled={shopLoading}>
              Обновить
            </button>
          </div>

          {shopLoading ? (
            <div style={styles.shopGrid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={styles.shopCard}>
                  <div style={styles.skeletonWide} />
                  <div style={{ ...styles.skeletonWide, width: '80%' }} />
                  <div style={{ ...styles.skeletonWide, width: '50%' }} />
                </div>
              ))}
            </div>
          ) : shopError ? (
            <div style={styles.errorBox}>
              <div style={styles.errorTitle}>Не удалось загрузить магазин</div>
              <div style={styles.errorActions}>
                <button type="button" onClick={refreshShop} style={styles.primaryBtn}>
                  Повторить
                </button>
              </div>
            </div>
          ) : shopItems.length === 0 ? (
            <div style={styles.emptyBox}>Пока нет товаров</div>
          ) : (
            <div style={styles.shopGrid}>
              {shopItems.map((item) => {
                const sku = String(item?.sku || '');
                const isOwned = ownedSkus.has(sku);
                const isBuying = buyingSku === sku;
                const isBlocked = blockedSkus.has(sku);
                const btnText = isOwned ? 'Куплено' : isBuying ? 'Покупка…' : isBlocked ? 'Недостаточно Хрумов' : 'Купить';
                const btnDisabled = isOwned || isBuying || isBlocked;

                return (
                  <div key={sku} style={styles.shopCard}>
                    <div style={styles.shopTitle}>{item?.title || sku}</div>
                    <div style={styles.shopDesc}>{item?.description || '—'}</div>
                    <div style={styles.priceRow}>
                      <HrumIcon size={16} />
                      <div style={styles.priceText}>{String(item?.priceHrum ?? '—')} Хрумы</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => buy(sku)}
                      style={{ ...styles.primaryBtn, ...(btnDisabled ? styles.btnDisabled : null) }}
                      disabled={btnDisabled}
                    >
                      {btnText}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={styles.hint}>
            Покупка без optimistic UI: баланс и история обновляются после ответа backend.
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0 10px 30px rgba(0,0,0,0.22)'
  },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  titleRow: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { color: '#e2e8f0', fontWeight: 800, fontSize: 14, letterSpacing: 0.2 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  tabBtn: {
    padding: '8px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.3)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800
  },
  tabBtnActive: {
    background: 'rgba(168,85,247,0.18)',
    border: '1px solid rgba(168,85,247,0.35)'
  },
  body: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  balanceRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  balanceLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 },
  balanceText: { display: 'flex', alignItems: 'baseline', gap: 8 },
  balanceValue: { color: '#e2e8f0', fontWeight: 900, fontSize: 22, letterSpacing: 0.3 },
  balanceUnit: { color: '#cbd5e1', fontWeight: 800, fontSize: 13 },
  metrics: {
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.25)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  metricRow: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  metricLabel: { color: '#94a3b8', fontWeight: 700, fontSize: 12 },
  metricValue: { color: '#e2e8f0', fontWeight: 900, fontSize: 12, textAlign: 'right' },
  metricUnit: { color: '#94a3b8', fontWeight: 800, fontSize: 12 },
  metricEmpty: { color: '#64748b', fontWeight: 900 },
  earn: { color: '#22c55e' },
  spend: { color: '#ef4444' },
  actionsRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pill: {
    padding: '8px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.35)',
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 800
  },
  pillMuted: { color: '#94a3b8' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { color: '#e2e8f0', fontWeight: 900, fontSize: 13 },
  primaryBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(168,85,247,0.35)',
    background: 'linear-gradient(135deg, rgba(168,85,247,0.95), rgba(99,102,241,0.95))',
    color: '#fff',
    fontWeight: 900,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, filter 0.15s ease'
  },
  secondaryBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.4)',
    color: '#e2e8f0',
    fontWeight: 800,
    cursor: 'pointer'
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed', filter: 'grayscale(0.25)' },
  hint: { color: '#94a3b8', fontSize: 12, lineHeight: 1.35 },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  txRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.25)'
  },
  amount: { fontWeight: 900, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  amountEarn: { color: '#22c55e' },
  amountSpend: { color: '#ef4444' },
  amountUnit: { color: '#cbd5e1', fontWeight: 900, fontSize: 12, display: 'inline-flex', alignItems: 'center' },
  txMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' },
  txReason: { color: '#e2e8f0', fontWeight: 800, fontSize: 12, textAlign: 'right', wordBreak: 'break-word' },
  txDate: { color: '#94a3b8', fontWeight: 700, fontSize: 11 },

  shopGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 },
  shopCard: {
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.25)',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  shopTitle: { color: '#e2e8f0', fontWeight: 900, fontSize: 13 },
  shopDesc: { color: '#94a3b8', fontWeight: 700, fontSize: 12, lineHeight: 1.3 },
  priceRow: { display: 'flex', alignItems: 'center', gap: 8 },
  priceText: { color: '#e2e8f0', fontWeight: 900, fontSize: 12 },

  errorBox: {
    borderRadius: 14,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.08)',
    padding: 12,
    color: '#fecaca'
  },
  errorTitle: { fontWeight: 900, marginBottom: 10 },
  errorActions: { display: 'flex', gap: 10 },
  emptyBox: {
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.2)',
    padding: 12,
    color: '#94a3b8',
    fontWeight: 800,
    fontSize: 12
  },
  errorInline: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  errorText: { color: '#fecaca', fontWeight: 900, fontSize: 12 },
  linkBtn: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    color: '#93c5fd',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'underline'
  },

  skeletonWide: {
    width: 160,
    height: 12,
    borderRadius: 999,
    background: 'rgba(148,163,184,0.14)'
  },
  skeletonAmount: { width: 110, height: 12, borderRadius: 999, background: 'rgba(148,163,184,0.14)' }
};
