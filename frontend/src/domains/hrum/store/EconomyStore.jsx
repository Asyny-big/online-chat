import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buyShopItem, claimTask, getShopItems, getTasks, getTransactions, getWallet } from '@/domains/hrum/api/economyApi';

const EconomyStoreContext = createContext(null);
const WALLET_UPDATE_EVENT = 'govchat:wallet-update';

export function EconomyStoreProvider({ token, children }) {
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [wallet, setWallet] = useState({ balanceHrum: '0' });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');

  const [txItems, setTxItems] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [claimingTaskId, setClaimingTaskId] = useState('');

  const [shopItems, setShopItems] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState('');
  const [buyingSku, setBuyingSku] = useState('');
  const claimingTaskIdRef = useRef('');
  const buyingSkuRef = useRef('');
  const walletReqSeqRef = useRef(0);
  const txReqSeqRef = useRef(0);
  const tasksReqSeqRef = useRef(0);
  const shopReqSeqRef = useRef(0);
  const walletMutSeqRef = useRef(0);
  const txMutSeqRef = useRef(0);

  useEffect(() => {
    claimingTaskIdRef.current = claimingTaskId;
  }, [claimingTaskId]);

  useEffect(() => {
    buyingSkuRef.current = buyingSku;
  }, [buyingSku]);

  const applyServerBalance = useCallback((balanceHrum) => {
    if (balanceHrum === undefined || balanceHrum === null) return;
    const next = String(balanceHrum);
    setWallet((prev) => ({ ...(prev || {}), balanceHrum: next }));
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!token) return;
    const seq = ++walletReqSeqRef.current;
    const mutSeqAtStart = walletMutSeqRef.current;
    setWalletLoading(true);
    setWalletError('');
    try {
      const data = await getWallet({ token });
      if (!mountedRef.current || seq !== walletReqSeqRef.current) return;
      if (mutSeqAtStart !== walletMutSeqRef.current) return;
      setWallet(data || { balanceHrum: '0' });
    } catch (e) {
      if (!mountedRef.current || seq !== walletReqSeqRef.current) return;
      setWalletError(e?.message || 'wallet_failed');
    } finally {
      if (mountedRef.current && seq === walletReqSeqRef.current) setWalletLoading(false);
    }
  }, [token]);

  const refreshTransactions = useCallback(async ({ limit = 50 } = {}) => {
    if (!token) return;
    const seq = ++txReqSeqRef.current;
    const mutSeqAtStart = txMutSeqRef.current;
    setTxLoading(true);
    setTxError('');
    try {
      const data = await getTransactions({ token, limit });
      if (!mountedRef.current || seq !== txReqSeqRef.current) return;
      if (mutSeqAtStart !== txMutSeqRef.current) return;
      setTxItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      if (!mountedRef.current || seq !== txReqSeqRef.current) return;
      setTxError(e?.message || 'transactions_failed');
    } finally {
      if (mountedRef.current && seq === txReqSeqRef.current) setTxLoading(false);
    }
  }, [token]);

  const refreshTasks = useCallback(async () => {
    if (!token) return;
    const seq = ++tasksReqSeqRef.current;
    setTasksLoading(true);
    setTasksError('');
    try {
      const data = await getTasks({ token });
      if (!mountedRef.current || seq !== tasksReqSeqRef.current) return;
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (e) {
      if (!mountedRef.current || seq !== tasksReqSeqRef.current) return;
      setTasksError(e?.message || 'tasks_failed');
    } finally {
      if (mountedRef.current && seq === tasksReqSeqRef.current) setTasksLoading(false);
    }
  }, [token]);

  const doClaimTask = useCallback(
    async (taskId) => {
      const id = String(taskId || '').trim();
      if (!token || !id || claimingTaskIdRef.current) return null;
      claimingTaskIdRef.current = id;
      setClaimingTaskId(id);
      try {
        const res = await claimTask({ token, taskId: id });
        if (!mountedRef.current) return null;
        applyServerBalance(res?.balanceHrum);
        return res || null;
      } finally {
        claimingTaskIdRef.current = '';
        if (mountedRef.current) setClaimingTaskId('');
      }
    },
    [token, applyServerBalance]
  );

  const refreshShop = useCallback(async () => {
    if (!token) return;
    const seq = ++shopReqSeqRef.current;
    const walletMutSeqAtStart = walletMutSeqRef.current;
    setShopLoading(true);
    setShopError('');
    try {
      const data = await getShopItems({ token });
      if (!mountedRef.current || seq !== shopReqSeqRef.current) return;
      setShopItems(Array.isArray(data?.items) ? data.items : []);
      if (walletMutSeqAtStart === walletMutSeqRef.current) {
        applyServerBalance(data?.balanceHrum);
      }
    } catch (e) {
      if (!mountedRef.current || seq !== shopReqSeqRef.current) return;
      setShopError(e?.message || 'shop_failed');
    } finally {
      if (mountedRef.current && seq === shopReqSeqRef.current) setShopLoading(false);
    }
  }, [token, applyServerBalance]);

  const buy = useCallback(
    async (sku) => {
      const id = String(sku || '').trim();
      if (!token || !id || buyingSkuRef.current) return null;
      buyingSkuRef.current = id;
      setBuyingSku(id);
      try {
        const res = await buyShopItem({ token, sku: id });
        if (!mountedRef.current) return null;
        applyServerBalance(res?.balanceHrum);
        if (res?.purchased || res?.reason === 'already_owned') {
          setShopItems((prev) =>
            Array.isArray(prev)
              ? prev.map((it) =>
                  String(it?.sku || '') === id
                    ? { ...(it || {}), owned: true, canPurchase: false }
                    : it
                )
              : prev
          );
        }
        return res || null;
      } finally {
        buyingSkuRef.current = '';
        if (mountedRef.current) setBuyingSku('');
      }
    },
    [token, applyServerBalance]
  );

  useEffect(() => {
    if (token) return;
    setWallet({ balanceHrum: '0' });
    setWalletError('');
    setWalletLoading(false);
    setTxItems([]);
    setTxError('');
    setTxLoading(false);
    setTasks([]);
    setTasksError('');
    setTasksLoading(false);
    setClaimingTaskId('');
    claimingTaskIdRef.current = '';
    setShopItems([]);
    setShopError('');
    setShopLoading(false);
    setBuyingSku('');
    buyingSkuRef.current = '';
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleWalletUpdate = (event) => {
      const detail = event?.detail || {};
      walletMutSeqRef.current += 1;
      applyServerBalance(detail?.balanceHrum);

      const tx = detail?.tx || detail?.transaction || detail?.txItem;
      if (!tx || !tx.id) return;
      txMutSeqRef.current += 1;

      setTxItems((prev) => {
        if (!Array.isArray(prev) || prev.length === 0) return [tx];
        if (prev.some((item) => item?.id === tx.id)) return prev;
        return [tx, ...prev];
      });
    };

    window.addEventListener(WALLET_UPDATE_EVENT, handleWalletUpdate);
    return () => window.removeEventListener(WALLET_UPDATE_EVENT, handleWalletUpdate);
  }, [applyServerBalance]);

  // Keep wallet fresh on enter.
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  const store = useMemo(
    () => ({
      token,
      wallet: {
        balanceHrum: String(wallet?.balanceHrum ?? '0'),
        loading: walletLoading,
        error: walletError,
        refresh: refreshWallet,
        applyServerBalance
      },
      transactions: {
        items: txItems,
        loading: txLoading,
        error: txError,
        refresh: refreshTransactions
      },
      tasks: {
        items: tasks,
        loading: tasksLoading,
        error: tasksError,
        refresh: refreshTasks,
        claim: doClaimTask,
        claimingTaskId
      },
      shop: {
        items: shopItems,
        loading: shopLoading,
        error: shopError,
        refresh: refreshShop,
        buy,
        buyingSku
      }
    }),
    [
      token,
      wallet,
      walletLoading,
      walletError,
      refreshWallet,
      applyServerBalance,
      txItems,
      txLoading,
      txError,
      refreshTransactions,
      tasks,
      tasksLoading,
      tasksError,
      refreshTasks,
      doClaimTask,
      claimingTaskId,
      shopItems,
      shopLoading,
      shopError,
      refreshShop,
      buy,
      buyingSku
    ]
  );

  return <EconomyStoreContext.Provider value={store}>{children}</EconomyStoreContext.Provider>;
}

function useEconomyStore() {
  const ctx = useContext(EconomyStoreContext);
  if (!ctx) throw new Error('EconomyStoreProvider is missing');
  return ctx;
}

export function useWallet() {
  return useEconomyStore().wallet;
}

export function useTransactions() {
  return useEconomyStore().transactions;
}

export function useTasks() {
  return useEconomyStore().tasks;
}

export function useShop() {
  return useEconomyStore().shop;
}
