import React, { useState } from 'react';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';
import { DuckIcon, PlusIcon } from '@/shared/ui/Icons';

function Sidebar({ token, chats, selectedChat, onSelectChat, onAddChat, incomingCallChatId }) {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          <span className="logo-mark" aria-hidden="true">
            <DuckIcon size={16} />
          </span>
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
            <PlusIcon size={16} />
          </button>
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
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          display: inline-flex;
          align-items: center;
          justify-content: center;
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

      `}</style>
    </div>
  );
}

export default Sidebar;

