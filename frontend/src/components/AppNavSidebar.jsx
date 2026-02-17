import React from 'react';

const NAV_ITEMS = [
  { key: 'feed', label: 'Главная', hash: '#/', icon: '🏠' },
  { key: 'search', label: 'Поиск', hash: '#/search', icon: '🔎' },
  { key: 'notifications', label: 'Уведомления', hash: '#/notifications', icon: '🔔' },
  { key: 'messages', label: 'Сообщения', hash: '#/messages', icon: '💬' },
  { key: 'profile', label: 'Профиль', hash: '#/profile', icon: '👤' }
];

export default function AppNavSidebar({ activeKey, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">🦆</div>
      </div>

      <nav className="nav-menu">
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => onNavigate(item.hash)}
              title={item.label} // Native tooltip for now
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="tooltip">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="nav-item logout"
          onClick={onLogout}
          title="Выйти"
        >
          <span className="nav-icon">⎋</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          background-color: var(--bg-primary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .sidebar-header {
          margin-bottom: 40px;
        }

        .logo {
          font-size: 28px;
          filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.3));
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          align-items: center;
        }

        .nav-item {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: var(--transition-fast);
          position: relative;
        }

        .nav-item:hover {
          background-color: var(--bg-surface);
          color: var(--text-primary);
        }

        .nav-item.active {
          background-color: var(--accent);
          color: white;
          box-shadow: var(--shadow-glow);
        }

        .nav-icon {
          font-size: 22px;
        }

        .sidebar-footer {
          margin-top: auto;
        }

        .logout {
          color: var(--danger);
        }

        .logout:hover {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--danger);
        }

        /* Tooltip implementation */
        .tooltip {
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 12px;
          background-color: var(--bg-card);
          color: var(--text-primary);
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s;
          border: 1px solid var(--border-color);
          z-index: 100;
        }

        .nav-item:hover .tooltip {
          opacity: 1;
          visibility: visible;
        }
      `}</style>
    </aside>
  );
}

