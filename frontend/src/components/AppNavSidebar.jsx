import React from 'react';
import {
  BellIcon,
  DuckIcon,
  HomeIcon,
  MessageIcon,
  SearchIcon,
  UserIcon
} from '@/shared/ui/Icons';

const NAV_ITEMS = [
  { key: 'feed', label: 'Главная', hash: '#/', Icon: HomeIcon },
  { key: 'search', label: 'Поиск', hash: '#/search', Icon: SearchIcon },
  { key: 'notifications', label: 'Уведомления', hash: '#/notifications', Icon: BellIcon },
  { key: 'messages', label: 'Сообщения', hash: '#/messages', Icon: MessageIcon },
  { key: 'profile', label: 'Профиль', hash: '#/profile', Icon: UserIcon }
];

export default function AppNavSidebar({ activeKey, onNavigate, badgeCounts = {} }) {
  return (
    <aside className="app-nav-sidebar" aria-label="Primary navigation">
      <div className="app-nav-header">
        <div className="app-logo" aria-hidden="true">
          <DuckIcon size={22} />
        </div>
      </div>

      <nav className="app-nav-menu">
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          const IconComponent = item.Icon;
          const rawBadgeCount = item.key === 'notifications'
            ? Number(badgeCounts.notifications || 0)
            : item.key === 'messages'
              ? Number(badgeCounts.messages || 0)
              : 0;
          const badgeCount = Number.isFinite(rawBadgeCount) ? Math.max(0, Math.trunc(rawBadgeCount)) : 0;
          const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);
          return (
            <button
              key={item.key}
              type="button"
              className={`app-nav-item ${active ? 'active' : ''}`}
              onClick={() => onNavigate(item.hash)}
              aria-current={active ? 'page' : undefined}
              data-onboarding-id={`nav-${item.key}`}
            >
              <span className="app-nav-icon" aria-hidden="true">
                <IconComponent size={20} />
              </span>
              {badgeCount > 0 ? <span className="app-nav-badge">{badgeLabel}</span> : null}
              <span className="app-nav-tooltip">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <style>{`
        .app-nav-sidebar {
          width: var(--sidebar-width);
          min-height: 100%;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .app-nav-badge {
          position: absolute;
          top: -3px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #ef4444, #f43f5e);
          color: #fff;
          border: 2px solid var(--bg-primary);
          box-shadow: 0 6px 12px rgba(239, 68, 68, 0.35);
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          pointer-events: none;
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

        @media (max-width: 768px) {
          .app-nav-sidebar {
            position: fixed;
            top: auto;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            min-height: 0;
            height: calc(var(--bottom-nav-height) + var(--safe-area-bottom));
            padding:
              var(--space-8)
              max(var(--space-10), var(--safe-area-right))
              max(var(--space-8), var(--safe-area-bottom))
              max(var(--space-10), var(--safe-area-left));
            border-right: none;
            border-top: 1px solid var(--border-color);
            flex-direction: row;
            justify-content: center;
            background:
              radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.14), transparent 52%),
              rgba(7, 11, 20, 0.94);
            backdrop-filter: blur(18px);
          }

          .app-nav-header {
            display: none;
          }

          .app-nav-menu {
            width: 100%;
            flex-direction: row;
            justify-content: space-around;
            align-items: center;
            gap: 0;
          }

          .app-nav-item {
            flex: 1;
            width: auto;
            min-width: 0;
            height: 100%;
            border-radius: 12px;
            flex-direction: column;
            padding: 8px 0;
            background: transparent;
            border: none;
          }

          .app-nav-item.active {
            background: transparent;
            box-shadow: none;
            color: #60a5fa;
            border: none;
            transform: none;
          }

          .app-nav-badge {
            top: 4px;
            right: calc(50% - 16px);
            border-color: rgba(7, 11, 20, 0.94);
            transform: scale(0.9);
          }

          .app-nav-tooltip {
            display: none; /* Hide text on mobile for clean icon-only bottom nav */
          }
        }
      `}</style>
    </aside>
  );
}

