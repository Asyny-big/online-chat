import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import ChatPage from './domains/messages/pages/ChatPage';
import AdminPage from './pages/AdminPage';
import FeedPage from './domains/feed/pages/FeedPage';
import SearchPage from './domains/search/pages/SearchPage';
import NotificationsPage from './domains/notifications/pages/NotificationsPage';
import ProfileRoutePage from './domains/profile/pages/ProfileRoutePage';
import RightPanel from './components/RightPanel';
import { authStyles as styles } from './styles/authStyles';
import AndroidAppDownloadModal from './components/AndroidAppDownloadModal';
import AppShell from './app/AppShell';
import RootProviders from './app/providers/RootProviders';
import { initNotificationSound, playNotificationTone } from '@/shared/lib/playNotificationTone';

const UNREAD_BADGES_REFRESH_EVENT = 'govchat:unread-badges-refresh';

function normalizeRoute(hash) {
  const value = String(hash || '').trim();
  if (!value || value === '#') return '#/';
  return value;
}

function resolveRouteKey(hash) {
  const route = normalizeRoute(hash);
  if (route === '#/' || route === '#/feed') return 'feed';
  if (route === '#/search') return 'search';
  if (route === '#/notifications') return 'notifications';
  if (route === '#/messages') return 'messages';
  if (route === '#/profile') return 'profile';
  if (route === '#/admin') return 'admin';
  return 'feed';
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(normalizeRoute(window.location.hash));
  const [pendingPrivateChatTarget, setPendingPrivateChatTarget] = useState(null);
  const [navBadgeCounts, setNavBadgeCounts] = useState({ notifications: 0, messages: 0 });
  const prevUnreadRef = useRef({ notifications: 0, messages: 0 });
  const unreadInitializedRef = useRef(false);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
  }, [token]);

  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#/';
    }

    const handleHash = () => setRoute(normalizeRoute(window.location.hash));
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    if (!token) {
      setNavBadgeCounts({ notifications: 0, messages: 0 });
      prevUnreadRef.current = { notifications: 0, messages: 0 };
      unreadInitializedRef.current = false;
      return undefined;
    }

    initNotificationSound();

    let cancelled = false;

    const refreshUnreadBadges = async () => {
      try {
        const [notificationsRes, chatsRes] = await Promise.all([
          axios.get(`${API_URL}/social/notifications?limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_URL}/chats`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (cancelled) return;

        const notificationsItems = Array.isArray(notificationsRes.data?.items)
          ? notificationsRes.data.items
          : [];
        const chatsItems = Array.isArray(chatsRes.data) ? chatsRes.data : [];

        const unreadNotifications = notificationsItems.reduce(
          (sum, item) => sum + (item?.read ? 0 : 1),
          0
        );
        const unreadMessages = chatsItems.reduce(
          (sum, chat) => sum + Math.max(0, Number(chat?.unreadCount || 0)),
          0
        );

        const nextCounts = {
          notifications: unreadNotifications,
          messages: unreadMessages
        };

        setNavBadgeCounts(nextCounts);

        if (unreadInitializedRef.current) {
          const hasNewNotifications = nextCounts.notifications > prevUnreadRef.current.notifications;
          const hasNewMessages = nextCounts.messages > prevUnreadRef.current.messages;
          if (hasNewNotifications || hasNewMessages) {
            playNotificationTone();
          }
        } else {
          unreadInitializedRef.current = true;
        }

        prevUnreadRef.current = nextCounts;
      } catch (_) {
        // Keep previous badge values if one of sources is temporarily unavailable.
      }
    };

    void refreshUnreadBadges();

    const intervalId = setInterval(() => {
      void refreshUnreadBadges();
    }, 5000);

    const handleFocus = () => {
      void refreshUnreadBadges();
    };

    const handleManualRefresh = () => {
      void refreshUnreadBadges();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener(UNREAD_BADGES_REFRESH_EVENT, handleManualRefresh);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener(UNREAD_BADGES_REFRESH_EVENT, handleManualRefresh);
    };
  }, [token, route]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login' ? { phone, password } : { phone, name, password };
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      setToken(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setPhone('');
    setPassword('');
    setName('');
    setNavBadgeCounts({ notifications: 0, messages: 0 });
    prevUnreadRef.current = { notifications: 0, messages: 0 };
    unreadInitializedRef.current = false;
  };

  const navigateTo = (hash) => {
    const nextHash = normalizeRoute(hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute(nextHash);
    }
  };

  const handlePendingPrivateChatHandled = useCallback((requestId) => {
    setPendingPrivateChatTarget((prev) => {
      if (!prev) return null;
      if (!requestId) return null;
      return prev.requestId === requestId ? null : prev;
    });
  }, []);

  const buildRouteView = () => {
    const key = resolveRouteKey(route);

    switch (key) {
      case 'admin':
        return {
          key,
          showPrimaryNav: false,
          withRightPanel: false,
          rightPanel: null,
          content: <AdminPage token={token} onBack={() => navigateTo('#/')} />
        };

      case 'messages':
        return {
          key,
          showPrimaryNav: true,
          withRightPanel: false,
          rightPanel: null,
          content: (
            <ChatPage
              token={token}
              onLogout={handleLogout}
              pendingPrivateChatTarget={pendingPrivateChatTarget}
              onPendingPrivateChatHandled={handlePendingPrivateChatHandled}
            />
          )
        };

      case 'search':
        return {
          key,
          showPrimaryNav: true,
          withRightPanel: true,
          rightPanel: <RightPanel />,
          content: (
            <div className="page-frame">
              <div className="page-rail page-rail--wide">
                <SearchPage
                  token={token}
                  onOpenMessages={(user) => {
                    const targetUserId = String(user?._id || user?.id || '').trim();
                    if (targetUserId) {
                      setPendingPrivateChatTarget({
                        requestId: `search-${Date.now()}`,
                        userId: targetUserId,
                        userName: String(user?.name || '')
                      });
                    }
                    navigateTo('#/messages');
                  }}
                />
              </div>
            </div>
          )
        };

      case 'notifications':
        return {
          key,
          showPrimaryNav: true,
          withRightPanel: true,
          rightPanel: <RightPanel />,
          content: (
            <div className="page-frame">
              <div className="page-rail">
                <NotificationsPage token={token} />
              </div>
            </div>
          )
        };

      case 'profile':
        return {
          key,
          showPrimaryNav: true,
          withRightPanel: false,
          rightPanel: null,
          content: (
            <div className="page-frame">
              <div className="page-rail page-rail--profile">
                <ProfileRoutePage token={token} onLogout={handleLogout} onClose={() => navigateTo('#/')} />
              </div>
            </div>
          )
        };

      case 'feed':
      default:
        return {
          key: 'feed',
          showPrimaryNav: true,
          withRightPanel: true,
          rightPanel: <RightPanel />,
          content: (
            <div className="page-frame">
              <div className="page-rail page-rail--narrow">
                <FeedPage token={token} />
              </div>
            </div>
          )
        };
    }
  };

  const authView = (
    <div style={styles.authContainer}>
      <div style={styles.authBox}>
        <h1 style={styles.title}>
          <span>🦆</span>
          GovChat
        </h1>
        <p style={styles.subtitle}>Современный мессенджер</p>

        <div style={styles.tabs}>
          <button
            onClick={() => setAuthMode('login')}
            style={{ ...styles.tab, ...(authMode === 'login' ? styles.tabActive : {}) }}
          >
            Вход
          </button>
          <button
            onClick={() => setAuthMode('register')}
            style={{ ...styles.tab, ...(authMode === 'register' ? styles.tabActive : {}) }}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleAuth} style={styles.form}>
          {authMode === 'register' && (
            <input
              type="text"
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
              required
            />
          )}

          <input
            type="tel"
            placeholder="Номер телефона"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
            required
          />

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : (authMode === 'login' ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>
      </div>
    </div>
  );

  const appView = (() => {
    const routeView = buildRouteView();
    return (
      <AppShell
        showPrimaryNav={routeView.showPrimaryNav}
        activeNavKey={routeView.key}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        navBadgeCounts={navBadgeCounts}
        withRightPanel={routeView.withRightPanel}
        rightPanel={routeView.rightPanel}
        overlay={<AndroidAppDownloadModal />}
      >
        {routeView.content}
      </AppShell>
    );
  })();

  return (
    <RootProviders token={token} setToken={setToken}>
      {token ? appView : authView}
    </RootProviders>
  );
}

export default App;
