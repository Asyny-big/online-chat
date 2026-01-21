import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { CLIENT_VERSION } from '../version';

function formatDate(value) {
  try {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
}

function applyTheme(mode) {
  try {
    const root = document.documentElement;
    root.dataset.theme = mode || 'system';
  } catch (_) {}
}

function ProfileDrawer({ token, onClose, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  const initialTheme = useMemo(() => {
    try {
      return localStorage.getItem('themePreference') || 'system';
    } catch {
      return 'system';
    }
  }, []);
  const [themeMode, setThemeMode] = useState(initialTheme);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setProfile(data);
      setNameDraft(String(data?.name || ''));
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    applyTheme(themeMode);
    try {
      localStorage.setItem('themePreference', themeMode);
    } catch (_) {}
  }, [themeMode]);

  const saveName = useCallback(async () => {
    const next = String(nameDraft || '').trim();
    if (!next) {
      setError('Имя не может быть пустым');
      return;
    }
    setSavingName(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setProfile(data);
      setIsEditingName(false);
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить имя');
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, token]);

  const validatePassword = useMemo(() => {
    if (!showPasswordForm) return '';
    if (!currentPassword) return 'Введите текущий пароль';
    if (!newPassword || newPassword.length < 6) return 'Новый пароль должен быть не менее 6 символов';
    if (newPassword !== newPassword2) return 'Пароли не совпадают';
    return '';
  }, [currentPassword, newPassword, newPassword2, showPasswordForm]);

  const changePassword = useCallback(async () => {
    setPasswordMsg('');
    const v = validatePassword;
    if (v) {
      setPasswordMsg(v);
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/me/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setPasswordMsg('Пароль обновлён');
      setCurrentPassword('');
      setNewPassword('');
      setNewPassword2('');
      setShowPasswordForm(false);
    } catch (e) {
      setPasswordMsg(e?.message || 'Не удалось сменить пароль');
    } finally {
      setChangingPassword(false);
    }
  }, [currentPassword, newPassword, token, validatePassword]);

  const logoutAll = useCallback(async () => {
    const ok = window.confirm('Выйти со всех устройств? Придётся заново войти на каждом устройстве.');
    if (!ok) return;

    try {
      await fetch(`${API_URL}/me/logout-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (_) {}

    onLogout?.();
  }, [onLogout, token]);

  const logout = useCallback(() => {
    const ok = window.confirm('Выйти из аккаунта?');
    if (!ok) return;
    onLogout?.();
  }, [onLogout]);

  const heroLetter = (profile?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.topbar}>
          <button style={styles.backBtn} onClick={onClose} title="Назад">←</button>
          <div style={styles.topTitle}>Профиль</div>
          <div style={{ width: 40 }} />
        </div>

        {loading && <div style={styles.centerHint}>Загрузка...</div>}
        {!!error && !loading && <div style={styles.error}>{error}</div>}

        {!loading && profile && (
          <div style={styles.content}>
            {/* Hero */}
            <div style={styles.card}>
              <div style={styles.heroRow}>
                <div style={styles.avatar}>
                  {profile.avatar ? (
                    <img alt="avatar" src={profile.avatar} style={styles.avatarImg} />
                  ) : (
                    heroLetter
                  )}
                </div>

                <div style={styles.heroMain}>
                  <div style={styles.heroNameRow}>
                    {isEditingName ? (
                      <input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        style={styles.nameInput}
                        maxLength={100}
                        placeholder="Имя"
                      />
                    ) : (
                      <div style={styles.heroName}>{profile.name}</div>
                    )}
                    <div style={styles.heroActions}>
                      {!isEditingName ? (
                        <button style={styles.secondaryBtn} onClick={() => setIsEditingName(true)}>
                          Изменить имя
                        </button>
                      ) : (
                        <>
                          <button
                            style={{ ...styles.primaryBtn, ...(savingName ? styles.btnDisabled : {}) }}
                            onClick={saveName}
                            disabled={savingName}
                          >
                            {savingName ? 'Сохранение…' : 'Сохранить'}
                          </button>
                          <button
                            style={styles.secondaryBtn}
                            onClick={() => {
                              setIsEditingName(false);
                              setNameDraft(String(profile?.name || ''));
                            }}
                            disabled={savingName}
                          >
                            Отмена
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={styles.heroMeta}>
                    <div style={styles.metaLabel}>Телефон</div>
                    <div style={styles.metaValue}>{profile.phone}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Аккаунт</div>
              <button style={styles.rowBtn} onClick={() => setShowPasswordForm((v) => !v)}>
                <div>Сменить пароль</div>
                <div style={styles.rowChevron}>{showPasswordForm ? '▴' : '▾'}</div>
              </button>

              {showPasswordForm && (
                <div style={styles.form}>
                  <input
                    type="password"
                    placeholder="Текущий пароль"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={styles.input}
                  />
                  <input
                    type="password"
                    placeholder="Новый пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                  />
                  <input
                    type="password"
                    placeholder="Повтор нового пароля"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                    style={styles.input}
                  />

                  {!!passwordMsg && (
                    <div style={{ ...styles.hint, color: passwordMsg === 'Пароль обновлён' ? '#22c55e' : '#ef4444' }}>
                      {passwordMsg}
                    </div>
                  )}

                  <button
                    style={{ ...styles.primaryBtn, ...(changingPassword || !!validatePassword ? styles.btnDisabled : {}) }}
                    onClick={changePassword}
                    disabled={changingPassword || !!validatePassword}
                  >
                    {changingPassword ? 'Смена…' : 'Обновить пароль'}
                  </button>
                </div>
              )}
            </div>

            {/* Settings */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Настройки</div>

              <div style={styles.fieldRow}>
                <div style={styles.fieldLabel}>Тема</div>
                <div style={styles.segment}>
                  {['light', 'dark', 'system'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setThemeMode(m)}
                      style={{
                        ...styles.segmentBtn,
                        ...(themeMode === m ? styles.segmentBtnActive : {}),
                      }}
                    >
                      {m === 'light' ? 'Светлая' : m === 'dark' ? 'Тёмная' : 'Системная'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.fieldRow}>
                <div style={styles.fieldLabel}>Язык</div>
                <div style={styles.readonlyPill}>Русский (readonly)</div>
              </div>
            </div>

            {/* Info */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>Информация</div>
              <div style={styles.kvRow}>
                <div style={styles.k}>ID</div>
                <div style={styles.v}>{profile.id}</div>
              </div>
              <div style={styles.kvRow}>
                <div style={styles.k}>Дата регистрации</div>
                <div style={styles.v}>{formatDate(profile.createdAt)}</div>
              </div>
              <div style={styles.kvRow}>
                <div style={styles.k}>Версия клиента</div>
                <div style={styles.v}>{CLIENT_VERSION}</div>
              </div>
            </div>

            {/* Danger */}
            <div style={styles.cardDanger}>
              <div style={styles.cardTitle}>Опасная зона</div>
              <button style={styles.dangerBtn} onClick={logoutAll}>
                Выйти со всех устройств
              </button>
              <button style={styles.dangerBtn} onClick={logout}>
                Выйти из аккаунта
              </button>
              <button style={{ ...styles.dangerBtn, ...styles.dangerBtnDisabled }} disabled>
                Удалить аккаунт (скоро)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 20000,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    width: '100%',
    maxWidth: 520,
    height: '100%',
    background: '#0b1220',
    borderLeft: '1px solid rgba(148,163,184,0.18)',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    height: 56,
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    borderBottom: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(15,23,42,0.9)',
    backdropFilter: 'blur(10px)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.7)',
    color: '#e2e8f0',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, background 0.15s ease',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#e2e8f0',
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  centerHint: {
    padding: 24,
    color: '#94a3b8',
  },
  error: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.08)',
    color: '#fecaca',
  },
  content: {
    padding: 16,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
  },
  cardDanger: {
    background: 'rgba(15,23,42,0.8)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 16,
    padding: 14,
    boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
  },
  cardTitle: {
    color: '#e2e8f0',
    fontWeight: 700,
    marginBottom: 10,
  },
  heroRow: { display: 'flex', gap: 14, alignItems: 'center' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: 28,
    flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  heroMain: { flex: 1, minWidth: 0 },
  heroNameRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  heroName: { color: '#e2e8f0', fontSize: 18, fontWeight: 800 },
  nameInput: {
    flex: 1,
    minWidth: 200,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.5)',
    color: '#e2e8f0',
    outline: 'none',
  },
  heroActions: { display: 'flex', gap: 8, marginLeft: 'auto' },
  heroMeta: { marginTop: 8, display: 'flex', gap: 10, alignItems: 'baseline' },
  metaLabel: { color: '#94a3b8', fontSize: 12 },
  metaValue: { color: '#cbd5e1', fontSize: 13, fontWeight: 600 },
  primaryBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(59,130,246,0.35)',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(99,102,241,0.95))',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, filter 0.15s ease',
  },
  secondaryBtn: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.4)',
    color: '#e2e8f0',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    filter: 'grayscale(0.3)',
  },
  rowBtn: {
    width: '100%',
    padding: '12px 12px',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,6,23,0.35)',
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'transform 0.12s ease, background 0.12s ease',
  },
  rowChevron: { color: '#94a3b8' },
  form: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 },
  input: {
    width: '100%',
    padding: '12px 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.45)',
    color: '#e2e8f0',
    outline: 'none',
  },
  hint: { fontSize: 13, color: '#94a3b8' },
  fieldRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  fieldLabel: { color: '#cbd5e1', fontWeight: 600, fontSize: 13 },
  readonlyPill: {
    padding: '8px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.35)',
    color: '#94a3b8',
    fontSize: 12,
  },
  segment: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  segmentBtn: {
    padding: '8px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(2,6,23,0.3)',
    color: '#e2e8f0',
    cursor: 'pointer',
    transition: 'background 0.15s ease, transform 0.15s ease',
    fontSize: 12,
    fontWeight: 700,
  },
  segmentBtnActive: {
    background: 'rgba(59,130,246,0.22)',
    border: '1px solid rgba(59,130,246,0.4)',
  },
  kvRow: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(148,163,184,0.10)' },
  k: { color: '#94a3b8', fontSize: 12 },
  v: { color: '#e2e8f0', fontSize: 12, fontWeight: 600, wordBreak: 'break-all', textAlign: 'right' },
  dangerBtn: {
    width: '100%',
    padding: '12px 12px',
    borderRadius: 14,
    border: '1px solid rgba(239,68,68,0.35)',
    background: 'rgba(239,68,68,0.10)',
    color: '#fecaca',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'transform 0.12s ease, background 0.12s ease',
    marginTop: 10,
  },
  dangerBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default ProfileDrawer;

