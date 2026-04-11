import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/config';
import { resolveAssetUrl } from '@/shared/lib/resolveAssetUrl';
import { EconomyStoreProvider } from '@/domains/hrum/store/EconomyStore';
import HrumOverview from '@/domains/profile/components/HrumOverview';
import TasksPanel from '@/domains/profile/components/TasksPanel';
import ShopPanel from '@/domains/profile/components/ShopPanel';
import WalletHistoryPanel from '@/domains/profile/components/WalletHistoryPanel';
import FAQPage from '@/domains/profile/components/FAQPage';
import { useOnboarding } from '@/onboarding/OnboardingProvider';

function SkeletonLine({ w = 160 }) {
  return (
    <div
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: 12,
        borderRadius: 999,
        background: 'linear-gradient(90deg, rgba(148,163,184,0.10), rgba(148,163,184,0.24), rgba(148,163,184,0.10))',
        backgroundSize: '200% 100%',
        animation: 'ppShimmer 1.15s ease-in-out infinite'
      }}
    />
  );
}

export default function ProfilePage({ token, onLogout, onOpenSupportChat }) {
  const {
    reset: restartOnboarding,
    isOpen: isOnboardingOpen,
    activeStep
  } = useOnboarding();
  const [view, setView] = useState('home');
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
    void fetchProfile();
  }, [fetchProfile]);

  const headerTitle = useMemo(() => {
    if (view === 'tasks') return 'Задания';
    if (view === 'shop') return 'Магазин';
    if (view === 'history') return 'История';
    if (view === 'faq') return 'Помощь / FAQ';
    return 'Профиль';
  }, [view]);

  const handleHeaderAction = useCallback(() => {
    if (view === 'faq') {
      onOpenSupportChat?.();
      return;
    }
    setView('faq');
  }, [onOpenSupportChat, view]);

  useEffect(() => {
    if (isOnboardingOpen && activeStep?.id === 'support' && view !== 'home') {
      setView('home');
    }
  }, [activeStep?.id, isOnboardingOpen, view]);

  return (
    <EconomyStoreProvider token={token}>
      <div className="profile-page">
        <div className="profile-background-glow" />

        <div className="profile-container">
          <div className="profile-nav-header">
            <div className="profile-left-header">
              {view !== 'home' && (
                <button type="button" onClick={() => setView('home')} className="icon-btn back-btn" aria-label="Назад">
                  {'<'}
                </button>
              )}
              <h2 className="page-title">{headerTitle}</h2>
            </div>

            <div className="actions">
              <button type="button" onClick={restartOnboarding} className="btn btn-ghost profile-tour-btn">
                Тур по приложению
              </button>
              <button type="button" onClick={handleHeaderAction} className="btn btn-secondary profile-help-btn">
                {view === 'faq' ? 'Поддержка' : 'Помощь / FAQ'}
              </button>
              <button type="button" onClick={onLogout} className="btn btn-ghost danger-text">Выйти</button>
            </div>
          </div>

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
                  {profileLoading ? <SkeletonLine w={120} /> : <span className="profile-phone">{profile?.phone || 'Без номера'}</span>}
                  {profile?.createdAt && (
                    <span className="profile-date">с {new Date(profile.createdAt).toLocaleDateString('ru-RU')}</span>
                  )}
                </div>

                {profileError && <div className="error-text">{profileError}</div>}
              </div>
            </div>
          </div>

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

                <div className="full-width">
                  <section className="profile-help-card" aria-label="Блок помощи">
                    <div className="profile-help-copy">
                      <span className="profile-help-eyebrow">Помощь / FAQ</span>
                      <h3 className="profile-help-title">Готовые ответы и быстрый переход в поддержку</h3>
                      <p className="profile-help-text">
                        Раздел FAQ собран для новичков: сообщения, файлы, доступ и поиск пользователей.
                        Если ответа нет, можно сразу открыть чат поддержки GovChat.
                      </p>
                      <div className="profile-help-tags">
                        <span>Сообщения</span>
                        <span>Аккаунт</span>
                        <span>Файлы</span>
                        <span>Поиск</span>
                      </div>
                    </div>

                    <div className="profile-help-actions">
                      <button type="button" className="btn btn-primary" onClick={() => setView('faq')}>
                        Открыть FAQ
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onOpenSupportChat}
                        data-onboarding-id="profile-support-button"
                      >
                        Задать вопрос
                      </button>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {view === 'tasks' && <TasksPanel mode="full" />}
            {view === 'shop' && <ShopPanel mode="full" />}
            {view === 'history' && <WalletHistoryPanel />}
            {view === 'faq' && <FAQPage onOpenSupportChat={onOpenSupportChat} />}
          </div>
        </div>

        <style>{`
          .profile-page {
            position: relative;
            min-height: 100%;
            padding: var(--space-8) 0 var(--space-24);
            background:
              radial-gradient(circle at 8% 12%, rgba(56, 189, 248, 0.15), transparent 38%),
              radial-gradient(circle at 95% 4%, rgba(99, 102, 241, 0.18), transparent 32%),
              var(--bg-primary);
          }

          .profile-background-glow {
            position: absolute;
            top: -90px;
            left: 50%;
            transform: translateX(-50%);
            width: min(980px, 86vw);
            height: 260px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.24), transparent 72%);
            filter: blur(32px);
            pointer-events: none;
          }

          .profile-container {
            max-width: 980px;
            margin: 0 auto;
            padding: 0 var(--space-12) var(--space-24);
            position: relative;
            z-index: 2;
          }

          .profile-nav-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-12);
            margin-bottom: var(--space-16);
            min-height: 48px;
          }

          .profile-left-header,
          .actions {
            display: flex;
            align-items: center;
            gap: var(--space-10);
            min-width: 0;
          }

          .page-title {
            font-size: 22px;
            font-weight: 780;
            color: var(--text-primary);
            margin: 0;
            letter-spacing: 0.01em;
          }

          .back-btn {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.7);
          }

          .profile-help-btn {
            border-color: rgba(96, 165, 250, 0.22);
            color: #dbeafe;
            background: rgba(59, 130, 246, 0.12);
          }

          .profile-help-btn:hover {
            border-color: rgba(96, 165, 250, 0.4);
            background: rgba(59, 130, 246, 0.2);
            color: #eff6ff;
          }

          .profile-tour-btn {
            border-color: rgba(148, 163, 184, 0.22);
            color: var(--text-primary);
          }

          .profile-tour-btn:hover {
            border-color: rgba(96, 165, 250, 0.26);
            color: #eff6ff;
          }

          .profile-header-card {
            background:
              linear-gradient(180deg, rgba(15, 23, 42, 0.86), rgba(15, 23, 42, 0.72)),
              var(--bg-card);
            border-radius: var(--radius-xl);
            padding: var(--space-20);
            border: 1px solid var(--border-color);
            margin-bottom: var(--space-16);
            box-shadow: var(--shadow-xl);
          }

          .profile-header-content {
            display: flex;
            align-items: center;
            gap: var(--space-16);
          }

          .profile-avatar-wrapper {
            width: 104px;
            height: 104px;
            border-radius: 50%;
            padding: 4px;
            background: linear-gradient(145deg, rgba(59, 130, 246, 0.75), rgba(99, 102, 241, 0.8));
            box-shadow: 0 10px 28px rgba(37, 99, 235, 0.35);
            flex-shrink: 0;
          }

          .profile-avatar,
          .profile-avatar-fallback {
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
            font-size: 34px;
            font-weight: 800;
            color: var(--text-secondary);
          }

          .profile-info {
            flex: 1;
            min-width: 0;
          }

          .profile-name-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: var(--space-10);
            margin-bottom: var(--space-8);
          }

          .profile-name {
            font-size: 28px;
            font-weight: 820;
            color: var(--text-primary);
            margin: 0;
            letter-spacing: -0.01em;
          }

          .badge {
            background-color: rgba(59, 130, 246, 0.2);
            color: #bfdbfe;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid rgba(96, 165, 250, 0.3);
          }

          .profile-details {
            display: flex;
            flex-wrap: wrap;
            gap: var(--space-12);
            color: var(--text-muted);
            font-size: 14px;
            font-weight: 600;
          }

          .profile-phone { color: var(--text-secondary); }
          .profile-date { color: var(--text-muted); }
          .error-text { margin-top: var(--space-8); color: #fda4af; font-size: 13px; }
          .profile-content { border-radius: var(--radius-xl); }

          .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-12);
          }

          .full-width { grid-column: span 2; }

          .profile-help-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-20);
            border-radius: 24px;
            padding: clamp(18px, 3vw, 24px);
            border: 1px solid var(--border-color);
            background:
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.2), transparent 28%),
              linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.82)),
              var(--bg-card);
            box-shadow: var(--shadow-xl);
          }

          .profile-help-copy { min-width: 0; flex: 1; }

          .profile-help-eyebrow {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0 12px;
            border-radius: 999px;
            background: rgba(59, 130, 246, 0.16);
            border: 1px solid rgba(96, 165, 250, 0.24);
            color: #bfdbfe;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .profile-help-title {
            margin: var(--space-12) 0 var(--space-8);
            color: var(--text-primary);
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.02em;
          }

          .profile-help-text {
            margin: 0;
            color: var(--text-secondary);
            font-size: 14px;
            max-width: 680px;
          }

          .profile-help-tags {
            display: flex;
            flex-wrap: wrap;
            gap: var(--space-8);
            margin-top: var(--space-14);
          }

          .profile-help-tags span {
            display: inline-flex;
            align-items: center;
            min-height: 28px;
            padding: 0 12px;
            border-radius: 999px;
            background: rgba(148, 163, 184, 0.1);
            border: 1px solid rgba(148, 163, 184, 0.14);
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 700;
          }

          .profile-help-actions {
            display: grid;
            gap: var(--space-10);
            flex-shrink: 0;
            min-width: min(220px, 100%);
          }

          .danger-text { color: #fda4af; }
          .danger-text:hover { background-color: rgba(244, 63, 94, 0.16); color: #fecdd3; }

          @media (max-width: 768px) {
            .dashboard-grid { grid-template-columns: 1fr; }
            .full-width,
            .half-width { grid-column: span 1; }
            .profile-header-content,
            .profile-help-card,
            .profile-nav-header,
            .actions {
              flex-direction: column;
              align-items: stretch;
            }
            .profile-name-row,
            .profile-details { justify-content: center; }
            .profile-header-content { text-align: center; }
            .actions > * { width: 100%; }
            .profile-help-title { font-size: 21px; }
          }
        `}</style>
      </div>
    </EconomyStoreProvider>
  );
}
