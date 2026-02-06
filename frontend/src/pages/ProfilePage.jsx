import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '../config';
import { EconomyStoreProvider } from '../economy/EconomyStore';
import HrumOverview from './profile/HrumOverview';
import TasksPanel from './profile/TasksPanel';
import ShopPanel from './profile/ShopPanel';
import WalletHistoryPanel from './profile/WalletHistoryPanel';

function ensureProfilePageStyles() {
  if (typeof document === 'undefined') return;
  const id = 'govchat-profile-page-styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @keyframes ppFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes ppShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 140% 50%; } }
  `;
  document.head.appendChild(style);
}

function SkeletonLine({ w = 160 }) {
  return (
    <div
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: 12,
        borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
        backgroundSize: '200% 100%',
        animation: 'ppShimmer 1.15s ease-in-out infinite'
      }}
    />
  );
}

export default function ProfilePage({ token, onClose, onLogout }) {
  const [view, setView] = useState('home'); // home | tasks | shop | history
  const [profile, setProfile] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    setAvatarBroken(false);
  }, [profile?.avatar]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    ensureProfilePageStyles();
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP_${res.status}`);
      setProfile(data);
    } catch (e) {
      setProfileError(e?.message || 'profile_failed');
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const headerTitle = useMemo(() => {
    if (view === 'tasks') return 'Задания';
    if (view === 'shop') return 'Магазин';
    if (view === 'history') return 'История Хрумов';
    return 'Профиль';
  }, [view]);

  const showBack = view !== 'home';

  return (
    <EconomyStoreProvider token={token}>
      <div style={styles.overlay}>
        <div style={styles.bg} />
        <div style={styles.content}>
          <div style={styles.topBar}>
            <div style={styles.topLeft}>
              {showBack ? (
                <button type="button" onClick={() => setView('home')} style={styles.iconBtn} title="Назад">
                  ←
                </button>
              ) : (
                <div style={{ width: 40 }} />
              )}
              <div style={styles.topTitle}>{headerTitle}</div>
            </div>

            <div style={styles.topRight}>
              <button type="button" onClick={fetchProfile} style={styles.ghostBtn} disabled={profileLoading}>
                Обновить
              </button>
              <button type="button" onClick={onLogout} style={styles.dangerBtn}>
                Выйти
              </button>
              <button type="button" onClick={onClose} style={styles.iconBtn} title="Закрыть">
                ✕
              </button>
            </div>
          </div>

          <div style={styles.headerCard}>
            <div style={styles.headerInner}>
              <div style={styles.avatar}>
                  {profile?.avatar && !avatarBroken ? (
                    <img
                      alt=""
                      src={resolveAssetUrl(profile.avatar)}
                      style={styles.avatarImg}
                      onError={() => setAvatarBroken(true)}
                    />
                ) : (
                  <div style={styles.avatarFallback}>
                    {String(profile?.name || 'U')
                      .trim()
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div style={styles.headerText}>
                <div style={styles.nameRow}>
                  {profileLoading ? <SkeletonLine w={220} /> : <div style={styles.name}>{profile?.name || '—'}</div>}
                  <div style={styles.badge}>GovChat</div>
                </div>
                <div style={styles.subRow}>
                  {profileLoading ? <SkeletonLine w={160} /> : <div style={styles.subText}>{profile?.phone || '—'}</div>}
                  {profile?.createdAt ? <div style={styles.subMuted}>с {new Date(profile.createdAt).toLocaleDateString()}</div> : null}
                </div>
                {profileError ? <div style={styles.errorText}>{profileError}</div> : null}
              </div>
            </div>
          </div>

          {view === 'home' && (
            <div style={styles.grid}>
              <div style={styles.colSpan12}>
                <HrumOverview onOpenHistory={() => setView('history')} onOpenShop={() => setView('shop')} onOpenTasks={() => setView('tasks')} />
              </div>
              <div style={styles.colSpan6}>
                <TasksPanel mode="preview" onOpenAll={() => setView('tasks')} />
              </div>
              <div style={styles.colSpan6}>
                <ShopPanel mode="preview" onOpenAll={() => setView('shop')} />
              </div>
            </div>
          )}

          {view === 'tasks' && <TasksPanel mode="full" />}
          {view === 'shop' && <ShopPanel mode="full" />}
          {view === 'history' && <WalletHistoryPanel />}
        </div>
      </div>
    </EconomyStoreProvider>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    overflow: 'auto',
    background: '#0b1220'
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background:
      'radial-gradient(1200px 800px at 10% 10%, rgba(99,102,241,0.22), rgba(0,0,0,0) 60%), radial-gradient(900px 700px at 70% 20%, rgba(168,85,247,0.18), rgba(0,0,0,0) 55%), radial-gradient(900px 700px at 40% 90%, rgba(34,197,94,0.10), rgba(0,0,0,0) 55%)',
    filter: 'saturate(1.05)'
  },
  content: {
    position: 'relative',
    maxWidth: 1200,
    margin: '0 auto',
    padding: 22,
    animation: 'ppFadeUp 0.24s ease-out'
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 240 },
  topRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  topTitle: { color: '#e2e8f0', fontWeight: 900, fontSize: 18, letterSpacing: 0.2 },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(2,6,23,0.45)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 900
  },
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
  dangerBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(244,63,94,0.28)',
    background: 'rgba(244,63,94,0.12)',
    color: '#fecdd3',
    cursor: 'pointer',
    fontWeight: 900
  },

  headerCard: {
    borderRadius: 22,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.55)',
    boxShadow: '0 14px 40px rgba(0,0,0,0.38)',
    backdropFilter: 'blur(10px)',
    padding: 18
  },
  headerInner: { display: 'flex', alignItems: 'center', gap: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.2))',
    overflow: 'hidden',
    flexShrink: 0
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    color: '#e2e8f0',
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: 0.3
  },
  headerText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  avatarActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name: { color: '#e2e8f0', fontWeight: 950, fontSize: 26, letterSpacing: 0.2 },
  badge: {
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(168,85,247,0.28)',
    background: 'rgba(168,85,247,0.12)',
    color: '#ddd6fe',
    fontWeight: 900,
    fontSize: 12
  },
  subRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  subText: { color: '#cbd5e1', fontWeight: 800 },
  subMuted: { color: '#94a3b8', fontWeight: 800, fontSize: 12 },
  errorText: { color: '#fca5a5', fontWeight: 900, fontSize: 12 },

  grid: {
    marginTop: 16,
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    gap: 14
  },
  colSpan12: { gridColumn: 'span 12' },
  colSpan6: { gridColumn: 'span 6' }
};

