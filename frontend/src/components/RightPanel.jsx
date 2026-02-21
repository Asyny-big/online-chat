import React from 'react';

const RightPanel = () => {
  const activeFriends = [
    { id: 1, name: 'Alex Johnson', avatar: 'https://i.pravatar.cc/150?u=1' },
    { id: 2, name: 'Maria Garcia', avatar: 'https://i.pravatar.cc/150?u=2' },
    { id: 3, name: 'David Kim', avatar: 'https://i.pravatar.cc/150?u=3' }
  ];

  const recommendations = [
    { id: 101, name: 'Art Community', type: 'Группа' },
    { id: 102, name: 'Tech News', type: 'Канал' }
  ];

  return (
    <aside className="right-panel">
      <div className="panel-section">
        <h3>Активные друзья</h3>
        <div className="active-friends-grid">
          {activeFriends.map((friend) => (
            <div key={friend.id} className="friend-item">
              <div className="avatar-wrapper">
                <img src={friend.avatar} alt={friend.name} className="avatar" />
                <div className="status-indicator online" />
              </div>
              <span className="friend-name">{friend.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h3>Рекомендации</h3>
        <div className="recommendations-list">
          {recommendations.map((item) => (
            <div key={item.id} className="rec-item">
              <div className="rec-icon">#</div>
              <div className="rec-info">
                <div className="rec-name">{item.name}</div>
                <div className="rec-type">{item.type}</div>
              </div>
              <button type="button" className="btn btn-primary btn-sm">+</button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .right-panel {
          width: var(--right-panel-width);
          height: 100vh;
          position: sticky;
          top: 0;
          padding: var(--space-16);
          border-left: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          gap: var(--space-20);
          overflow-y: auto;
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.8), rgba(7, 11, 20, 0.9)),
            var(--bg-primary);
        }

        .panel-section {
          padding: var(--space-12);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          background: rgba(15, 23, 42, 0.7);
        }

        .panel-section h3 {
          font-size: 13px;
          font-weight: 800;
          color: var(--text-secondary);
          margin-bottom: var(--space-12);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .active-friends-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
          gap: var(--space-10);
        }

        .friend-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          cursor: pointer;
          padding: var(--space-6);
          border-radius: var(--radius-md);
          transition: var(--transition-normal);
        }

        .friend-item:hover {
          background: var(--bg-hover);
        }

        .avatar-wrapper {
          position: relative;
          width: 48px;
          height: 48px;
        }

        .avatar-wrapper .avatar {
          width: 100%;
          height: 100%;
        }

        .status-indicator {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid var(--bg-surface);
        }

        .status-indicator.online {
          background-color: var(--success);
        }

        .friend-name {
          font-size: 11px;
          color: var(--text-secondary);
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 100%;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }

        .rec-item {
          display: flex;
          align-items: center;
          gap: var(--space-10);
          padding: var(--space-8);
          border-radius: var(--radius-md);
          transition: var(--transition-normal);
          border: 1px solid transparent;
        }

        .rec-item:hover {
          background-color: var(--bg-hover);
          border-color: var(--border-color);
        }

        .rec-icon {
          width: 30px;
          height: 30px;
          background-color: var(--bg-surface);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          border: 1px solid var(--border-color);
        }

        .rec-info {
          flex: 1;
          min-width: 0;
        }

        .rec-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .rec-type {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .btn-sm {
          width: 28px;
          height: 28px;
          padding: 0;
          border-radius: 10px;
        }

        @media (max-width: 1024px) {
          .right-panel {
            display: none;
          }
        }
      `}</style>
    </aside>
  );
};

export default RightPanel;

