import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import FeedPage from './pages/FeedPage';
import SearchPage from './pages/SearchPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfileRoutePage from './pages/ProfileRoutePage';
import AppNavSidebar from './components/AppNavSidebar';
import { authStyles as styles } from './styles/authStyles';
import { initPushNotifications } from './mobile/pushNotifications';
import AndroidAppDownloadModal from './components/AndroidAppDownloadModal';

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

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const cleanup = initPushNotifications({ token });
    return cleanup;
  }, [token]);

  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = '#/';
    }

    const handleHash = () => setRoute(normalizeRoute(window.location.hash));
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

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
  };

  const navigateTo = (hash) => {
    const nextHash = normalizeRoute(hash);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    } else {
      setRoute(nextHash);
    }
  };

  const renderAppRoute = () => {
    const key = resolveRouteKey(route);

    if (key === 'admin') {
      return <AdminPage token={token} onBack={() => navigateTo('#/')} />;
    }

    if (key === 'messages') {
      return (
        <div style={appStyles.appShell}>
          <AppNavSidebar activeKey="messages" onNavigate={navigateTo} onLogout={handleLogout} />
          <main style={appStyles.contentMessages}>
            <ChatPage token={token} onLogout={handleLogout} />
          </main>
        </div>
      );
    }

    return (
      <div style={appStyles.appShell}>
        <AppNavSidebar activeKey={key} onNavigate={navigateTo} onLogout={handleLogout} />
        <main style={appStyles.content}>
          {key === 'feed' ? <FeedPage token={token} /> : null}
          {key === 'search' ? <SearchPage token={token} onOpenMessages={() => navigateTo('#/messages')} /> : null}
          {key === 'notifications' ? <NotificationsPage token={token} /> : null}
          {key === 'profile' ? (
            <ProfileRoutePage token={token} onLogout={handleLogout} onClose={() => navigateTo('#/')} />
          ) : null}
        </main>
      </div>
    );
  };

  const pageContent = token
    ? renderAppRoute()
    : (
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

  return (
    <>
      {pageContent}
      <AndroidAppDownloadModal />
    </>
  );
}

const appStyles = {
  appShell: {
    display: 'flex',
    minHeight: '100vh',
    background: '#020617'
  },
  content: {
    flex: 1,
    minWidth: 0,
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  contentMessages: {
    flex: 1,
    minWidth: 0,
    height: '100vh',
    overflow: 'hidden'
  }
};

export default App;
