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

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
  }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login' ? { phone, password } : { phone, name, password };
      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      setToken(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка авторизации');
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
    <div style={styles.authContainer}>
      <div style={styles.authBox}>
        <h1 style={styles.title}>GovChat</h1>
        
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
              placeholder="Имя"
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
          
          <button type="submit" style={styles.button}>
            {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
