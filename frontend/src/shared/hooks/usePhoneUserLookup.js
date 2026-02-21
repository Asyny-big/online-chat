import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/config';

const DEFAULT_MIN_LEN = 9;
const DEFAULT_DEBOUNCE_MS = 400;

export function usePhoneUserLookup({ token, minLen = DEFAULT_MIN_LEN, debounceMs = DEFAULT_DEBOUNCE_MS }) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | too_short | loading | found | not_found | error | rate_limited
  const [user, setUser] = useState(null); // { id, name, avatar } | null
  const [error, setError] = useState('');

  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const current = phone;

    // РЎР±СЂРѕСЃ РґР»СЏ РїСѓСЃС‚РѕРіРѕ РІРІРѕРґР°.
    if (!current) {
      setStatus('idle');
      setUser(null);
      setError('');
      return undefined;
    }

    // РџРѕСЂРѕРі: РґРѕ minLen РЅРµ РґРµР»Р°РµРј Р·Р°РїСЂРѕСЃС‹ Рё РЅРµ РїРѕРєР°Р·С‹РІР°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№.
    if (current.length < minLen) {
      if (abortRef.current) abortRef.current.abort();
      setStatus('too_short');
      setUser(null);
      setError('');
      return undefined;
    }

    const seq = (requestSeqRef.current += 1);

    const timer = setTimeout(async () => {
      if (!token) {
        setStatus('error');
        setUser(null);
        setError('РќРµС‚ С‚РѕРєРµРЅР° Р°РІС‚РѕСЂРёР·Р°С†РёРё');
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      setError('');
      setUser(null);

      try {
        const res = await fetch(`${API_URL}/users/search?phone=${encodeURIComponent(current)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        // Р•СЃР»Рё СЌС‚Рѕ СѓР¶Рµ РЅРµ РїРѕСЃР»РµРґРЅРёР№ Р·Р°РїСЂРѕСЃ вЂ” РёРіРЅРѕСЂРёСЂСѓРµРј СЂРµР·СѓР»СЊС‚Р°С‚.
        if (requestSeqRef.current !== seq) return;

        if (res.status === 429) {
          setStatus('rate_limited');
          setError('РЎР»РёС€РєРѕРј РјРЅРѕРіРѕ Р·Р°РїСЂРѕСЃРѕРІ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.');
          return;
        }

        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setError(data?.error || 'РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°');
          return;
        }

        if (!res.ok) {
          setStatus('error');
          setError(`РћС€РёР±РєР° РїРѕРёСЃРєР°: HTTP ${res.status}`);
          return;
        }

        const data = await res.json();
        const userId = data?._id || data?.id;
        if (data && typeof data === 'object' && userId) {
          setStatus('found');
          setUser({ ...data, id: userId });
        } else {
          setStatus('not_found');
          setUser(null);
        }
      } catch (e) {
        if (e?.name === 'AbortError') return;
        if (requestSeqRef.current !== seq) return;
        setStatus('error');
        setError('РћС€РёР±РєР° СЃРµС‚Рё');
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [debounceMs, minLen, phone, token]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { phone, setPhone, status, user, error };
}





