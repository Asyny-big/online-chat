import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import ChatPage from './pages/ChatPage';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
  }, [token]);

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
    return (
      <div className="app-container">
        <div className="ambient-mesh">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
        <ChatPage token={token} onLogout={handleLogout} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="ambient-mesh">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">
            GovChat
          </h1>
          <p className="auth-subtitle">С возвращением! Мы скучали.</p>

          <form onSubmit={handleAuth}>
            {authMode === 'register' && (
              <div className="auth-input-group">
                <input
                  type="text"
                  placeholder="Ваше имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="modern-input"
                  required
                />
              </div>
            )}

            <div className="auth-input-group">
              <input
                type="tel"
                placeholder="Номер телефона"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="modern-input"
                required
              />
            </div>

            <div className="auth-input-group">
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="modern-input"
                required
              />
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

            <button
              type="submit"
              className="primary-btn"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Загрузка...' : (authMode === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {authMode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              </span>
              <button
                type="button"
                className="text-btn"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                style={{ display: 'inline', marginLeft: '0.5rem', marginTop: 0 }}
              >
                {authMode === 'login' ? 'Регистрация' : 'Войти'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
