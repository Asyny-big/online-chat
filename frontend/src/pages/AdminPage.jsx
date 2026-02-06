import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
        color: '#e0e0e0',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: '24px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    title: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#fff',
        margin: 0,
    },
    backBtn: {
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
    },
    card: {
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '24px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)',
    },
    cardTitle: {
        fontSize: '14px',
        color: '#888',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
    },
    bigNumber: {
        fontSize: '48px',
        fontWeight: '700',
        color: '#fff',
        lineHeight: 1,
    },
    list: {
        listStyle: 'none',
        padding: 0,
        margin: '12px 0 0 0',
        maxHeight: '200px',
        overflowY: 'auto',
    },
    listItem: {
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '8px',
        marginBottom: '6px',
        fontSize: '13px',
        fontFamily: 'monospace',
    },
    callCard: {
        padding: '12px',
        background: 'rgba(76, 175, 80, 0.15)',
        borderRadius: '10px',
        marginBottom: '8px',
        border: '1px solid rgba(76, 175, 80, 0.3)',
    },
    callType: {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginRight: '8px',
    },
    audio: { background: '#7c4dff', color: '#fff' },
    video: { background: '#00bcd4', color: '#fff' },
    stat: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    statLabel: { color: '#888', fontSize: '14px' },
    statValue: { color: '#fff', fontWeight: '500', fontSize: '14px' },
    error: {
        background: 'rgba(244, 67, 54, 0.15)',
        border: '1px solid rgba(244, 67, 54, 0.3)',
        color: '#ff6b6b',
        padding: '16px',
        borderRadius: '12px',
        textAlign: 'center',
    },
    refreshInfo: {
        fontSize: '12px',
        color: '#666',
        marginTop: '24px',
        textAlign: 'center',
    },
};

function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatUptime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}ч ${m}м`;
}

export default function AdminPage({ token, onBack }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/admin/overview`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                throw new Error(res.status === 403 ? 'Нет доступа' : 'Ошибка загрузки');
            }
            const json = await res.json();
            setData(json);
            setError('');
            setLastUpdate(new Date());
        } catch (e) {
            setError(e.message);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
        const id = setInterval(fetchData, 4000);
        return () => clearInterval(id);
    }, [fetchData]);

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>🔒 Админ-панель</h1>
                    <button style={styles.backBtn} onClick={onBack}>← Назад</button>
                </div>
                <div style={styles.error}>{error}</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={styles.container}>
                <div style={styles.header}>
                    <h1 style={styles.title}>📊 Админ-панель</h1>
                </div>
                <p style={{ textAlign: 'center', color: '#888' }}>Загрузка...</p>
            </div>
        );
    }

    const { onlineUsers, onlineUserIds, activeCalls, server } = data;

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>📊 Админ-панель</h1>
                <button style={styles.backBtn} onClick={onBack}>← Назад</button>
            </div>

            <div style={styles.grid}>
                {/* Online Users */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Онлайн пользователей</div>
                    <div style={styles.bigNumber}>{onlineUsers}</div>
                    {onlineUserIds?.length > 0 && (
                        <ul style={styles.list}>
                            {onlineUserIds.slice(0, 20).map(id => (
                                <li key={id} style={styles.listItem}>{id}</li>
                            ))}
                            {onlineUserIds.length > 20 && (
                                <li style={{ ...styles.listItem, color: '#888' }}>
                                    ...и ещё {onlineUserIds.length - 20}
                                </li>
                            )}
                        </ul>
                    )}
                </div>

                {/* Active Calls */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Активные звонки</div>
                    <div style={styles.bigNumber}>{activeCalls?.length || 0}</div>
                    {activeCalls?.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            {activeCalls.map(call => (
                                <div key={call.callId} style={styles.callCard}>
                                    <span style={{ ...styles.callType, ...(call.type === 'video' ? styles.video : styles.audio) }}>
                                        {call.type === 'video' ? '📹 Video' : '🎤 Audio'}
                                    </span>
                                    <span style={{ color: '#aaa' }}>{formatDuration(call.durationSec)}</span>
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#888' }}>
                                        👥 {call.participants?.length || 0} участников
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {(!activeCalls || activeCalls.length === 0) && (
                        <p style={{ color: '#666', marginTop: '12px', fontSize: '14px' }}>Нет активных звонков</p>
                    )}
                </div>

                {/* Server Stats */}
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Сервер</div>
                    <div style={styles.stat}>
                        <span style={styles.statLabel}>Uptime</span>
                        <span style={styles.statValue}>{formatUptime(server?.uptimeSec || 0)}</span>
                    </div>
                    <div style={styles.stat}>
                        <span style={styles.statLabel}>RAM (heap)</span>
                        <span style={styles.statValue}>{server?.memoryMb || 0} / {server?.memoryTotalMb || 0} MB</span>
                    </div>
                    <div style={styles.stat}>
                        <span style={styles.statLabel}>Load Avg (1m)</span>
                        <span style={styles.statValue}>{server?.loadAvg?.[0]?.toFixed(2) || '—'}</span>
                    </div>
                    <div style={styles.stat}>
                        <span style={styles.statLabel}>Load Avg (5m)</span>
                        <span style={styles.statValue}>{server?.loadAvg?.[1]?.toFixed(2) || '—'}</span>
                    </div>
                    <div style={{ ...styles.stat, borderBottom: 'none' }}>
                        <span style={styles.statLabel}>Load Avg (15m)</span>
                        <span style={styles.statValue}>{server?.loadAvg?.[2]?.toFixed(2) || '—'}</span>
                    </div>
                </div>
            </div>

            <div style={styles.refreshInfo}>
                Обновление каждые 4 сек • {lastUpdate ? `Последнее: ${lastUpdate.toLocaleTimeString()}` : ''}
            </div>
        </div>
    );
}
