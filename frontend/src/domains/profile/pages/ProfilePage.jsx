import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/config';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';
import { EconomyStoreProvider } from '@/domains/hrum/store/EconomyStore';
import HrumOverview from '@/domains/profile/components/HrumOverview';
import TasksPanel from '@/domains/profile/components/TasksPanel';
import ShopPanel from '@/domains/profile/components/ShopPanel';
import WalletHistoryPanel from '@/domains/profile/components/WalletHistoryPanel';

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
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  const resolvedAvatarUrl = useMemo(() => resolveAssetUrl(profile?.avatar || ''), [profile?.avatar]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [profile?.avatar]);

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
    if (view === 'history') return 'История';
    return 'Профиль';
  }, [view]);

  return (
    <EconomyStoreProvider token={token}>
      <div className="profile-page">
        {/* Banner/Cover Area */}
        <div className="profile-cover">
          <div className="cover-gradient"></div>
        </div>

        <div className="profile-container">
          {/* Header / Navigation */}
          <div className="profile-nav-header">
            {view !== 'home' && (
              <button onClick={() => setView('home')} className="icon-btn back-btn">←</button>
            )}
            <h2 className="page-title">{headerTitle}</h2>
            <div className="actions">
              <button onClick={onLogout} className="btn btn-ghost danger-text">Выйти</button>
            </div>
          </div>

          {/* User Info Card */}
          <div className="profile-header-card">
            <div className="profile-header-content">
              <div className="profile-avatar-wrapper">
                {resolvedAvatarUrl && !avatarBroken ? (
                  <img
                    alt={profile?.name}
                    src={resolvedAvatarUrl}
                    className="profile-avatar"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    {String(profile?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="profile-info">
                <div className="profile-name-row">
                  {profileLoading ? (
                    <SkeletonLine w={180} />
                  ) : (
                    <h1 className="profile-name">{profile?.name || 'Пользователь'}</h1>
                  )}
                  <span className="badge">GovChat</span>
                </div>

                <div className="profile-details">
                  {profileLoading ? <SkeletonLine w={120} /> : <span className="profile-phone">{profile?.phone}</span>}
                  {profile?.createdAt && (
                    <span className="profile-date">с {new Date(profile.createdAt).toLocaleDateString()}</span>
                  )}
                </div>

                {profileError && <div className="error-text">{profileError}</div>}
              </div>
            </div>
          </div>

          {/* Content Views */}
          <div className="profile-content">
            {view === 'home' && (
              <div className="dashboard-grid">
                <div className="full-width">
                  <HrumOverview
                    onOpenHistory={() => setView('history')}
                    onOpenShop={() => setView('shop')}
                    onOpenTasks={() => setView('tasks')}
                  />
                </div>
                <div className="half-width">
                  <TasksPanel mode="preview" onOpenAll={() => setView('tasks')} />
                </div>
                <div className="half-width">
                  <ShopPanel mode="preview" onOpenAll={() => setView('shop')} />
                </div>
              </div>
            )}

            {view === 'tasks' && <TasksPanel mode="full" />}
            {view === 'shop' && <ShopPanel mode="full" />}
            {view === 'history' && <WalletHistoryPanel />}
          </div>
        </div>

        <style>{`
            .profile-page {
                position: relative;
                min-height: 100%;
                background-color: var(--bg-primary);
            }

            .profile-cover {
                height: 180px;
                background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
                position: relative;
            }

            .cover-gradient {
                position: absolute;
                inset: 0;
                background: linear-gradient(to bottom, transparent, var(--bg-primary));
                opacity: 0.8;
            }

            .profile-container {
                max-width: 900px;
                margin: 0 auto;
                padding: 0 20px 40px;
                position: relative;
                margin-top: -60px; /* Overlap cover */
                z-index: 10;
            }

            .profile-nav-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
                height: 48px;
            }

            .page-title {
                font-size: 20px;
                font-weight: 700;
                display: none; /* Hidden on desktop primarily */
            }

            .profile-header-card {
                background-color: var(--bg-card);
                border-radius: var(--radius-card);
                padding: 24px;
                border: 1px solid var(--border-light);
                margin-bottom: 24px;
                box-shadow: var(--shadow-lg);
            }

            .profile-header-content {
                display: flex;
                align-items: flex-end;
                gap: 24px;
            }

            .profile-avatar-wrapper {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                padding: 4px;
                background-color: var(--bg-card);
                margin-top: -50px; /* Pull up */
                position: relative;
            }

            .profile-avatar, .profile-avatar-fallback {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                background-color: var(--bg-surface);
            }

            .profile-avatar-fallback {
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                font-weight: 700;
                color: var(--text-secondary);
            }

            .profile-info {
                flex: 1;
                padding-bottom: 8px;
            }

            .profile-name-row {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 4px;
            }

            .profile-name {
                font-size: 24px;
                font-weight: 800;
                color: var(--text-primary);
                margin: 0;
            }

            .badge {
                background-color: rgba(139, 92, 246, 0.2);
                color: var(--accent);
                font-size: 12px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 999px;
            }

            .profile-details {
                display: flex;
                gap: 16px;
                color: var(--text-muted);
                font-size: 14px;
                font-weight: 500;
            }

            .dashboard-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
            }

            .full-width {
                grid-column: span 2;
            }

            .danger-text {
                color: var(--danger);
            }
            .danger-text:hover {
                background-color: rgba(239, 68, 68, 0.1);
            }

            @media (max-width: 768px) {
                .dashboard-grid {
                    grid-template-columns: 1fr;
                }
                .full-width, .half-width {
                    grid-column: span 1;
                }
                .profile-header-content {
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    gap: 12px;
                }
                .profile-avatar-wrapper {
                    margin-top: -60px;
                }
                .profile-name-row {
                    justify-content: center;
                }
                .profile-details {
                    justify-content: center;
                }
            }
        `}</style>
      </div>
    </EconomyStoreProvider>
  );
}
