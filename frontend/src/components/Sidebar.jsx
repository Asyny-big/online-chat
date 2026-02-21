import React, { useState } from 'react';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';

function Sidebar({ token, chats, selectedChat, onSelectChat, onAddChat, incomingCallChatId, onNavigateToProfile }) {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          <span className="logo-mark">GC</span>
          GovChat
        </h2>
        <div className="header-actions">
          <button
            type="button"
            onClick={() => setShowCreateGroupModal(true)}
            className="icon-btn-outline group-btn"
            title="Создать групповой чат"
            aria-label="Создать групповой чат"
          >
            +
          </button>
        </div>
      </div>

      <ChatList
        chats={chats}
        selectedChat={selectedChat}
        onSelectChat={onSelectChat}
        incomingCallChatId={incomingCallChatId}
      />

      <div className="sidebar-footer">
        <button type="button" className="profile-btn-full" onClick={() => onNavigateToProfile?.()}>
          <span className="profile-icon">P</span>
          <span className="profile-text">Профиль</span>
        </button>
      </div>

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
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .header-actions {
          display: flex;
          gap: var(--space-8);
        }

        .icon-btn-outline {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          cursor: pointer;
          font-size: 18px;
          transition: var(--transition-normal);
          color: var(--text-secondary);
          background: var(--bg-surface);
        }

        .group-btn {
          color: #bfdbfe;
          border-color: rgba(96, 165, 250, 0.4);
        }

        .group-btn:hover {
          background-color: rgba(59, 130, 246, 0.16);
          color: #dbeafe;
          transform: translateY(-1px);
        }

        .sidebar-footer {
          margin-top: auto;
          padding: var(--space-12);
          border-top: 1px solid var(--border-color);
          background-color: rgba(15, 23, 42, 0.74);
        }

        .profile-btn-full {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--space-10);
          padding: var(--space-10) var(--space-12);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background-color: var(--bg-surface);
          color: var(--text-primary);
          cursor: pointer;
          transition: var(--transition-normal);
        }

        .profile-btn-full:hover {
          background-color: var(--bg-hover);
          transform: translateY(-1px);
        }

        .profile-icon {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(59, 130, 246, 0.2);
          flex-shrink: 0;
          font-size: 14px;
        }

        .profile-text {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.1px;
        }
      `}</style>
    </div>
  );
}

export default Sidebar;

