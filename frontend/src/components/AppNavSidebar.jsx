import React from 'react';

const NAV_ITEMS = [
  { key: 'feed', label: 'Главная', hash: '#/', icon: 'H' },
  { key: 'search', label: 'Поиск', hash: '#/search', icon: 'S' },
  { key: 'notifications', label: 'Уведомления', hash: '#/notifications', icon: 'N' },
  { key: 'messages', label: 'Сообщения', hash: '#/messages', icon: 'M' },
  { key: 'profile', label: 'Профиль', hash: '#/profile', icon: 'P' }
];

export default function AppNavSidebar({ activeKey, onNavigate, onLogout }) {
  return (
    <aside className="app-nav-sidebar" aria-label="Primary navigation">
      <div className="app-nav-header">
        <div className="app-logo" aria-hidden="true">GC</div>
      </div>

      <nav className="app-nav-menu">
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`app-nav-item ${active ? 'active' : ''}`}
              onClick={() => onNavigate(item.hash)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="app-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="app-nav-tooltip">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="app-nav-footer">
        <button
          type="button"
          className="app-nav-item logout"
          onClick={onLogout}
          title="Выйти"
          aria-label="Выйти"
        >
          <span className="app-nav-icon" aria-hidden="true">Q</span>
        </button>
      </div>

      <style>{`
        .app-nav-sidebar {
          width: var(--sidebar-width);
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(59, 130, 246, 0.2), transparent 42%),
            var(--bg-primary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--space-20) 0;
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(10px);
        }

        .app-nav-header {
          margin-bottom: var(--space-24);
        }

        .app-logo {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #dbeafe;
          background: linear-gradient(145deg, rgba(59, 130, 246, 0.78), rgba(79, 70, 229, 0.82));
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.34);
        }

        .app-nav-menu {
          display: flex;
          flex-direction: column;
          gap: var(--space-10);
          width: 100%;
          align-items: center;
        }

        .app-nav-item {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          transition: var(--transition-normal);
          position: relative;
          border: 1px solid transparent;
        }

        .app-nav-item:hover {
          background-color: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-color);
          transform: translateY(-1px);
        }

        .app-nav-item.active {
          color: #e0e7ff;
          background: linear-gradient(145deg, rgba(59, 130, 246, 0.95), rgba(79, 70, 229, 0.9));
          border-color: rgba(96, 165, 250, 0.4);
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.35);
        }

        .app-nav-icon {
          font-size: 18px;
          line-height: 1;
        }

        .app-nav-footer {
          margin-top: auto;
        }

        .app-nav-item.logout {
          color: #fda4af;
        }

        .app-nav-item.logout:hover {
          color: #fecdd3;
          background-color: rgba(244, 63, 94, 0.16);
          border-color: rgba(244, 63, 94, 0.24);
        }

        .app-nav-tooltip {
          position: absolute;
          left: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%);
          background-color: var(--bg-card);
          color: var(--text-primary);
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.2s ease;
          border: 1px solid var(--border-color);
          z-index: 100;
        }

        .app-nav-item:hover .app-nav-tooltip {
          opacity: 1;
          visibility: visible;
        }
      `}</style>
    </aside>
  );
}

