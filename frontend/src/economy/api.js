import { API_URL } from '../config';

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function economyRequest({ token, path, method = 'GET', body, signal, headers }) {
  if (!token) throw new Error('AUTH_REQUIRED');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal
  });

  const data = await readJsonSafe(res);
  if (!res.ok) {
    const error = data?.error || data?.message || `HTTP_${res.status}`;
    const e = new Error(String(error));
    e.status = res.status;
    e.payload = data;
    throw e;
  }
  return data;
}

export function getWallet({ token, signal }) {
  return economyRequest({ token, path: '/economy/wallet', signal });
}

export function getTransactions({ token, limit = 50, before, signal }) {
  const qs = new URLSearchParams();
  qs.set('limit', String(limit));
  if (before) qs.set('before', String(before));
  return economyRequest({ token, path: `/economy/transactions?${qs.toString()}`, signal });
}

export function getShopItems({ token, signal }) {
  return economyRequest({ token, path: '/economy/shop/items', signal });
}

export function buyShopItem({ token, sku, signal }) {
  return economyRequest({ token, path: '/economy/shop/buy', method: 'POST', body: { sku }, signal });
}

export function claimDailyLogin({ token, deviceId, signal }) {
  return economyRequest({
    token,
    path: '/economy/earn/daily-login',
    method: 'POST',
    headers: deviceId ? { 'X-Device-Id': String(deviceId) } : undefined,
    signal
  });
}

