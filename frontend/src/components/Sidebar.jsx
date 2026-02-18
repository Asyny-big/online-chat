import React, { useState } from 'react';
import ChatList from './ChatList';
import CreateGroupModal from './CreateGroupModal';
import ProfileDrawer from './ProfileDrawer';
import ProfilePage from '../pages/ProfilePage';
import { useMediaQuery } from '../hooks/useMediaQuery';

function Sidebar({ token, chats, selectedChat, onSelectChat, onAddChat, onLogout, incomingCallChatId }) {
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 769px)', { defaultValue: true });

  return (
    <div className="chat-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">
          <span className="logo-emoji">??</span>
          GovChat
        </h2>
        <div className="header-actions">
          <button
            onClick={() => setShowCreateGroupModal(true)}
            className="icon-btn-outline group-btn"
            title="Create group chat"
          >
            ??
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
        <button className="profile-btn-full" onClick={() => setShowProfile(true)}>
          <span className="profile-icon">??</span>
          <span className="profile-text">Profile</span>
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

      {showProfile && (
        isDesktop ? (
          <ProfilePage token={token} onClose={() => setShowProfile(false)} onLogout={onLogout} />
        ) : (
          <ProfileDrawer token={token} onClose={() => setShowProfile(false)} onLogout={onLogout} />
        )
      )}

      <style>{`
        .chat-sidebar {
            width: 100%;
            height: 100%;
            background-color: var(--bg-surface);
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--border-color);
            overflow: hidden;
        }

        .sidebar-header {
            padding: 16px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            background-color: var(--bg-card);
        }

        .sidebar-title {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .logo-emoji {
            font-size: 24px;
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .icon-btn-outline {
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            transition: var(--transition-fast);
            color: var(--text-secondary);
        }

        .group-btn {
            color: var(--accent);
            border-color: var(--accent-soft);
        }

        .group-btn:hover {
            background-color: var(--accent-soft);
        }

        .sidebar-footer {
            margin-top: auto;
            padding: 12px;
            border-top: 1px solid var(--border-color);
            background-color: var(--bg-card);
        }

        .profile-btn-full {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 14px;
            border-radius: 14px;
            border: 1px solid var(--border-light);
            background-color: var(--bg-surface);
            color: var(--text-primary);
            cursor: pointer;
            transition: var(--transition-fast);
        }

        .profile-btn-full:hover {
            background-color: var(--bg-hover);
        }

        .profile-icon {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            flex-shrink: 0;
            font-size: 18px;
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
