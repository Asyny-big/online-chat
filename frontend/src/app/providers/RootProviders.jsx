import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { initPushNotifications } from '@/mobile/pushNotifications';
import { HrumToastProvider } from '@/components/HrumToast';

const AuthSessionContext = createContext(null);
const ApiClientContext = createContext(null);
const SocketContext = createContext(null);
const CallSessionContext = createContext(null);
const ModalHostContext = createContext(null);

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep default console visibility for infra-level diagnostics.
    console.error('[AppErrorBoundary] Unhandled render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: '#ef4444', fontWeight: 700 }}>
          Произошла критическая ошибка интерфейса.
        </div>
      );
    }

    return this.props.children;
  }
}

export function AuthSessionProvider({ token, setToken, children }) {
  const value = useMemo(() => ({ token, setToken }), [token, setToken]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function ApiClientProvider({ token, children }) {
  const value = useMemo(() => ({ token }), [token]);
  return <ApiClientContext.Provider value={value}>{children}</ApiClientContext.Provider>;
}

export function PushNotificationsProvider({ token, children }) {
  useEffect(() => {
    if (!token) return undefined;
    const cleanup = initPushNotifications({ token });
    return cleanup;
  }, [token]);

  return children;
}

export function SocketProvider({ children }) {
  // Phase 1 boundary only: socket ownership stays in ChatPage.
  const value = useMemo(() => ({ socket: null }), []);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function CallSessionProvider({ children }) {
  // Phase 1 boundary only: call session ownership stays in ChatPage.
  const value = useMemo(() => ({ activeCall: null }), []);
  return <CallSessionContext.Provider value={value}>{children}</CallSessionContext.Provider>;
}

export function ModalHostProvider({ children }) {
  const value = useMemo(() => ({ modals: [] }), []);
  return <ModalHostContext.Provider value={value}>{children}</ModalHostContext.Provider>;
}

export default function RootProviders({ token, setToken, children }) {
  return (
    <AppErrorBoundary>
      <AuthSessionProvider token={token} setToken={setToken}>
        <ApiClientProvider token={token}>
          <PushNotificationsProvider token={token}>
            <SocketProvider>
              <CallSessionProvider>
                <HrumToastProvider>
                  <ModalHostProvider>
                    {children}
                  </ModalHostProvider>
                </HrumToastProvider>
              </CallSessionProvider>
            </SocketProvider>
          </PushNotificationsProvider>
        </ApiClientProvider>
      </AuthSessionProvider>
    </AppErrorBoundary>
  );
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}

export function useApiClientContext() {
  return useContext(ApiClientContext);
}

export function useSocketContext() {
  return useContext(SocketContext);
}

export function useCallSessionContext() {
  return useContext(CallSessionContext);
}

export function useModalHostContext() {
  return useContext(ModalHostContext);
}
