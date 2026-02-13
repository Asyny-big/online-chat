import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { resolveAssetUrl } from '../../utils/resolveAssetUrl';

const TABS = [
  { key: 'chats', label: 'Чаты', icon: '💬' },
  { key: 'calls', label: 'Звонки', icon: '📞' },
  { key: 'contacts', label: 'Контакты', icon: '👥' },
  { key: 'profile', label: 'Профиль', icon: '👤' }
];

export function MobileBottomNav({ activeTab, onChange }) {
  return (
    <nav className="gm-mobile-bottom-nav" aria-label="Основная навигация">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`gm-mobile-bottom-nav__item ${activeTab === tab.key ? 'is-active' : ''}`}
          onClick={() => onChange?.(tab.key)}
        >
          <span className="gm-mobile-bottom-nav__icon" aria-hidden="true">{tab.icon}</span>
          <span className="gm-mobile-bottom-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function ContextFab({ tab, hidden, onChatsAction, onContactsAction, onProfileAction, onCallsAction }) {
  const config = useMemo(() => {
    if (tab === 'chats') return { icon: '+', label: 'Группа', onClick: onChatsAction };
    if (tab === 'contacts') return { icon: '⌕', label: 'Поиск', onClick: onContactsAction };
    if (tab === 'profile') return { icon: '⚙', label: 'Настройки', onClick: onProfileAction };
    if (tab === 'calls') return { icon: '↗', label: 'Чаты', onClick: onCallsAction };
    return null;
  }, [tab, onCallsAction, onChatsAction, onContactsAction, onProfileAction]);

  if (hidden || !config || !config.onClick) return null;

  return (
    <button type="button" className="gm-context-fab" onClick={config.onClick} aria-label={config.label} title={config.label}>
      {config.icon}
    </button>
  );
}

export function MobileCallsPanel({ chats, incomingCallData, groupCallData, onOpenChat }) {
  const rows = useMemo(() => {
    const list = [];
    if (incomingCallData) {
      list.push({
        id: `incoming-${incomingCallData.callId}`,
        title: incomingCallData.initiator?.name || 'Входящий звонок',
        subtitle: incomingCallData.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок',
        chatId: incomingCallData.chatId,
        tone: 'danger'
      });
    }
    if (groupCallData) {
      list.push({
        id: `group-${groupCallData.callId}`,
        title: groupCallData.chatName || 'Групповой звонок',
        subtitle: groupCallData.type === 'video' ? 'Групповой видеозвонок' : 'Групповой аудиозвонок',
        chatId: groupCallData.chatId,
        tone: 'accent'
      });
    }
    chats.forEach((chat) => {
      if (!chat?.activeGroupCall) return;
      list.push({
        id: `active-${chat._id}-${chat.activeGroupCall.callId}`,
        title: chat.displayName || chat.name || 'Групповой чат',
        subtitle: 'Активный групповой звонок',
        chatId: chat._id,
        tone: 'accent'
      });
    });
    return list;
  }, [chats, groupCallData, incomingCallData]);

  return (
    <section className="gm-mobile-panel">
      <header className="gm-mobile-panel__header">
        <h2>Звонки</h2>
      </header>
      {rows.length === 0 ? (
        <div className="gm-mobile-panel__empty">Активных звонков нет</div>
      ) : (
        <div className="gm-call-list">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`gm-call-list__item tone-${row.tone}`}
              onClick={() => onOpenChat?.(row.chatId)}
            >
              <span className="gm-call-list__title">{row.title}</span>
              <span className="gm-call-list__subtitle">{row.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function MobileProfilePanel({ token, onLogout, settingsOpen, onToggleSettings }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    axios
      .get(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!alive) return;
        setProfile(res.data || null);
      })
      .catch(() => {
        if (!alive) return;
        setProfile(null);
      });
    return () => { alive = false; };
  }, [token]);

  const avatarUrl = resolveAssetUrl(profile?.avatar || '');
  const initial = String(profile?.name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <section className="gm-mobile-panel gm-mobile-profile">
      <header className="gm-mobile-panel__header">
        <h2>Профиль</h2>
      </header>

      <div className="gm-profile-card">
        <div className="gm-profile-card__avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initial}</span>}
        </div>
        <div className="gm-profile-card__meta">
          <div className="gm-profile-card__name">{profile?.name || 'Пользователь'}</div>
          <div className="gm-profile-card__phone">{profile?.phone || 'Номер не указан'}</div>
        </div>
      </div>

      <button type="button" className="gm-profile-settings-toggle" onClick={onToggleSettings}>
        {settingsOpen ? 'Скрыть настройки' : 'Открыть настройки'}
      </button>

      {settingsOpen && (
        <div className="gm-settings-list">
          <div className="gm-settings-list__row">
            <span>Уведомления</span>
            <span className="gm-settings-list__hint">Системные</span>
          </div>
          <div className="gm-settings-list__row">
            <span>Медиа и файлы</span>
            <span className="gm-settings-list__hint">Автозагрузка</span>
          </div>
          <button type="button" className="gm-settings-list__logout" onClick={onLogout}>
            Выйти из аккаунта
          </button>
        </div>
      )}
    </section>
  );
}
