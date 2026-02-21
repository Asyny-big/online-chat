import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/config';

const DEFAULT_MIN_LEN = 9;
const DEFAULT_DEBOUNCE_MS = 400;

function sanitizeLookupPhoneInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const allowed = raw.replace(/[^\d+]/g, '');
  if (!allowed) return '';

  if (allowed.startsWith('+')) {
    return `+${allowed.slice(1).replace(/\+/g, '')}`;
  }

  return allowed.replace(/\+/g, '');
}

function countDigits(value) {
  return String(value || '').replace(/\D/g, '').length;
}

export function usePhoneUserLookup({ token, minLen = DEFAULT_MIN_LEN, debounceMs = DEFAULT_DEBOUNCE_MS }) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | too_short | loading | found | not_found | error | rate_limited
  const [user, setUser] = useState(null); // { id, name, avatar } | null
  const [error, setError] = useState('');

  const abortRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const current = phone;
    const queryPhone = sanitizeLookupPhoneInput(current);

    if (!queryPhone) {
      setStatus('idle');
      setUser(null);
      setError('');
      return undefined;
    }

    if (countDigits(queryPhone) < minLen) {
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
        setError('Нет токена авторизации');
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus('loading');
      setError('');
      setUser(null);

      try {
        const res = await fetch(`${API_URL}/users/search?phone=${encodeURIComponent(queryPhone)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (requestSeqRef.current !== seq) return;

        if (res.status === 429) {
          setStatus('rate_limited');
          setError('Слишком много запросов. Попробуйте позже.');
          return;
        }

        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          const message = String(data?.error || 'Некорректный номер телефона');
          if (/too short/i.test(message)) {
            setStatus('too_short');
            setError('');
          } else {
            setStatus('error');
            setError(message);
          }
          return;
        }

        if (!res.ok) {
          setStatus('error');
          setError(`Ошибка поиска: HTTP ${res.status}`);
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
        setError('Ошибка сети');
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
