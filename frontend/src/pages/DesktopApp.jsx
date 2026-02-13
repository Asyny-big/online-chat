import React from 'react';
import ChatPage from './ChatPage';
import { HrumToastProvider } from '../components/HrumToast';

/**
 * DesktopApp — thin wrapper that renders the existing ChatPage in desktop mode.
 * CallProvider is embedded inside ChatPage for desktop (for now),
 * because ChatPage already manages socket/chats/call state for desktop.
 * 
 * In a future refactor, CallProvider can be lifted here as well.
 */
function DesktopApp({ token, onLogout }) {
    return (
        <HrumToastProvider>
            <ChatPage token={token} onLogout={onLogout} />
        </HrumToastProvider>
    );
}

export default DesktopApp;
