import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import CallModal from '../components/CallModal';
import GroupCallModalLiveKit from '../components/GroupCallModalLiveKit';
import IncomingCallScreen from '../components/IncomingCallScreen';
import { CallSessionStore } from '../utils/CallSessionStore';
import { getTransactions } from '../economy/api';

/* ═══════════════════════════════════════════════════════════
   CallProvider — centralised call state at the app root.

   Owns:
   - All call-related socket listeners
   - 1-to-1 call state machine
   - Group call state machine
   - Persistent session (Android resume)
   - Renders CallModal / GroupCallModal / IncomingCallScreen
═══════════════════════════════════════════════════════════ */

const CallContext = createContext(null);

export function useCallContext() {
    const ctx = useContext(CallContext);
    if (!ctx) throw new Error('useCallContext must be used within <CallProvider>');
    return ctx;
}

export function CallProvider({ socket, token, currentUserId, chats, onSwitchToChat, children }) {
    // ─── 1-to-1 call state ───────────────────────────────
    const [callState, setCallState] = useState('idle');       // idle | incoming | outgoing | active
    const [callType, setCallType] = useState(null);           // audio | video
    const [callId, setCallId] = useState(null);
    const [remoteUser, setRemoteUser] = useState(null);
    const [activeCallChatId, setActiveCallChatId] = useState(null);
    const [incomingCallData, setIncomingCallData] = useState(null);

    // ─── Group call state ────────────────────────────────
    const [groupCallState, setGroupCallState] = useState('idle'); // idle | incoming | active
    const [groupCallData, setGroupCallData] = useState(null);

    // ─── Refs for socket handlers ────────────────────────
    const callStateRef = useRef(callState);
    const callIdRef = useRef(callId);
    const currentUserIdRef = useRef(currentUserId);
    const groupCallStateRef = useRef(groupCallState);
    const groupCallDataRef = useRef(groupCallData);
    const chatsRef = useRef(chats);

    useEffect(() => { callStateRef.current = callState; }, [callState]);
    useEffect(() => { callIdRef.current = callId; }, [callId]);
    useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);
    useEffect(() => { groupCallStateRef.current = groupCallState; }, [groupCallState]);
    useEffect(() => { groupCallDataRef.current = groupCallData; }, [groupCallData]);
    useEffect(() => { chatsRef.current = chats; }, [chats]);

    // ─── Economy probe (call-start reward) ─────────────
    const economyProbeCallStart = useCallback(() => {
        if (!token) return;
        const probe = async (code) => {
            try {
                const data = await getTransactions({ token, limit: 1 });
                const t = data?.items?.[0];
                if (!t || t.reasonCode !== code) return;
                // showEarn is handled at HrumToast level — we just trigger the check
            } catch (_) { }
        };
        setTimeout(() => probe('earn:call_start'), 800);
        setTimeout(() => probe('earn:call_start'), 2200);
    }, [token]);

    // ─── Reset helpers ────────────────────────────────────
    const resetCallState = useCallback(() => {
        setCallState('idle');
        setCallType(null);
        setCallId(null);
        setRemoteUser(null);
        setIncomingCallData(null);
        setActiveCallChatId(null);
        CallSessionStore.clear();
    }, []);

    const resetGroupCallState = useCallback(() => {
        setGroupCallState('idle');
        setGroupCallData(null);
        CallSessionStore.clear();
    }, []);

    // ─── Actions ──────────────────────────────────────────
    const startCall = useCallback((selectedChat, type) => {
        if (!selectedChat || !socket) return;

        const otherParticipant = selectedChat.participants?.find(
            p => (p.user?._id || p.user) !== currentUserIdRef.current
        );
        const targetUser = otherParticipant?.user || otherParticipant;

        setRemoteUser({
            _id: targetUser?._id || targetUser,
            name: selectedChat.displayName || selectedChat.name || 'Пользователь'
        });
        setCallType(type);
        setCallState('outgoing');
        setActiveCallChatId(selectedChat._id);

        socket.emit('call:start', { chatId: selectedChat._id, type }, (response) => {
            if (response.error) {
                alert(response.error);
                resetCallState();
            } else {
                setCallId(response.callId);
                CallSessionStore.save({
                    callId: response.callId,
                    chatId: selectedChat._id,
                    callType: type,
                    startedAt: Date.now(),
                    isGroup: false
                });
                economyProbeCallStart();
            }
        });
    }, [socket, resetCallState, economyProbeCallStart]);

    const startGroupCall = useCallback((selectedChat, type) => {
        if (!selectedChat || !socket || selectedChat.type !== 'group') return;

        const knownActiveCallId = selectedChat.activeGroupCall?.callId;
        const knownActiveType = selectedChat.activeGroupCall?.type;
        if (knownActiveCallId) {
            setGroupCallState('active');
            setGroupCallData({
                callId: knownActiveCallId,
                chatId: selectedChat._id,
                chatName: selectedChat.name || selectedChat.displayName,
                type: knownActiveType || type,
                autoJoin: true,
                isExisting: true
            });
            return;
        }

        socket.emit('group-call:start', { chatId: selectedChat._id, type }, (response) => {
            if (response.error === 'already_active') {
                if (window.confirm('В группе уже идёт звонок. Присоединиться?')) {
                    setGroupCallState('active');
                    setGroupCallData({
                        callId: response.callId,
                        chatId: selectedChat._id,
                        chatName: selectedChat.name || selectedChat.displayName,
                        type: response.type || type,
                        autoJoin: true,
                        isExisting: true
                    });
                }
            } else if (response.error) {
                alert(response.error);
            } else {
                setGroupCallState('active');
                setGroupCallData({
                    callId: response.callId,
                    chatId: selectedChat._id,
                    chatName: selectedChat.name || selectedChat.displayName,
                    type,
                    isInitiator: true
                });
                CallSessionStore.save({
                    callId: response.callId,
                    chatId: selectedChat._id,
                    callType: type,
                    startedAt: Date.now(),
                    isGroup: true
                });
                economyProbeCallStart();
            }
        });
    }, [socket, economyProbeCallStart]);

    const joinGroupCall = useCallback((callIdFromUi, typeFromUi) => {
        const data = groupCallDataRef.current;
        if (!data && !callIdFromUi) return;

        const cId = callIdFromUi || data?.callId;
        const chatId = data?.chatId;
        const chatName = data?.chatName;
        const type = typeFromUi || data?.type || 'video';

        setGroupCallState('active');
        setGroupCallData({
            ...(data || {}),
            callId: cId,
            chatId,
            chatName,
            type,
            autoJoin: true,
            isExisting: true
        });
    }, []);

    const declineGroupCall = useCallback(() => {
        resetGroupCallState();
    }, [resetGroupCallState]);

    const handleCallAccepted = useCallback(() => {
        const nextChatId = incomingCallData?.chatId || activeCallChatId;
        if (nextChatId) {
            onSwitchToChat?.(nextChatId);
            setActiveCallChatId(nextChatId);
        }
        setIncomingCallData(null);
        setCallState('active');
        CallSessionStore.save({
            callId: callIdRef.current,
            chatId: nextChatId,
            callType: callType,
            startedAt: Date.now(),
            isGroup: false
        });
    }, [activeCallChatId, incomingCallData?.chatId, callType, onSwitchToChat]);

    // ─── Socket listeners ────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        // === 1-to-1 CALLS ===
        const onCallIncoming = ({ callId: incomingCallId, chatId: incomingChatId, chatName, initiator, type }) => {
            console.log('[CallProvider] Incoming call:', { incomingCallId, incomingChatId, initiator, type });

            setIncomingCallData({
                callId: incomingCallId,
                chatId: incomingChatId,
                initiator: {
                    _id: initiator._id,
                    name: initiator.name || chatName || 'Пользователь',
                    avatarUrl: initiator.avatarUrl
                },
                type
            });
            setCallState('incoming');
            setCallType(type);
            setCallId(incomingCallId);
            setActiveCallChatId(incomingChatId || null);
            setRemoteUser({
                _id: initiator._id,
                name: initiator.name || chatName || 'Пользователь',
                avatarUrl: initiator.avatarUrl
            });
        };

        const onParticipantJoined = ({ callId: cId, userId: joinedUserId, userName }) => {
            if (joinedUserId === currentUserIdRef.current) return;
            if (callStateRef.current === 'outgoing') {
                setCallState('active');
            }
        };

        const onCallEnded = ({ callId: cId, reason }) => {
            console.log('[CallProvider] Call ended:', { cId, reason });
            resetCallState();
        };

        const onParticipantLeft = ({ callId: cId, callEnded }) => {
            if (callEnded) {
                resetCallState();
            }
        };

        // === GROUP CALLS ===
        const onGroupCallIncoming = ({ callId, chatId, chatName, initiator, type, participantCount }) => {
            if (callStateRef.current !== 'idle' || groupCallStateRef.current !== 'idle') return;

            setGroupCallState('incoming');
            setGroupCallData({ callId, chatId, chatName, initiator, type, participantCount });
        };

        const onGroupCallEnded = ({ callId, chatId, reason }) => {
            if (groupCallDataRef.current?.chatId === chatId) {
                resetGroupCallState();
            }
        };

        socket.on('call:incoming', onCallIncoming);
        socket.on('call:participant_joined', onParticipantJoined);
        socket.on('call:ended', onCallEnded);
        socket.on('call:participant_left', onParticipantLeft);
        socket.on('group-call:incoming', onGroupCallIncoming);
        socket.on('group-call:ended', onGroupCallEnded);

        return () => {
            socket.off('call:incoming', onCallIncoming);
            socket.off('call:participant_joined', onParticipantJoined);
            socket.off('call:ended', onCallEnded);
            socket.off('call:participant_left', onParticipantLeft);
            socket.off('group-call:incoming', onGroupCallIncoming);
            socket.off('group-call:ended', onGroupCallEnded);
        };
    }, [socket, resetCallState, resetGroupCallState]);

    // ─── Android resume: restore call from localStorage ──
    useEffect(() => {
        const session = CallSessionStore.load();
        if (!session || !socket) return;

        console.log('[CallProvider] Restoring call session from localStorage:', session);
        if (session.isGroup) {
            setGroupCallState('active');
            setGroupCallData({
                callId: session.callId,
                chatId: session.chatId,
                type: session.callType,
                autoJoin: true,
                isExisting: true,
                chatName: ''
            });
        } else {
            setCallState('active');
            setCallId(session.callId);
            setCallType(session.callType);
            setActiveCallChatId(session.chatId);
        }
    }, [socket]);

    // ─── Computed values ──────────────────────────────────
    const callModalChatId = activeCallChatId || incomingCallData?.chatId || null;
    const effectiveRemoteUser = remoteUser || incomingCallData?.initiator || null;
    const shouldShowCallModal = callState !== 'idle' && callState !== 'incoming';
    const shouldShowIncoming = callState === 'incoming';
    const shouldShowGroupCall = groupCallState !== 'idle' && groupCallData;

    const ctxValue = useMemo(() => ({
        // 1-to-1
        callState,
        callType,
        callId,
        remoteUser: effectiveRemoteUser,
        activeCallChatId,
        incomingCallData,
        // group
        groupCallState,
        groupCallData,
        // actions
        startCall,
        startGroupCall,
        joinGroupCall,
        declineGroupCall,
        resetCallState,
        resetGroupCallState,
    }), [
        callState, callType, callId, effectiveRemoteUser, activeCallChatId, incomingCallData,
        groupCallState, groupCallData,
        startCall, startGroupCall, joinGroupCall, declineGroupCall, resetCallState, resetGroupCallState,
    ]);

    return (
        <CallContext.Provider value={ctxValue}>
            {children}

            {/* Fullscreen incoming call overlay — works from ANY screen */}
            {shouldShowIncoming && (
                <IncomingCallScreen
                    callerName={incomingCallData?.initiator?.name || 'Пользователь'}
                    callerAvatar={incomingCallData?.initiator?.avatarUrl}
                    callType={callType}
                    isGroup={false}
                    onAccept={() => {
                        /* acceptance is handled inside CallModal after media is acquired */
                        setCallState('outgoing'); // transition away from incoming screen
                    }}
                    onDecline={() => {
                        if (socket && callId) socket.emit('call:decline', { callId });
                        resetCallState();
                    }}
                />
            )}

            {/* Incoming group call overlay */}
            {groupCallState === 'incoming' && groupCallData && (
                <IncomingCallScreen
                    callerName={groupCallData.chatName || 'Групповой звонок'}
                    callerAvatar={null}
                    callType={groupCallData.type}
                    isGroup={true}
                    initiatorName={groupCallData.initiator?.name}
                    onAccept={() => joinGroupCall(groupCallData.callId, groupCallData.type)}
                    onDecline={declineGroupCall}
                />
            )}

            {/* 1-to-1 Call Modal */}
            {shouldShowCallModal && (
                <CallModal
                    socket={socket}
                    callState={callState}
                    callType={callType}
                    callId={callId}
                    chatId={callModalChatId}
                    remoteUser={effectiveRemoteUser}
                    onClose={resetCallState}
                    onCallAccepted={handleCallAccepted}
                    currentUserId={currentUserId}
                    token={token}
                />
            )}

            {/* Group Call Modal */}
            {shouldShowGroupCall && (
                <GroupCallModalLiveKit
                    socket={socket}
                    callId={groupCallData.callId}
                    chatId={groupCallData.chatId}
                    chatName={groupCallData.chatName}
                    callType={groupCallData.type}
                    isIncoming={groupCallState === 'incoming'}
                    autoJoin={!!groupCallData.autoJoin}
                    initiator={groupCallData.initiator}
                    existingParticipants={groupCallData.existingParticipants || []}
                    currentUserId={currentUserId}
                    token={token}
                    onClose={resetGroupCallState}
                    onJoin={joinGroupCall}
                />
            )}
        </CallContext.Provider>
    );
}

export default CallProvider;
