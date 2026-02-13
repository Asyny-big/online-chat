import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';
import ChatWindow from '../components/ChatWindow';
import ChatList from '../components/ChatList';
import UserSearch from '../components/UserSearch';
import CreateGroupModal from '../components/CreateGroupModal';
import { MobileBottomNav, ContextFab, MobileCallsPanel, MobileProfilePanel } from '../components/mobile/MobileUx';
import { HrumToastProvider } from '../components/HrumToast';
import { CallProvider, useCallContext } from '../providers/CallProvider';
import '../styles/mobileMessenger.css';

/**
 * MobileApp — root mobile shell.
 * Owns: socket, chats, messages, mobile navigation, hash routing.
 * Call state is delegated to CallProvider.
 */

function MobileAppInner({ token, onLogout, socket: externalSocket, currentUserId }) {
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [mobileTab, setMobileTab] = useState('chats');
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

    const chatsRef = useRef(chats);
    const selectedChatRef = useRef(selectedChat);

    useEffect(() => { chatsRef.current = chats; }, [chats]);
    useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

    const { startCall, startGroupCall, incomingCallData, groupCallState, groupCallData } = useCallContext();

    // ─── Load chats ─────────────────────────────────────
    useEffect(() => {
        if (!token) return;
        axios
            .get(`${API_URL}/chats`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setChats(res.data || []))
            .catch(() => setChats([]));
    }, [token]);

    // ─── Socket listeners (UI-only: messages, typing, chat updates) ──
    useEffect(() => {
        const socket = externalSocket;
        if (!socket) return;

        const onMessageNew = (payload) => {
            const chatId = payload?.chatId;
            const message = payload?.message ?? payload;
            if (!chatId || !message) return;

            setChats((prev) => {
                const idx = prev.findIndex((c) => c._id === chatId);
                if (idx === -1) return prev;
                const updated = [...prev];
                const chat = { ...updated[idx], lastMessage: message };
                updated.splice(idx, 1);
                updated.unshift(chat);
                return updated;
            });

            setMessages((prev) => {
                if (selectedChatRef.current?._id === chatId) {
                    if (prev.some(m => m._id === message._id)) return prev;
                    return [...prev, message];
                }
                return prev;
            });
        };

        const onTypingUpdate = ({ chatId, userId, userName, isTyping }) => {
            setTypingUsers(prev => {
                if (isTyping) {
                    if (prev.some(t => t.chatId === chatId && t.userId === userId)) return prev;
                    return [...prev, { chatId, userId, userName }];
                }
                return prev.filter(t => !(t.chatId === chatId && t.userId === userId));
            });
        };

        const onChatNew = (newChat) => {
            setChats((prev) => {
                if (prev.some(c => c._id === newChat._id)) return prev;
                return [newChat, ...prev];
            });
            socket.emit('chat:join', { chatId: newChat._id });
        };

        const onMessageDeleted = ({ chatId, messageId }) => {
            setMessages((prev) => prev.filter(m => m._id !== messageId));
            setChats((prev) => prev.map(chat => {
                if (chat._id === chatId && chat.lastMessage?._id === messageId) {
                    return { ...chat, lastMessage: null };
                }
                return chat;
            }));
        };

        const onChatDeleted = ({ chatId }) => {
            setChats((prev) => prev.filter(c => c._id !== chatId));
            if (selectedChatRef.current?._id === chatId) {
                setSelectedChat(null);
                setMessages([]);
            }
        };

        // Group call metadata for chat list badges
        const onGroupCallStarted = ({ callId, chatId, initiator, type, participantCount }) => {
            setChats(prev => prev.map(chat => {
                if (chat._id === chatId) return { ...chat, activeGroupCall: { callId, initiator, type, participantCount } };
                return chat;
            }));
        };
        const onGroupCallUpdated = ({ chatId, participantCount }) => {
            setChats(prev => prev.map(chat => {
                if (chat._id === chatId && chat.activeGroupCall) {
                    return { ...chat, activeGroupCall: { ...chat.activeGroupCall, participantCount } };
                }
                return chat;
            }));
        };
        const onGroupCallEnded = ({ chatId }) => {
            setChats(prev => prev.map(chat => {
                if (chat._id === chatId) return { ...chat, activeGroupCall: null };
                return chat;
            }));
        };
        const onChatUpdated = ({ chatId, name, avatarUrl }) => {
            setChats(prev => prev.map(chat => {
                if (chat._id === chatId) return { ...chat, name, avatarUrl, displayName: name };
                return chat;
            }));
        };

        socket.on('message:new', onMessageNew);
        socket.on('typing:update', onTypingUpdate);
        socket.on('chat:new', onChatNew);
        socket.on('message:deleted', onMessageDeleted);
        socket.on('chat:deleted', onChatDeleted);
        socket.on('group-call:started', onGroupCallStarted);
        socket.on('group-call:updated', onGroupCallUpdated);
        socket.on('group-call:ended', onGroupCallEnded);
        socket.on('chat:updated', onChatUpdated);

        return () => {
            socket.off('message:new', onMessageNew);
            socket.off('typing:update', onTypingUpdate);
            socket.off('chat:new', onChatNew);
            socket.off('message:deleted', onMessageDeleted);
            socket.off('chat:deleted', onChatDeleted);
            socket.off('group-call:started', onGroupCallStarted);
            socket.off('group-call:updated', onGroupCallUpdated);
            socket.off('group-call:ended', onGroupCallEnded);
            socket.off('chat:updated', onChatUpdated);
        };
    }, [externalSocket]);

    // ─── Load messages when chat selected ───────────────
    useEffect(() => {
        if (!token || !selectedChat) { setMessages([]); return; }
        axios
            .get(`${API_URL}/messages/${selectedChat._id}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setMessages(res.data || []))
            .catch(() => setMessages([]));
        if (externalSocket) externalSocket.emit('chat:join', { chatId: selectedChat._id });
    }, [token, selectedChat]);

    // ─── Hash routing ───────────────────────────────────
    useEffect(() => {
        const syncFromHash = () => {
            const normalized = String(window.location.hash || '').replace(/^#\/?/, '');
            const [tabRaw, chatIdRaw] = normalized.split('/');
            const nextTab = ['chats', 'calls', 'contacts', 'profile'].includes(tabRaw) ? tabRaw : 'chats';
            setMobileTab(nextTab);

            if (nextTab !== 'chats') {
                if (selectedChatRef.current) setSelectedChat(null);
                return;
            }

            const chatIdFromHash = chatIdRaw ? decodeURIComponent(chatIdRaw) : null;
            if (!chatIdFromHash) {
                if (selectedChatRef.current) setSelectedChat(null);
                return;
            }

            const chatFromHash = chatsRef.current.find(c => c._id === chatIdFromHash);
            if (chatFromHash) setSelectedChat(chatFromHash);
            else if (selectedChatRef.current) setSelectedChat(null);
        };
        syncFromHash();
        window.addEventListener('hashchange', syncFromHash);
        return () => window.removeEventListener('hashchange', syncFromHash);
    }, []);

    // Sync hash when chat list loads
    useEffect(() => {
        if (chats.length === 0) return;
        const normalized = String(window.location.hash || '').replace(/^#\/?/, '');
        const [tabRaw, chatIdRaw] = normalized.split('/');
        if (tabRaw !== 'chats' || !chatIdRaw) return;
        const chatIdFromHash = decodeURIComponent(chatIdRaw);
        if (selectedChatRef.current?._id === chatIdFromHash) return;
        const chatFromHash = chats.find(c => c._id === chatIdFromHash);
        if (chatFromHash) setSelectedChat(chatFromHash);
    }, [chats]);

    // Push hash on state change
    useEffect(() => {
        const nextHash = selectedChat
            ? `#/chats/${encodeURIComponent(selectedChat._id)}`
            : `#/${mobileTab}`;
        if (window.location.hash !== nextHash) {
            window.history.replaceState(null, '', nextHash);
        }
    }, [mobileTab, selectedChat]);

    // Keep mobileTab in sync
    useEffect(() => {
        if (selectedChat && mobileTab !== 'chats') setMobileTab('chats');
    }, [mobileTab, selectedChat]);

    // ─── Chat actions ───────────────────────────────────
    const handleSelectChat = (chat) => {
        setSelectedChat(chat);
        setMobileTab('chats');
    };

    const handleCreateChat = async (userId) => {
        try {
            const res = await axios.post(
                `${API_URL}/chats/private`,
                { userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const newChat = res.data;
            setChats((prev) => {
                if (prev.find(c => c._id === newChat._id)) return prev;
                return [newChat, ...prev];
            });
            setSelectedChat(newChat);
            setMobileTab('chats');
        } catch (error) {
            console.error('Ошибка создания чата:', error);
            alert('Не удалось создать чат');
        }
    };

    const handleAddChat = useCallback((chat) => {
        setChats((prev) => {
            if (prev.find(c => c._id === chat._id)) return prev;
            return [chat, ...prev];
        });
    }, []);

    const handleDeleteMessage = useCallback(async (messageId) => {
        if (!selectedChat || !token) return;
        try {
            await axios.delete(`${API_URL}/messages/${selectedChat._id}/${messageId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Ошибка удаления сообщения:', error);
            alert(error.response?.data?.error || 'Не удалось удалить сообщение');
        }
    }, [selectedChat, token]);

    const handleDeleteChat = useCallback(async () => {
        if (!selectedChat || !token) return;
        try {
            await axios.delete(`${API_URL}/chats/${selectedChat._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Ошибка удаления чата:', error);
            alert(error.response?.data?.error || 'Не удалось удалить чат');
        }
    }, [selectedChat, token]);

    const handleStartCall = useCallback((type) => {
        if (!selectedChat) return;
        startCall(selectedChat, type);
    }, [selectedChat, startCall]);

    const handleStartGroupCall = useCallback((type) => {
        if (!selectedChat) return;
        startGroupCall(selectedChat, type);
    }, [selectedChat, startGroupCall]);

    const openChatById = useCallback((chatId) => {
        const nextChat = chats.find(c => c._id === chatId);
        if (!nextChat) return;
        setSelectedChat(nextChat);
        setMobileTab('chats');
    }, [chats]);

    const privateChats = useMemo(
        () => chats.filter(chat => chat?.type !== 'group' && chat?.isGroup !== true),
        [chats]
    );

    // ─── Render ─────────────────────────────────────────
    const hideChrome = !!selectedChat;

    return (
        <div className="gm-mobile-shell">
            <main className={`gm-mobile-main ${hideChrome ? 'gm-mobile-main--chat-open' : ''}`}>
                {mobileTab === 'chats' && (
                    selectedChat ? (
                        <ChatWindow
                            token={token}
                            chat={selectedChat}
                            messages={messages}
                            socket={externalSocket}
                            currentUserId={currentUserId}
                            onStartCall={handleStartCall}
                            onStartGroupCall={handleStartGroupCall}
                            typingUsers={typingUsers}
                            onBack={() => { setSelectedChat(null); setMobileTab('chats'); }}
                            onDeleteMessage={handleDeleteMessage}
                            onDeleteChat={handleDeleteChat}
                        />
                    ) : (
                        <section className="gm-mobile-panel">
                            <header className="gm-mobile-panel__header"><h2>Чаты</h2></header>
                            <ChatList
                                chats={chats}
                                selectedChat={selectedChat}
                                onSelectChat={handleSelectChat}
                                incomingCallChatId={incomingCallData?.chatId}
                                label="Диалоги"
                            />
                        </section>
                    )
                )}

                {mobileTab === 'calls' && (
                    <MobileCallsPanel
                        chats={chats}
                        incomingCallData={incomingCallData}
                        groupCallData={groupCallState === 'incoming' ? groupCallData : null}
                        onOpenChat={openChatById}
                    />
                )}

                {mobileTab === 'contacts' && (
                    <section className="gm-mobile-panel">
                        <header className="gm-mobile-panel__header"><h2>Контакты</h2></header>
                        <UserSearch token={token} onCreateChat={handleCreateChat} inputId="gc-mobile-contact-search" />
                        <ChatList
                            chats={privateChats}
                            selectedChat={selectedChat}
                            onSelectChat={handleSelectChat}
                            incomingCallChatId={incomingCallData?.chatId}
                            label="Контакты"
                        />
                    </section>
                )}

                {mobileTab === 'profile' && (
                    <MobileProfilePanel
                        token={token}
                        onLogout={onLogout}
                        settingsOpen={profileSettingsOpen}
                        onToggleSettings={() => setProfileSettingsOpen(v => !v)}
                    />
                )}
            </main>

            {!hideChrome && (
                <MobileBottomNav
                    activeTab={mobileTab}
                    onChange={(nextTab) => { setSelectedChat(null); setMobileTab(nextTab); }}
                />
            )}

            <ContextFab
                tab={mobileTab}
                hidden={hideChrome}
                onChatsAction={() => setShowCreateGroupModal(true)}
                onContactsAction={() => window.dispatchEvent(new Event('govchat:focus-user-search'))}
                onProfileAction={() => setProfileSettingsOpen(v => !v)}
                onCallsAction={() => setMobileTab('chats')}
            />

            {showCreateGroupModal && (
                <CreateGroupModal
                    token={token}
                    onClose={() => setShowCreateGroupModal(false)}
                    onGroupCreated={(groupChat) => {
                        handleAddChat(groupChat);
                        setSelectedChat(groupChat);
                        setMobileTab('chats');
                        setShowCreateGroupModal(false);
                    }}
                />
            )}
        </div>
    );
}

function MobileApp({ token, onLogout }) {
    // Socket needs to be created here so CallProvider can use it
    const socketRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        if (!token) return;
        axios
            .get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setCurrentUserId(res.data._id))
            .catch(() => { });
    }, [token]);

    useEffect(() => {
        if (!token) return;
        const s = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
        socketRef.current = s;
        setSocket(s);
        return () => s.disconnect();
    }, [token]);

    return (
        <HrumToastProvider>
            <CallProvider socket={socket} token={token} currentUserId={currentUserId} chats={[]}>
                <MobileAppInner token={token} onLogout={onLogout} socket={socket} currentUserId={currentUserId} />
            </CallProvider>
        </HrumToastProvider>
    );
}

export default MobileApp;
