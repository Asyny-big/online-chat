import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { countPhoneDigits, PHONE_LOOKUP_MIN_DIGITS, sanitizeLookupPhoneInput } from '@/shared/hooks/usePhoneUserLookup';

export default function SearchPage({ token, onOpenMessages }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    const q = sanitizeLookupPhoneInput(phone);
    if (!q || loading) return;

    if (countPhoneDigits(q) < PHONE_LOOKUP_MIN_DIGITS) {
      setError('Введите номер телефона полностью');
      setResult(null);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(`${API_URL}/users/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { phone: q }
      });
      if (res.data && typeof res.data === 'object' && (res.data._id || res.data.id)) {
        setResult(res.data);
      } else {
        setError('Пользователь не найден');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Поиск</h1>
      <form onSubmit={onSubmit} style={styles.form}>
        <input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (error) setError('');
          }}
          style={styles.input}
          placeholder="+79990000000"
        />
        <button type="submit" style={styles.btn} disabled={loading}>
          {loading ? 'Поиск...' : 'Найти'}
        </button>
      </form>

      {error ? <div style={styles.error}>{error}</div> : null}

      {result ? (
        <div style={styles.card}>
          <div style={styles.name}>{result.name || 'Пользователь'}</div>
          <div style={styles.meta}>{result.phone || ''}</div>
          <button type="button" style={styles.secondary} onClick={() => onOpenMessages?.(result)}>
            Открыть сообщения
          </button>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    padding: 'var(--space-18)'
  },
  title: {
    margin: '0 0 var(--space-14) 0',
    color: '#f8fafc',
    fontSize: 28
  },
  form: {
    display: 'flex',
    gap: 'var(--space-10)'
  },
  input: {
    flex: 1,
    border: '1px solid #334155',
    borderRadius: 12,
    background: '#0f172a',
    color: '#e2e8f0',
    padding: 'var(--space-10) var(--space-12)',
    outline: 'none'
  },
  btn: {
    border: 'none',
    borderRadius: 12,
    background: '#0284c7',
    color: '#f8fafc',
    padding: 'var(--space-10) var(--space-14)',
    cursor: 'pointer',
    fontWeight: 700
  },
  error: {
    marginTop: 'var(--space-12)',
    color: '#fca5a5'
  },
  card: {
    marginTop: 'var(--space-14)',
    border: '1px solid #1e293b',
    background: '#0b1220',
    borderRadius: 14,
    padding: 'var(--space-12)'
  },
  name: {
    color: '#e2e8f0',
    fontWeight: 800
  },
  meta: {
    color: '#94a3b8',
    marginTop: 'var(--space-4)',
    marginBottom: 'var(--space-10)'
  },
  secondary: {
    border: '1px solid #334155',
    borderRadius: 999,
    background: '#020617',
    color: '#cbd5e1',
    padding: 'var(--space-8) var(--space-12)',
    cursor: 'pointer'
  }
};
