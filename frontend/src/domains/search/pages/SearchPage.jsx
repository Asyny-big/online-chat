import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/config';
import { SearchIcon } from '@/shared/ui/Icons';
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
    <section className="search-page">
      <header className="search-header">
        <div className="search-badge">
          <SearchIcon size={14} />
          <span>Поиск по номеру</span>
        </div>
        <h1 className="search-title">Найти пользователя</h1>
        <p className="search-subtitle">Введите телефон и откройте диалог без ручной навигации по чатам.</p>
      </header>

      <form onSubmit={onSubmit} className="search-form">
        <label className="search-field">
          <span className="search-field-label">Телефон</span>
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError('');
            }}
            className="search-input"
            placeholder="+79990000000"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>

        <button type="submit" className="btn btn-primary search-submit" disabled={loading}>
          {loading ? 'Поиск...' : 'Найти'}
        </button>
      </form>

      {error ? <div className="search-error">{error}</div> : null}

      {result ? (
        <article className="search-result-card">
          <div className="search-result-avatar">
            {String(result.name || 'U').trim().charAt(0).toUpperCase()}
          </div>
          <div className="search-result-copy">
            <div className="search-result-name">{result.name || 'Пользователь'}</div>
            <div className="search-result-phone">{result.phone || ''}</div>
          </div>
          <button type="button" className="btn btn-secondary search-open-btn" onClick={() => onOpenMessages?.(result)}>
            Открыть чат
          </button>
        </article>
      ) : null}

      <style>{`
        .search-page {
          display: grid;
          gap: var(--space-16);
          padding: var(--space-18);
        }

        .search-header {
          display: grid;
          gap: var(--space-10);
        }

        .search-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(96, 165, 250, 0.28);
          background: rgba(37, 99, 235, 0.16);
          color: #bfdbfe;
          font-size: 12px;
          font-weight: 700;
        }

        .search-title {
          margin: 0;
          color: #f8fafc;
          font-size: clamp(24px, 5vw, 32px);
          line-height: 1.1;
        }

        .search-subtitle {
          margin: 0;
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.5;
          max-width: 560px;
        }

        .search-form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: var(--space-10);
          align-items: end;
        }

        .search-field {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .search-field-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .search-input {
          width: 100%;
          min-height: 48px;
          border: 1px solid #334155;
          border-radius: 14px;
          background: #0f172a;
          color: #e2e8f0;
          padding: 0 14px;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .search-input:focus {
          border-color: rgba(79, 124, 255, 0.9);
          box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.18);
        }

        .search-submit {
          min-height: 48px;
          min-width: 120px;
          border-radius: 14px;
        }

        .search-error {
          color: #fca5a5;
          border: 1px solid rgba(248, 113, 113, 0.22);
          border-radius: 12px;
          background: rgba(127, 29, 29, 0.18);
          padding: 12px 14px;
        }

        .search-result-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: var(--space-12);
          align-items: center;
          border: 1px solid #1e293b;
          background: #0b1220;
          border-radius: 16px;
          padding: var(--space-14);
        }

        .search-result-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, rgba(79, 124, 255, 0.8), rgba(59, 130, 246, 0.96));
          color: #eff6ff;
          font-weight: 800;
        }

        .search-result-copy {
          min-width: 0;
        }

        .search-result-name {
          color: #e2e8f0;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .search-result-phone {
          color: #94a3b8;
          margin-top: 4px;
          font-size: 14px;
        }

        .search-open-btn {
          min-height: 44px;
          border-radius: 999px;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .search-page {
            padding: var(--space-14);
          }

          .search-form {
            grid-template-columns: 1fr;
          }

          .search-submit,
          .search-open-btn {
            width: 100%;
          }

          .search-result-card {
            grid-template-columns: auto minmax(0, 1fr);
          }
        }
      `}</style>
    </section>
  );
}
