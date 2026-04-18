import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import MessageInput from './MessageInput';
import MediaViewerModal from './MediaViewerModal';
import { API_URL } from '@/config';
import { DuckIcon, MessageIcon, PlusIcon, SearchIcon } from '@/shared/ui/Icons';
import { parseMessageTextParts } from '@/shared/lib/messageLinks';
import { getPreferredPlayableAudioMimeType } from '@/utils/audioFormats';

function parsePresenceDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatPresenceText(status, lastSeen) {
  if (String(status || '').trim().toLowerCase() === 'online') {
    return 'в сети';
  }

  const date = parsePresenceDate(lastSeen);
  if (!date) return 'не в сети';

  const now = new Date();
  const isSameDay = (
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
  );
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = (
    date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate()
  );
  const timeText = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (isSameDay) return `был(а) в сети сегодня в ${timeText}`;
  if (isYesterday) return `был(а) в сети вчера в ${timeText}`;

  return `был(а) в сети ${date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })}`;
}

function ChatWindow({
  token,
  chat,
  messages,
  socket,
  currentUserId,
  onStartCall,
  onStartGroupCall,
  typingUsers,
  incomingCall,
  incomingGroupCall,
  onAcceptCall,
  onDeclineCall,
  onAcceptGroupCall,
  onDeclineGroupCall,
  onBack,
  onEditMessage,
  onDeleteMessage,
  onDeleteChat
}) {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showDeleteChatModal, setShowDeleteChatModal] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowChatMenu(false);
    if (showChatMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChatMenu]);

  useEffect(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);
  };

  const handleConfirmDeleteChat = useCallback(() => {
    onDeleteChat?.();
    setShowDeleteChatModal(false);
  }, [onDeleteChat]);
  const timelineItems = useMemo(() => buildChatTimeline(messages), [messages]);

  if (!chat) {
    return (
      <div className="chat-window-empty">
        <div className="empty-surface-glow" />
        <div className="empty-card">
          <div className="empty-badge">
            <DuckIcon size={14} />
            <span>GovChat Messages</span>
          </div>

          <div className="empty-icon-wrap" aria-hidden="true">
            <MessageIcon size={30} />
          </div>

          <h2 className="empty-title">Выберите чат</h2>
          <p className="empty-hint">
            Откройте диалог слева или найдите пользователя по номеру телефона.
          </p>

          <div className="empty-actions">
            <button
              type="button"
              className="empty-btn empty-btn-primary"
              onClick={() => { window.location.hash = '#/search'; }}
            >
              <SearchIcon size={15} />
              <span>Найти пользователя</span>
            </button>
          </div>

          <div className="empty-tips">
            <div className="empty-tip">
              <SearchIcon size={14} />
              <span>Поиск доступен по номеру телефона</span>
            </div>
            <div className="empty-tip">
              <PlusIcon size={14} />
              <span>Кнопка «+» в списке чатов создаёт группу</span>
            </div>
          </div>
        </div>

        <style>{`
          .chat-window-empty {
            position: relative;
            flex: 1;
            display: grid;
            place-items: center;
            padding: 24px;
            background:
              radial-gradient(circle at 14% 12%, rgba(59, 130, 246, 0.16), transparent 36%),
              radial-gradient(circle at 84% 18%, rgba(79, 70, 229, 0.16), transparent 34%),
              var(--bg-primary);
            overflow: hidden;
          }

          .empty-surface-glow {
            position: absolute;
            width: min(760px, 88vw);
            height: 320px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(59, 130, 246, 0.2), transparent 68%);
            filter: blur(28px);
            top: -92px;
            left: 50%;
            transform: translateX(-50%);
            pointer-events: none;
          }

          .empty-card {
            position: relative;
            z-index: 2;
            width: min(560px, 94vw);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-xl);
            padding: 24px;
            background:
              linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.72)),
              var(--bg-card);
            box-shadow: var(--shadow-xl);
            text-align: center;
          }

          .empty-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 999px;
            border: 1px solid rgba(96, 165, 250, 0.35);
            background: rgba(37, 99, 235, 0.2);
            color: #bfdbfe;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
          }

          .empty-icon-wrap {
            margin: 18px auto 14px;
            width: 74px;
            height: 74px;
            border-radius: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #dbeafe;
            background: linear-gradient(145deg, rgba(59, 130, 246, 0.85), rgba(79, 70, 229, 0.9));
            box-shadow: 0 12px 26px rgba(37, 99, 235, 0.34);
          }

          .empty-title {
            margin: 0;
            font-size: 30px;
            line-height: 1.15;
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }

          .empty-hint {
            margin: 10px auto 0;
            max-width: 420px;
            font-size: 15px;
            line-height: 1.55;
            color: var(--text-secondary);
          }

          .empty-actions {
            margin-top: 20px;
            display: flex;
            justify-content: center;
          }

          .empty-btn {
            border-radius: 12px;
            border: 1px solid transparent;
            padding: 11px 16px;
            font-size: 14px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: var(--transition-normal);
          }

          .empty-btn-primary {
            color: #eff6ff;
            background: linear-gradient(145deg, var(--accent), #4f46e5);
            border-color: rgba(96, 165, 250, 0.45);
            box-shadow: 0 12px 24px rgba(37, 99, 235, 0.28);
          }

          .empty-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 16px 30px rgba(37, 99, 235, 0.35);
          }

          .empty-tips {
            margin-top: 18px;
            display: grid;
            gap: 8px;
          }

          .empty-tip {
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.7);
            padding: 10px 12px;
            color: var(--text-secondary);
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }

          @media (max-width: 768px) {
            .chat-window-empty {
              padding: 16px;
            }

            .empty-card {
              padding: 18px;
            }

            .empty-title {
              font-size: 24px;
            }
          }
        `}</style>
      </div>
    );
  }

  const displayName = chat.displayName || chat.name || 'Чат';
  const typingList = typingUsers?.filter(u => u.chatId === chat._id && u.userId !== currentUserId) || [];
  const isGroupChat = chat.type === 'group' || chat.isGroup === true;
  const isAiChat = chat.isAiChat === true;
  const participantCount = chat.participants?.length || 0;
  const hasIncomingCall = incomingCall && incomingCall.chatId === chat._id;
  const hasIncomingGroupCall = incomingGroupCall && incomingGroupCall.chatId === chat._id;
  const isOnline = String(chat.displayStatus || '').trim().toLowerCase() === 'online';
  const presenceText = !isGroupChat && !isAiChat
    ? formatPresenceText(chat.displayStatus, chat.displayLastSeen)
    : '';

  return (
    <div className="chat-window-container">
      {/* Incoming Call Banner */}
      {hasIncomingCall && (
        <div className="incoming-call-banner">
          <div className="call-banner-content">
            <div className="call-banner-icon">
              {incomingCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div className="call-banner-info">
              <div className="call-banner-title">Входящий звонок</div>
              <div className="call-banner-subtitle">
                {incomingCall.initiator?.name || 'Пользователь'} звонит вам
              </div>
            </div>
          </div>
          <div className="call-banner-actions">
            <button
              onClick={() => onDeclineCall?.(incomingCall.callId)}
              className="call-banner-btn decline"
              title="Отклонить"
            >
              ✕
            </button>
            <button
              onClick={() => onAcceptCall?.(incomingCall.callId, incomingCall.type)}
              className="call-banner-btn accept"
              title="Принять"
            >
              {incomingCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Incoming Group Call Banner */}
      {hasIncomingGroupCall && (
        <div className="incoming-group-call-banner">
          <div className="call-banner-content">
            <div className="call-banner-icon">
              {incomingGroupCall.type === 'video' ? '📹' : '📞'}
            </div>
            <div className="call-banner-info">
              <div className="call-banner-title">Групповой звонок</div>
              <div className="call-banner-subtitle">
                {incomingGroupCall.initiator?.name || 'Участник'} начал звонок
                {incomingGroupCall.participants?.length > 1 &&
                  ` • ${incomingGroupCall.participants.length} участников`
                }
              </div>
            </div>
          </div>
          <div className="call-banner-actions">
            <button
              onClick={() => onDeclineGroupCall?.(incomingGroupCall.callId)}
              className="call-banner-btn decline"
              title="Отклонить"
            >
              ✕
            </button>
            <button
              onClick={() => onAcceptGroupCall?.(incomingGroupCall.callId, incomingGroupCall.type)}
              className="call-banner-btn accept"
              title="Присоединиться"
            >
              {incomingGroupCall.type === 'video' ? '🎥' : '📞'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="chat-header">
        <div className="header-info">
          {isMobile && (
            <button onClick={onBack} className="back-btn" title="Назад к чатам">
              ←
            </button>
          )}
          <div className={`chat-avatar ${isGroupChat ? 'group' : ''}`}>
            {isGroupChat ? '👥' : displayName.charAt(0).toUpperCase()}
          </div>
          <div className="header-meta">
            <div className="chat-name-row">
              <h3 className="chat-name">{displayName}</h3>
              {!isGroupChat && !isAiChat && (
                <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} aria-hidden="true" />
              )}
            </div>
            {isGroupChat && (
              <div className="participant-count">
                {participantCount} участников
              </div>
            )}
            {!isGroupChat && !isAiChat && typingList.length === 0 && (
              <div className={`chat-presence ${isOnline ? 'online' : 'offline'}`}>
                {presenceText}
              </div>
            )}
            {typingList.length > 0 && (
              <div className="typing-indicator">
                печатает<span className="typing-dots">...</span>
              </div>
            )}
          </div>
        </div>
        <div
          className="header-actions"
          data-onboarding-id={!isAiChat ? 'chat-call-actions' : undefined}
        >
          {!isGroupChat && !isAiChat && (
            <>
              <button onClick={() => onStartCall?.('audio')} className="header-action-btn" title="Аудиозвонок">
                📞
              </button>
              <button onClick={() => onStartCall?.('video')} className="header-action-btn" title="Видеозвонок">
                🎥
              </button>
            </>
          )}
          {isGroupChat && !isAiChat && (
            <>
              <button onClick={() => onStartGroupCall?.('audio')} className="header-action-btn group" title="Групповой аудиозвонок">
                📞
                <span className="group-call-badge">👥</span>
              </button>
              <button onClick={() => onStartGroupCall?.('video')} className="header-action-btn group" title="Групповой видеозвонок">
                🎥
                <span className="group-call-badge">👥</span>
              </button>
            </>
          )}
          <div className="menu-container">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChatMenu(!showChatMenu);
              }}
              className="header-action-btn"
              title="Меню"
            >
              ⋮
            </button>
            {showChatMenu && (
              <div className="chat-menu">
                <button
                  onClick={() => {
                    setShowChatMenu(false);
                    setShowDeleteChatModal(true);
                  }}
                  className="chat-menu-item"
                >
                  🗑️ Удалить чат
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div
        ref={containerRef}
        className="messages-container"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="no-messages">
            <span className="no-messages-icon">👋</span>
            <span>Начните общение</span>
          </div>
        ) : (
          timelineItems.map((item) => {
            if (item.type === 'day-separator') {
              return <DaySeparator key={item.key} label={item.label} />;
            }

            const msg = item.message;
            const isMine = msg.sender?._id === currentUserId || msg.sender === currentUserId;
            return (
              <MessageBubble
                key={item.key}
                message={msg}
                isMine={isMine}
                token={token}
                chat={chat}
                currentUserId={currentUserId}
                onEdit={isMine ? (nextText) => onEditMessage?.(msg._id, nextText) : null}
                onDelete={isMine ? () => onDeleteMessage?.(msg._id) : null}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        chat={chat}
        chatId={chat._id}
        socket={socket}
        token={token}
      />

      {/* Delete Chat Modal */}
      {showDeleteChatModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">⚠️</div>
            <h3 className="modal-title">Удалить чат?</h3>
            <p className="modal-text">
              Вы уверены, что хотите удалить этот чат?
              <br /><br />
              <strong>Внимание:</strong> Все сообщения, изображения, видео и файлы будут удалены безвозвратно у всех участников.
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteChatModal(false)} className="modal-btn cancel">
                Отмена
              </button>
              <button onClick={handleConfirmDeleteChat} className="modal-btn delete">
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .chat-window-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            background-color: var(--bg-primary);
            height: 100%;
            min-height: 0;
            position: relative;
        }

        /* Banners */
        .incoming-call-banner, .incoming-group-call-banner {
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            animation: slideDown 0.3s ease, pulse-banner 1.5s infinite;
            position: absolute;
            top: 70px;
            left: 20px;
            right: 20px;
            z-index: 50;
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .incoming-call-banner { background: linear-gradient(135deg, #22c55e, #16a34a); }
        .incoming-group-call-banner { background: linear-gradient(135deg, #a855f7, #7e22ce); }

        .call-banner-content { display: flex; align-items: center; gap: 12px; }
        .call-banner-icon { fontSize: 24px; animation: shake 0.5s infinite; }
        .call-banner-info { display: flex; flex-direction: column; }
        .call-banner-title { font-weight: 700; font-size: 14px; }
        .call-banner-subtitle { font-size: 12px; opacity: 0.9; }
        .call-banner-actions { display: flex; gap: 8px; }

        .call-banner-btn {
            width: 40px; height: 40px; border-radius: 50%; border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: transform 0.2s; color: white;
        }
        .call-banner-btn.decline { background: rgba(255,255,255,0.2); font-size: 16px; }
        .call-banner-btn.decline:hover { background: #ef4444; }
        .call-banner-btn.accept { background: rgba(255,255,255,0.2); font-size: 18px; animation: pulse-btn 1s infinite; }
        .call-banner-btn.accept:hover { background: #22c55e; }

        /* Header */
        .chat-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            background-color: var(--bg-surface);
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 64px;
            flex-shrink: 0;
        }

        .header-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .header-meta { min-width: 0; }
        .chat-name-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
        
        .back-btn {
            width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
            background: transparent; border: none; border-radius: 50%;
            font-size: 20px; color: var(--text-primary); cursor: pointer; margin-right: 8px;
        }

        .chat-avatar {
            width: 40px; height: 40px; border-radius: 50%;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            display: flex; align-items: center; justify-content: center;
            color: white; font-weight: 700; font-size: 16px; flex-shrink: 0;
        }
        .chat-avatar.group { background: linear-gradient(135deg, #a855f7, #7e22ce); }

        .chat-name { margin: 0; fontSize: 16px; font-weight: 700; color: var(--text-primary); }
        .presence-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.45); }
        .presence-dot.online { background: #22c55e; }
        .presence-dot.offline { background: rgba(148, 163, 184, 0.75); }
        .participant-count { fontSize: 12px; color: var(--text-secondary); margin-top: 2px; }
        .chat-presence { fontSize: 12px; margin-top: 2px; }
        .chat-presence.online { color: #4ade80; }
        .chat-presence.offline { color: var(--text-secondary); }
        .typing-indicator { fontSize: 12px; color: var(--accent); margin-top: 2px; }
        .typing-dots { animation: blink 1s infinite; }

        .header-actions { display: flex; gap: 8px; align-items: center; }

        .header-action-btn {
            width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
            background: transparent; border: 1px solid var(--border-light); border-radius: 50%;
            font-size: 18px; cursor: pointer; transition: var(--transition-fast); color: var(--text-secondary);
            position: relative;
        }
        .header-action-btn:hover { background-color: var(--bg-hover); color: var(--text-primary); }
        .header-action-btn.group { color: var(--accent); border-color: var(--accent); }
        .header-action-btn.group:hover { background-color: rgba(168, 85, 247, 0.1); }

        .group-call-badge { position: absolute; fontSize: 10px; bottom: -2px; right: -2px; }

        /* Menu */
        .menu-container { position: relative; }
        .chat-menu {
            position: absolute; top: 100%; right: 0; margin-top: 8px;
            background-color: var(--bg-card); border-radius: 12px;
            box-shadow: var(--shadow-lg); overflow: hidden; z-index: 100;
            min-width: 160px; border: 1px solid var(--border-light);
        }
        .chat-menu-item {
            width: 100%; padding: 12px 16px; background: transparent; border: none;
            color: var(--danger); fontSize: 14px; textAlign: left; cursor: pointer;
            display: flex; align-items: center; gap: 8px; transition: var(--transition-fast);
        }
        .chat-menu-item:hover { background-color: var(--bg-surface); }

        /* Messages */
        .messages-container {
            flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px;
            background-color: var(--bg-primary);
        }
        .no-messages {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            color: var(--text-muted); gap: 8px;
        }
        .no-messages-icon { fontSize: 32px; opacity: 0.5; }

        /* Message Bubble */
        .message-row { display: flex; width: 100%; margin-bottom: 2px; }
        .day-separator-row {
          display: flex;
          justify-content: center;
          width: 100%;
          margin: 10px 0 4px;
        }
        .day-separator-label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: #93a9bf;
          background: rgba(30, 44, 59, 0.88);
          border: 1px solid rgba(74, 107, 136, 0.42);
          letter-spacing: 0.01em;
          text-transform: lowercase;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
        }
        .message-bubble {
            max-width: 75%; padding: 10px 14px; border-radius: 18px; word-wrap: break-word;
            position: relative; box-shadow: var(--shadow-sm);
        }
        .message-bubble.mine {
            background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;
            border-bottom-right-radius: 4px;
        }
        .message-bubble.theirs {
            background-color: var(--bg-card); color: var(--text-primary);
            border-bottom-left-radius: 4px; border: 1px solid var(--border-light);
        }

        .sender-name { font-size: 12px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }
        .text-content { font-size: 15px; line-height: 1.5; white-space: pre-wrap; }
        .message-link {
            color: #8fd3ff;
            text-decoration: underline;
            text-underline-offset: 2px;
            word-break: break-word;
        }
        .message-link:hover { color: #d7efff; }
        
        .message-time {
            font-size: 10px; margin-top: 4px; opacity: 0.7;
            display: flex; align-items: center; gap: 8px;
        }
        .message-status {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: -0.04em;
            opacity: 0.9;
        }
        .message-status.delivered {
            color: rgba(255, 255, 255, 0.82);
        }
        .message-status.read {
            color: #60a5fa;
        }
        
        /* Media */
        .media-wrapper { max-width: 280px; border-radius: 12px; overflow: hidden; margin-top: 4px; }
        .image-preview { width: 100%; height: auto; display: block; cursor: pointer; }
        .video-preview { width: 100%; height: auto; display: block; border-radius: 12px; }
        .media-caption { margin-top: 6px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }

        .audio-wrapper { display: flex; align-items: center; gap: 8px; min-width: 200px; padding: 4px 0; }
        .audio-icon { font-size: 20px; }
        .audio-player { height: 36px; flex: 1; outline: none; }
        .audio-duration { font-size: 12px; opacity: 0.75; min-width: 38px; text-align: right; }

        .video-note-wrapper { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .video-note-button {
          border: none; background: transparent; padding: 0; cursor: pointer;
          width: 164px; height: 164px; border-radius: 50%;
          position: relative; overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        }
        .video-note-thumb {
          width: 100%; height: 100%; border-radius: 50%;
          object-fit: cover; display: block; background: rgba(255, 255, 255, 0.08);
        }
        .video-note-play {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-size: 34px; color: #fff; text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
          pointer-events: none;
        }
        .video-note-overlay {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.82);
          display: flex; align-items: center; justify-content: center; z-index: 12000;
          padding: 16px;
        }
        .video-note-modal {
          width: min(92vw, 560px); aspect-ratio: 1 / 1;
          border-radius: 20px; overflow: hidden; position: relative;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
          background: #111827;
        }
        .video-note-modal-video {
          width: 100%; height: 100%; object-fit: contain; background: #000;
        }
        .video-note-close {
          position: absolute; top: 10px; right: 10px; z-index: 2;
          width: 30px; height: 30px; border-radius: 50%;
          border: none; background: rgba(0, 0, 0, 0.55); color: #fff; cursor: pointer;
          font-size: 20px; line-height: 1;
        }

        /* File */
        .file-link {
            display: flex; align-items: center; gap: 10px; padding: 10px;
            background: rgba(0,0,0,0.1); border: none; border-radius: 12px;
            text-decoration: none; color: inherit; cursor: pointer;
            width: 100%; text-align: left;
        }
        .message-bubble.theirs .file-link { background: var(--bg-surface); }
        
        .file-icon { font-size: 24px; }
        .file-info { overflow: hidden; flex: 1; }
        .file-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-size { font-size: 11px; opacity: 0.8; }
        .download-icon { font-size: 16px; opacity: 0.8; }

        /* Controls */
        .delete-msg-btn {
            background: transparent; border: none; fontSize: 12px; cursor: pointer;
            opacity: 0.5; padding: 0; color: inherit;
        }
        .delete-msg-btn:hover { opacity: 1; }
        .message-bubble.deleted { opacity: 0.85; }
        .deleted-message {
            color: var(--text-secondary);
            font-style: italic;
        }
        .message-edit-block { display: grid; gap: 8px; min-width: 220px; }
        .message-edit-input {
            width: 100%;
            resize: vertical;
            min-height: 72px;
            border-radius: 10px;
            border: 1px solid var(--border-light);
            background: rgba(15, 23, 42, 0.45);
            color: var(--text-primary);
            padding: 10px 12px;
            font: inherit;
        }
        .message-edit-actions { display: flex; justify-content: flex-end; gap: 8px; }
        .message-edit-btn {
            border: none;
            border-radius: 8px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
        }
        .message-edit-btn.cancel {
            background: var(--bg-surface);
            color: var(--text-primary);
        }
        .message-edit-btn.save {
            background: var(--accent);
            color: white;
        }
        .message-edit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .message-edited {
            margin-right: 6px;
            font-size: 11px;
            opacity: 0.7;
        }

        /* Modal */
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(2px);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        }
        .modal-card {
            background-color: var(--bg-card); border-radius: var(--radius-card); padding: 24px;
            max-width: 360px; width: 90%; textAlign: center; border: 1px solid var(--border-light);
            box-shadow: var(--shadow-xl);
        }
        .modal-icon { fontSize: 48px; margin-bottom: 16px; }
        .modal-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--text-primary); }
        .modal-text { font-size: 14px; line-height: 1.5; margin-bottom: 24px; color: var(--text-secondary); }
        
        .modal-actions { display: flex; gap: 12px; justify-content: center; }
        .modal-btn { padding: 10px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: var(--transition-fast); }
        .modal-btn.cancel { background-color: var(--bg-surface); color: var(--text-primary); }
        .modal-btn.cancel:hover { background-color: var(--bg-hover); }
        .modal-btn.delete { background-color: var(--danger); color: white; }
        .modal-btn.delete:hover { opacity: 0.9; }

        .message-context-menu {
            position: absolute; top: 100%; right: 0; margin-top: 4px;
            background-color: var(--bg-card); border-radius: 8px;
            box-shadow: var(--shadow-lg); overflow: hidden; z-index: 100;
            border: 1px solid var(--border-light);
        }
        .context-menu-item {
            padding: 10px 16px; background: transparent; border: none;
            color: var(--text-primary); fontSize: 13px; cursor: pointer;
            display: flex; align-items: center; gap: 8px; white-space: nowrap;
        }
        .context-menu-item:hover { background-color: var(--bg-surface); }
        .context-menu-item.danger { color: var(--danger); }

        .delete-confirm-popup {
            position: absolute; bottom: 100%; right: 0; margin-bottom: 8px;
            background-color: var(--bg-card); border-radius: 12px; padding: 12px;
            box-shadow: var(--shadow-lg); z-index: 100; min-width: 180px;
            border: 1px solid var(--border-light);
        }
        .delete-confirm-text { color: var(--text-primary); fontSize: 13px; margin-bottom: 12px; text-align: center; }
        .delete-confirm-actions { display: flex; gap: 8px; justify-content: center; }
        .delete-confirm-cancel { padding: 6px 12px; background: var(--bg-surface); border: none; borderRadius: 6px; color: var(--text-primary); fontSize: 12px; cursor: pointer; }
        .delete-confirm-yes { padding: 6px 12px; background: var(--danger); border: none; borderRadius: 6px; color: white; fontSize: 12px; cursor: pointer; }
        
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse-banner {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        }
        @keyframes pulse-btn { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-15deg); } 75% { transform: rotate(15deg); } }
      `}</style>
    </div>
  );
}

function DaySeparator({ label }) {
  return (
    <div className="day-separator-row">
      <span className="day-separator-label">{label}</span>
    </div>
  );
}

function resolveMessageMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  if (normalizedUrl.startsWith('/uploads/')) return `${API_URL}${normalizedUrl}`;
  if (normalizedUrl.startsWith('/api/uploads/')) return `${API_URL.replace(/\/api\/?$/, '')}${normalizedUrl}`;
  return `${API_URL.replace(/\/api\/?$/, '')}${normalizedUrl}`;
}

function resolveAudioMimeType(attachment, sourceUrl) {
  const attachmentMimeType = String(attachment?.mimeType || '').trim().toLowerCase();
  if (attachmentMimeType.startsWith('audio/')) return attachmentMimeType;

  const normalizedUrl = String(sourceUrl || attachment?.url || '').trim().toLowerCase();
  if (normalizedUrl.endsWith('.m4a') || normalizedUrl.endsWith('.mp4')) return 'audio/mp4';
  if (normalizedUrl.endsWith('.mp3')) return 'audio/mpeg';
  if (normalizedUrl.endsWith('.ogg') || normalizedUrl.endsWith('.oga')) return 'audio/ogg';
  if (normalizedUrl.endsWith('.wav')) return 'audio/wav';
  if (normalizedUrl.endsWith('.webm')) return 'audio/webm';
  return '';
}

function extractReceiptUserIds(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => String(entry?.user?._id || entry?.user || '').trim())
    .filter(Boolean);
}

function resolveOutgoingMessageStatus(message, recipientUserId) {
  const normalizedRecipientUserId = String(recipientUserId || '').trim();
  if (!normalizedRecipientUserId) return 'sent';

  const readByUserIds = extractReceiptUserIds(message?.readBy);
  if (readByUserIds.includes(normalizedRecipientUserId)) {
    return 'read';
  }

  const deliveredToUserIds = extractReceiptUserIds(message?.deliveredTo);
  if (deliveredToUserIds.includes(normalizedRecipientUserId)) {
    return 'delivered';
  }

  return 'sent';
}

function getMessageStatusMeta(status) {
  if (status === 'read') {
    return { icon: '✓✓', label: 'Прочитано' };
  }
  if (status === 'delivered') {
    return { icon: '✓✓', label: 'Доставлено' };
  }
  return { icon: '✓', label: 'Отправлено' };
}

function MessageText({ text, className = 'text-content' }) {
  const parts = useMemo(() => parseMessageTextParts(text), [text]);

  return (
    <div className={className}>
      {parts.map((part, index) => (
        part.type === 'link' && part.href
          ? (
            <a
              key={`${part.href}-${index}`}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="message-link"
            >
              {part.text}
            </a>
          )
          : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>
      ))}
    </div>
  );
}

function MessageBubble({ message, isMine, onEdit, onDelete, token, chat, currentUserId }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(message?.text || '');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [audioDurationSec, setAudioDurationSec] = useState(() => {
    const durationMs = Number(message?.attachment?.durationMs || 0);
    return durationMs > 0 ? Math.round(durationMs / 1000) : null;
  });
  const { type: rawType = 'text', text, attachment, createdAt, sender, deleted, edited } = message;
  const audioSourceUrl = resolveMessageMediaUrl(attachment?.url);
  const audioMimeType = resolveAudioMimeType(attachment, audioSourceUrl);
  const preferredPlayableAudioMimeType = getPreferredPlayableAudioMimeType(audioMimeType, audioSourceUrl);
  const audioPreload = audioMimeType.startsWith('audio/webm') ? 'auto' : 'metadata';
  const audioElementKey = `${rawType}:${audioSourceUrl || attachment?.originalName || message?._id || 'empty'}`;

  useEffect(() => {
    setDraftText(message?.text || '');
    const durationMs = Number(message?.attachment?.durationMs || 0);
    setAudioDurationSec(durationMs > 0 ? Math.round(durationMs / 1000) : null);
    if (message?.deleted) {
      setIsEditing(false);
      setShowMenu(false);
      setShowDeleteConfirm(false);
    }
  }, [message]);

  const type = (() => {
    if (deleted) return 'deleted';
    if (rawType !== 'file' && rawType !== 'text') return rawType;
    if (!attachment?.mimeType) return rawType;
    const mime = attachment.mimeType.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return rawType;
  })();

  const time = formatMessageTime(createdAt);
  const timeTitle = formatMessageDateTime(createdAt);
  const editedTime = formatMessageTime(message?.editedAt || message?.updatedAt);
  const editedLabel = editedTime ? `изменено ${editedTime}` : 'изменено';
  const senderName = sender?.name || '';
  const canEdit = Boolean(onEdit) && !deleted && type === 'text';
  const canDelete = Boolean(onDelete) && !deleted;
  const canManage = canEdit || canDelete;
  const recipientUserId = String(
    chat?.peerUserId
      || chat?.participants?.find((participant) => {
        const participantUserId = String(participant?.user?._id || participant?.user || '').trim();
        return participantUserId && participantUserId !== String(currentUserId || '').trim();
      })?.user?._id
      || chat?.participants?.find((participant) => {
        const participantUserId = String(participant?.user?._id || participant?.user || '').trim();
        return participantUserId && participantUserId !== String(currentUserId || '').trim();
      })?.user
      || ''
  ).trim();
  const shouldShowStatus = Boolean(
    isMine
    && !deleted
    && chat?.type === 'private'
    && chat?.isAiChat !== true
    && recipientUserId
  );
  const messageStatus = shouldShowStatus ? resolveOutgoingMessageStatus(message, recipientUserId) : '';
  const messageStatusMeta = shouldShowStatus ? getMessageStatusMeta(messageStatus) : null;

  const normalizeFilename = (name) => {
    if (!name) return '';
    const hasCyrillic = /[\u0400-\u04FF]/.test(name);
    const looksLikeMojibake = /[ÐÑÃ]/.test(name) && !hasCyrillic;
    if (!looksLikeMojibake) return name;
    try {
      const bytes = Uint8Array.from(name, (ch) => ch.charCodeAt(0) & 0xff);
      const decoded = new TextDecoder('utf-8').decode(bytes);
      if (/[\u0400-\u04FF]/.test(decoded)) return decoded;
      return name;
    } catch (_) { return name; }
  };

  const displayOriginalName = normalizeFilename(attachment?.originalName) || 'Файл';

  const handleAudioMetadata = useCallback((event) => {
    const duration = Number(event.currentTarget?.duration);
    if (Number.isFinite(duration) && duration > 0) {
      setAudioDurationSec(Math.round(duration));
    }
  }, []);

  const logAudioDebug = useCallback((label, element) => {
    if (!element) return;

    const mediaError = element.error
      ? {
          code: element.error.code,
          message: element.error.message || ''
        }
      : null;

    console.debug('[GovChat audio]', {
      label,
      browser: navigator.userAgent,
      messageId: message?._id || null,
      type,
      declaredType: audioMimeType,
      preferredPlayableType: preferredPlayableAudioMimeType,
      src: audioSourceUrl,
      currentSrc: element.currentSrc || '',
      readyState: element.readyState,
      networkState: element.networkState,
      paused: element.paused,
      ended: element.ended,
      currentTime: element.currentTime,
      duration: element.duration,
      error: mediaError
    });
  }, [audioMimeType, audioSourceUrl, message?._id, preferredPlayableAudioMimeType, type]);

  const handleAudioDebugEvent = useCallback((event) => {
    logAudioDebug(event.type, event.currentTarget);
  }, [logAudioDebug]);

  const stopAudioEventPropagation = useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleBubbleClick = useCallback((event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.audio-wrapper')) {
      return;
    }
    setShowMenu(false);
  }, []);

  const openMedia = useCallback((media) => {
    if (!media?.url) return;
    setSelectedMedia(media);
  }, []);
  const closeMedia = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  useEffect(() => {
    if (type !== 'audio' && type !== 'voice') return undefined;

    console.debug('[GovChat audio]', {
      label: 'mount',
      browser: navigator.userAgent,
      messageId: message?._id || null,
      type,
      declaredType: audioMimeType,
      preferredPlayableType: preferredPlayableAudioMimeType,
      src: audioSourceUrl,
      key: audioElementKey
    });

    return () => {
      console.debug('[GovChat audio]', {
        label: 'unmount',
        browser: navigator.userAgent,
        messageId: message?._id || null,
        type,
        declaredType: audioMimeType,
        preferredPlayableType: preferredPlayableAudioMimeType,
        src: audioSourceUrl,
        key: audioElementKey
      });
    };
  }, [audioElementKey, audioMimeType, audioSourceUrl, message?._id, preferredPlayableAudioMimeType, type]);

  const handleSaveEdit = async () => {
    const nextText = draftText.trim();
    if (!nextText) return;
    if (nextText === String(text || '').trim()) {
      setIsEditing(false);
      return;
    }

    await onEdit?.(nextText);
    setIsEditing(false);
  };

  const downloadAttachment = async () => {
    try {
      const url = attachment?.url;
      if (!url) return;
      const filename = url.split('/').pop();
      if (!filename) return;
      const downloadUrl = `${API_URL}/download/${filename}?name=${encodeURIComponent(attachment?.originalName || 'file')}`;
      const res = await axios.get(downloadUrl, { responseType: 'blob', headers: { Authorization: `Bearer ${token || ''}` } });

      const contentType = String(res.headers?.['content-type'] || '');
      if (contentType.includes('application/json')) {
        const text = await res.data.text();
        alert('Не удалось скачать файл');
        return;
      }

      const blob = res.data;
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = displayOriginalName || 'file';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Download error:', e);
      alert('Не удалось скачать файл');
    }
  };

  const renderContent = () => {
    if (type === 'deleted') {
      return <div className="deleted-message">Сообщение удалено</div>;
    }

    if (isEditing) {
      return (
        <div className="message-edit-block">
          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            className="message-edit-input"
            rows={3}
            maxLength={10000}
          />
          <div className="message-edit-actions">
            <button
              type="button"
              className="message-edit-btn cancel"
              onClick={() => {
                setDraftText(message?.text || '');
                setIsEditing(false);
              }}
            >
              Отмена
            </button>
            <button
              type="button"
              className="message-edit-btn save"
              onClick={handleSaveEdit}
              disabled={!draftText.trim()}
            >
              Сохранить
            </button>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'image':
        return (
          <div className="media-wrapper">
            <img
              src={resolveMessageMediaUrl(attachment?.url)}
              alt={attachment?.originalName || 'Изображение'}
              className="image-preview"
              onClick={() => window.open(resolveMessageMediaUrl(attachment?.url), '_blank')}
            />
            {text && <MessageText text={text} className="media-caption" />}
          </div>
        );
      case 'video':
        return (
          <div className="media-wrapper">
            <video
              src={resolveMessageMediaUrl(attachment?.url)}
              controls
              preload="metadata"
              className="videoPreview" // Keeping inline style for now or add class
              style={{ width: '100%', height: 'auto', borderRadius: '12px' }}
            />
            {text && <MessageText text={text} className="media-caption" />}
          </div>
        );
      case 'audio':
        
        return (
          <div
            className="audio-wrapper"
            onClick={stopAudioEventPropagation}
            onMouseDownCapture={stopAudioEventPropagation}
            onPointerDownCapture={stopAudioEventPropagation}
          >
            <span className="audio-icon">🎤</span>
            <audio
              key={audioElementKey}
              src={audioSourceUrl}
              controls
              preload={audioPreload}
              playsInline
              className="audio-player"
              onLoadedMetadata={handleAudioMetadata}
              onLoadStart={handleAudioDebugEvent}
              onLoadedData={handleAudioDebugEvent}
              onCanPlay={handleAudioDebugEvent}
              onPlay={handleAudioDebugEvent}
              onPlaying={handleAudioDebugEvent}
              onPause={handleAudioDebugEvent}
              onWaiting={handleAudioDebugEvent}
              onSuspend={handleAudioDebugEvent}
              onStalled={handleAudioDebugEvent}
              onAbort={handleAudioDebugEvent}
              onEmptied={handleAudioDebugEvent}
              onEnded={handleAudioDebugEvent}
              onError={handleAudioDebugEvent}
              onClick={stopAudioEventPropagation}
              onMouseDownCapture={stopAudioEventPropagation}
              onPointerDownCapture={stopAudioEventPropagation}
            >
              Ваш браузер не поддерживает аудио
            </audio>
            <span className="audio-duration">{formatMediaDuration(audioDurationSec)}</span>
          </div>
        );
      case 'voice':
        return (
          <div
            className="audio-wrapper"
            onClick={stopAudioEventPropagation}
            onMouseDownCapture={stopAudioEventPropagation}
            onPointerDownCapture={stopAudioEventPropagation}
          >
            <span className="audio-icon">🎙️</span>
            <audio
              key={audioElementKey}
              src={audioSourceUrl}
              controls
              preload={audioPreload}
              playsInline
              className="audio-player"
              onLoadedMetadata={handleAudioMetadata}
              onLoadStart={handleAudioDebugEvent}
              onLoadedData={handleAudioDebugEvent}
              onCanPlay={handleAudioDebugEvent}
              onPlay={handleAudioDebugEvent}
              onPlaying={handleAudioDebugEvent}
              onPause={handleAudioDebugEvent}
              onWaiting={handleAudioDebugEvent}
              onSuspend={handleAudioDebugEvent}
              onStalled={handleAudioDebugEvent}
              onAbort={handleAudioDebugEvent}
              onEmptied={handleAudioDebugEvent}
              onEnded={handleAudioDebugEvent}
              onError={handleAudioDebugEvent}
              onClick={stopAudioEventPropagation}
              onMouseDownCapture={stopAudioEventPropagation}
              onPointerDownCapture={stopAudioEventPropagation}
            />
            <span className="audio-duration">{formatMediaDuration(audioDurationSec)}</span>
          </div>
        );
      case 'video_note':
        return (
          <div className="video-note-wrapper">
            <video
              src={resolveMessageMediaUrl(attachment?.url)}
              muted
              playsInline
              preload="metadata"
              onClick={() => openMedia({ type: 'video', url: resolveMessageMediaUrl(attachment?.url) })}
              title="Открыть видеокружок"
              className="video-note-thumb"
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
            />
            {text && <MessageText text={text} className="media-caption" />}
          </div>
        );
      case 'file':
        return (
          <button type="button" onClick={downloadAttachment} className="file-link">
            <span className="file-icon">📄</span>
            <div className="file-info">
              <div className="file-name">{displayOriginalName}</div>
              <div className="file-size">{attachment?.size ? formatFileSize(attachment.size) : ''}</div>
            </div>
            <span className="download-icon">⬇️</span>
          </button>
        );
      default:
        return <MessageText text={text} className="text-content" />;
    }
  };

  return (
    <div className={`message-row ${isMine ? 'mine' : 'theirs'}`} style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
      <div
        className={`message-bubble ${isMine ? 'mine' : 'theirs'} ${deleted ? 'deleted' : ''}`}
        onContextMenu={(event) => {
          if (!canManage) return;
          event.preventDefault();
          setShowMenu(true);
        }}
        onClick={handleBubbleClick}
      >
        {!isMine && senderName && <div className="sender-name">{senderName}</div>}
        {renderContent()}
        <MediaViewerModal media={selectedMedia} onClose={closeMedia} />
        <div className="message-time" title={timeTitle || undefined}>
          {!deleted && edited && !isEditing && <span className="message-edited">{editedLabel}</span>}
          {time}
          {messageStatusMeta && (
            <span
              className={`message-status ${messageStatus}`}
              title={messageStatusMeta.label}
              aria-label={messageStatusMeta.label}
            >
              {messageStatusMeta.icon}
            </span>
          )}
          {isMine && canManage && !isEditing && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu((current) => !current);
              }}
              className="delete-msg-btn"
              title="Действия с сообщением"
            >
              ⋮
            </button>
          )}
        </div>

        {showMenu && canManage && !isEditing && (
          <div className="message-context-menu">
            {canEdit && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowMenu(false);
                  setShowDeleteConfirm(false);
                  setIsEditing(true);
                }}
                className="context-menu-item"
              >
                ✏️ Редактировать
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowMenu(false);
                  setShowDeleteConfirm(true);
                }}
                className="context-menu-item danger"
              >
                🗑️ Удалить
              </button>
            )}
          </div>
        )}

        {showDeleteConfirm && canDelete && (
          <div className="delete-confirm-popup">
            <div className="delete-confirm-text">Удалить сообщение?</div>
            <div className="delete-confirm-actions">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="delete-confirm-cancel"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.();
                  setShowDeleteConfirm(false);
                }}
                className="delete-confirm-yes"
              >
                Удалить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMediaDuration(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function buildChatTimeline(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const timeline = [];
  let previousDayKey = null;

  messages.forEach((message, index) => {
    const createdAtDate = parseMessageDate(message?.createdAt);
    const dayKey = createdAtDate ? toDayKey(createdAtDate) : null;

    if (dayKey && dayKey !== previousDayKey) {
      timeline.push({
        type: 'day-separator',
        key: `day-${dayKey}-${index}`,
        label: formatDayLabel(createdAtDate)
      });
      previousDayKey = dayKey;
    }

    timeline.push({
      type: 'message',
      key: message?._id ? `msg-${message._id}` : `msg-index-${index}`,
      message
    });
  });

  return timeline;
}

function parseMessageDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  );
}

function formatDayLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return '\u0441\u0435\u0433\u043e\u0434\u043d\u044f';
  if (isSameDay(date, yesterday)) return '\u0432\u0447\u0435\u0440\u0430';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatMessageTime(createdAt) {
  const date = parseMessageDate(createdAt);
  if (!date) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDateTime(createdAt) {
  const date = parseMessageDate(createdAt);
  if (!date) return '';
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default ChatWindow;
