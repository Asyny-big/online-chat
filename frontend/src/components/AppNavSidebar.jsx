import React from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

const NAV_ITEMS = [
  { key: 'feed', label: 'Главная', hash: '#/', icon: '🏠' },
  { key: 'search', label: 'Поиск', hash: '#/search', icon: '🔎' },
  { key: 'notifications', label: 'Уведомления', hash: '#/notifications', icon: '🔔' },
  { key: 'messages', label: 'Сообщения', hash: '#/messages', icon: '💬' },
  { key: 'profile', label: 'Профиль', hash: '#/profile', icon: '👤' }
];

export default function AppNavSidebar({ activeKey, onNavigate, onLogout }) {
  const isDesktop = useMediaQuery('(min-width: 900px)', { defaultValue: true });
  const compact = !isDesktop;

  return (
    <aside style={{ ...styles.sidebar, ...(compact ? styles.sidebarCompact : {}) }}>
      <div style={{ ...styles.brand, ...(compact ? styles.brandCompact : {}) }}>GovChat</div>
      <nav style={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              style={{ ...styles.navBtn, ...(compact ? styles.navBtnCompact : {}), ...(active ? styles.navBtnActive : {}) }}
              onClick={() => onNavigate(item.hash)}
              title={item.label}
            >
              <span style={styles.icon}>{item.icon}</span>
              {!compact ? <span>{item.label}</span> : null}
            </button>
          );
        })}
      </nav>

      <button type="button" style={{ ...styles.logoutBtn, ...(compact ? styles.logoutBtnCompact : {}) }} onClick={onLogout}>
        {compact ? '⎋' : 'Выйти'}
      </button>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 250,
    minWidth: 250,
    height: '100vh',
    background: '#0b1220',
    borderRight: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    padding: '18px 12px',
    boxSizing: 'border-box'
  },
  sidebarCompact: {
    width: 74,
    minWidth: 74,
    padding: '14px 8px'
  },
  brand: {
    color: '#f8fafc',
    fontWeight: 800,
    fontSize: 24,
    letterSpacing: 0.3,
    marginBottom: 16
  },
  brandCompact: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 12
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  navBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#94a3b8',
    borderRadius: 12,
    padding: '10px 12px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 700
  },
  navBtnCompact: {
    justifyContent: 'center',
    padding: '10px 8px'
  },
  navBtnActive: {
    background: 'rgba(14,165,233,0.12)',
    color: '#e0f2fe',
    border: '1px solid rgba(14,165,233,0.38)'
  },
  icon: {
    width: 20,
    textAlign: 'center'
  },
  logoutBtn: {
    marginTop: 'auto',
    border: '1px solid rgba(239,68,68,0.4)',
    background: 'rgba(239,68,68,0.12)',
    color: '#fecaca',
    borderRadius: 12,
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 700
  },
  logoutBtnCompact: {
    padding: '10px 8px'
  }
};
