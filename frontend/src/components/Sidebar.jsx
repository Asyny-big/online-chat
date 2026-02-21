import React, { useEffect, useRef, useState } from 'react';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';
import { ChevronDownIcon, DuckIcon, MessageIcon, PlusIcon, UsersIcon } from '@/shared/ui/Icons';

function Sidebar({
  token,
  chats,
  selectedChat,
  onSelectChat,
  onAddChat,
  onOpenNewDialog,
  incomingCallChatId
}) {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setShowCreateMenu(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCreateMenu(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNewDialogClick = () => {
    setShowCreateMenu(false);
    if (typeof onOpenNewDialog === 'function') {
      onOpenNewDialog();
      return;
    }
    window.location.hash = '#/search';
  };

  const handleNewGroupClick = () => {
    setShowCreateMenu(false);
    setShowCreateGroupModal(true);
  };

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          <span className="logo-mark" aria-hidden="true">
            <DuckIcon size={16} />
          </span>
          GovChat
        </h2>

        <div className="header-actions" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => setShowCreateMenu((prev) => !prev)}
            className={`new-chat-trigger ${showCreateMenu ? 'active' : ''}`}
            title="Создать чат"
            aria-label="Создать чат"
            aria-expanded={showCreateMenu}
            aria-haspopup="menu"
          >
            <span className="new-chat-icon-wrap">
              <PlusIcon size={14} />
            </span>
            <span className="new-chat-label">Новый чат</span>
            <ChevronDownIcon size={14} className={`new-chat-chevron ${showCreateMenu ? 'rotated' : ''}`} />
          </button>

          {showCreateMenu ? (
            <div className="create-menu" role="menu" aria-label="Создать новый чат">
              <button type="button" className="create-menu-item" role="menuitem" onClick={handleNewDialogClick}>
                <span className="create-menu-item-icon">
                  <MessageIcon size={16} />
                </span>
                <span className="create-menu-item-content">
                  <span className="create-menu-item-title">Новый диалог</span>
                  <span className="create-menu-item-subtitle">Найти пользователя и начать личный чат</span>
                </span>
              </button>

              <button type="button" className="create-menu-item" role="menuitem" onClick={handleNewGroupClick}>
                <span className="create-menu-item-icon">
                  <UsersIcon size={16} />
                </span>
                <span className="create-menu-item-content">
                  <span className="create-menu-item-title">Новая группа</span>
                  <span className="create-menu-item-subtitle">Создать чат для команды или друзей</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ChatList
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={onSelectChat}
        incomingCallChatId={incomingCallChatId}
      />

      {showCreateGroupModal && (
        <CreateGroupModal
          token={token}
          onClose={() => setShowCreateGroupModal(false)}
          onGroupCreated={(groupChat) => {
            onAddChat?.(groupChat);
            onSelectChat?.(groupChat);
            setShowCreateGroupModal(false);
          }}
        />
      )}

      <style>{`
        .chat-sidebar {
          width: 100%;
          height: 100%;
          background: linear-gradient(180deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.94));
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .sidebar-header {
          padding: var(--space-14) var(--space-12);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
          background-color: rgba(15, 23, 42, 0.65);
        }

        .sidebar-title {
          margin: 0;
          font-size: 18px;
          font-weight: 750;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: var(--space-8);
          letter-spacing: 0.01em;
        }

        .logo-mark {
          width: 28px;
          height: 28px;
          border-radius: 9px;
          background: linear-gradient(145deg, rgba(59, 130, 246, 0.95), rgba(79, 70, 229, 0.92));
          color: #dbeafe;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .header-actions {
          position: relative;
          display: flex;
          gap: var(--space-8);
        }

        .new-chat-trigger {
          height: 38px;
          padding: 0 10px 0 8px;
          display: flex;
          align-items: center;
          gap: var(--space-8);
          justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          cursor: pointer;
          transition: var(--transition-fast);
          color: #dbeafe;
          background: rgba(15, 23, 42, 0.88);
        }

        .new-chat-trigger:hover,
        .new-chat-trigger.active {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(96, 165, 250, 0.45);
        }

        .new-chat-icon-wrap {
          width: 20px;
          height: 20px;
          border-radius: 8px;
          background: rgba(59, 130, 246, 0.22);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .new-chat-label {
          font-size: 13px;
          font-weight: 700;
          color: #dbeafe;
          letter-spacing: 0.01em;
        }

        .new-chat-chevron {
          color: #93c5fd;
          transition: transform 180ms ease;
        }

        .new-chat-chevron.rotated {
          transform: rotate(180deg);
        }

        .create-menu {
          position: absolute;
          top: calc(100% + var(--space-8));
          right: 0;
          width: min(320px, calc(100vw - 32px));
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background:
            radial-gradient(circle at 100% 0%, rgba(79, 124, 255, 0.2), transparent 42%),
            rgba(15, 23, 42, 0.98);
          box-shadow: var(--shadow-lg);
          padding: var(--space-8);
          z-index: 10;
          animation: fadeInMenu 200ms ease;
        }

        .create-menu-item {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 10px;
          background: transparent;
          display: flex;
          align-items: center;
          gap: var(--space-10);
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          transition: var(--transition-fast);
        }

        .create-menu-item:hover {
          background: rgba(59, 130, 246, 0.14);
        }

        .create-menu-item-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid rgba(96, 165, 250, 0.36);
          background: rgba(59, 130, 246, 0.18);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #bfdbfe;
        }

        .create-menu-item-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .create-menu-item-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .create-menu-item-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.35;
        }

        @keyframes fadeInMenu {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .new-chat-label {
            display: none;
          }

          .new-chat-trigger {
            width: 38px;
            padding: 0;
          }

          .new-chat-chevron {
            display: none;
          }

          .create-menu {
            width: min(290px, calc(100vw - 20px));
          }
        }
      `}</style>
    </div>
  );
}

export default Sidebar;
