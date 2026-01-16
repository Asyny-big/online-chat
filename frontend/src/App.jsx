import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from './config';
import ChatPage from './pages/ChatPage';
import { authStyles as styles } from './styles/authStyles';

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

  if (token) return <ChatPage token={token} onLogout={handleLogout} />;

  return (
    <div style={styles.authContainer} data-auth-element>
      <div style={styles.authBox}>
        <h1 style={styles.title}>
          <span>🦆</span>
          GovChat
        </h1>
        <p style={styles.subtitle}>Современный мессенджер с видеозвонками</p>
        
        <div style={styles.tabs}>
          <button
            onClick={() => setAuthMode('login')}
            style={{ ...styles.tab, ...(authMode === 'login' ? styles.tabActive : {}) }}
            data-auth-tab
            data-auth-tab-active={authMode === 'login' ? 'true' : undefined}
          >
            Вход
          </button>
          <button
            onClick={() => setAuthMode('register')}
            style={{ ...styles.tab, ...(authMode === 'register' ? styles.tabActive : {}) }}
            data-auth-tab
            data-auth-tab-active={authMode === 'register' ? 'true' : undefined}
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
              data-auth-input
              required
            />
          )}
          
          <input
            type="tel"
            placeholder="Номер телефона"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
            data-auth-input
            required
          />
          
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            data-auth-input
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
            data-auth-button
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading"></span>
                <span style={{ marginLeft: '8px' }}>Загрузка...</span>
              </>
            ) : (
              authMode === 'login' ? 'Войти' : 'Зарегистрироваться'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
