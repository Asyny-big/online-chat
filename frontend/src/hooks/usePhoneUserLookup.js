import { useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';

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

    // Сброс для пустого ввода.
    if (!current) {
      setStatus('idle');
      setUser(null);
      setError('');
      return undefined;
    }

    // Порог: до minLen не делаем запросы и не показываем пользователей.
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
        const res = await fetch(`${API_URL}/users/search?phone=${encodeURIComponent(current)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        // Если это уже не последний запрос — игнорируем результат.
        if (requestSeqRef.current !== seq) return;

        if (res.status === 429) {
          setStatus('rate_limited');
          setError('Слишком много запросов. Попробуйте позже.');
          return;
        }

        if (res.status === 400) {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setError(data?.error || 'Некорректный номер телефона');
          return;
        }

        if (!res.ok) {
          setStatus('error');
          setError(`Ошибка поиска: HTTP ${res.status}`);
          return;
        }

        const data = await res.json();
        if (data && typeof data === 'object' && data.id) {
          setStatus('found');
          setUser(data);
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

