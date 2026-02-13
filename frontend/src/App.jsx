import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import { authStyles as styles } from './styles/authStyles';
import { initPushNotifications } from './mobile/pushNotifications';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const cleanup = initPushNotifications({ token });
    return cleanup;
  }, [token]);

  useEffect(() => {
    const handleHash = () => setRoute(window.location.hash);
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

  if (token) {
    if (route === '#/admin') {
      return <AdminPage token={token} onBack={() => { window.location.hash = ''; }} />;
    }
    return <ChatPage token={token} onLogout={handleLogout} />;
  }

  return (
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
}

export default App;
