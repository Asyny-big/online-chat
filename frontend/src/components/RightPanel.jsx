import React from 'react';

const RightPanel = () => {
    // Mock data for UI demonstration
    const activeFriends = [
        { id: 1, name: 'Alex Johnson', avatar: 'https://i.pravatar.cc/150?u=1' },
        { id: 2, name: 'Maria Garcia', avatar: 'https://i.pravatar.cc/150?u=2' },
        { id: 3, name: 'David Kim', avatar: 'https://i.pravatar.cc/150?u=3' },
    ];

    const recommendations = [
        { id: 101, name: 'Art Community', type: 'Группа' },
        { id: 102, name: 'Tech News', type: 'Канал' },
    ];

    return (
        <aside className="right-panel">
            <div className="panel-section">
                <h3>Активные друзья</h3>
                <div className="active-friends-grid">
                    {activeFriends.map(friend => (
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
                    {recommendations.map(item => (
                        <div key={item.id} className="rec-item">
                            <div className="rec-icon">#</div>
                            <div className="rec-info">
                                <div className="rec-name">{item.name}</div>
                                <div className="rec-type">{item.type}</div>
                            </div>
                            <button className="btn btn-primary btn-sm">+</button>
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
                    padding: 20px;
                    border-left: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    overflow-y: auto;
                }

                .panel-section h3 {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--text-secondary);
                    margin-bottom: 16px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .active-friends-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
                    gap: 12px;
                }

                .friend-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
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
                    bottom: 2px;
                    right: 2px;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    border: 2px solid var(--bg-primary);
                }

                .status-indicator.online {
                    background-color: var(--success);
                }

                .friend-name {
                    font-size: 12px;
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
                    gap: 12px;
                }

                .rec-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px;
                    border-radius: var(--radius-xs);
                    transition: var(--transition-fast);
                }

                .rec-item:hover {
                    background-color: var(--bg-surface);
                }

                .rec-icon {
                    width: 32px;
                    height: 32px;
                    background-color: var(--bg-card);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                }

                .rec-info {
                    flex: 1;
                }

                .rec-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .rec-type {
                    font-size: 12px;
                    color: var(--text-muted);
                }

                .btn-sm {
                    padding: 4px 10px;
                    font-size: 12px;
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
