import React from 'react';
import AppNavSidebar from '../components/AppNavSidebar';

function TopBar() {
  return null;
}

function PrimaryNav({ show, activeKey, onNavigate, onLogout }) {
  if (!show) return null;

  return (
    <AppNavSidebar
      activeKey={activeKey}
      onNavigate={onNavigate}
      onLogout={onLogout}
    />
  );
}

function RouteOutlet({ children, withRightPanel }) {
  return (
    <main className={`app-shell-main ${withRightPanel ? 'with-right-panel' : ''}`}>
      {children}
    </main>
  );
}

function GlobalOverlayHost({ children }) {
  return <div className="app-shell-overlay-host">{children}</div>;
}

export default function AppShell({
  showPrimaryNav = true,
  activeNavKey,
  onNavigate,
  onLogout,
  withRightPanel = false,
  rightPanel = null,
  overlay = null,
  children
}) {
  return (
    <div className="app-shell-root">
      <TopBar />

      <div className={`app-shell-layout ${withRightPanel ? 'with-right-panel' : ''}`}>
        <PrimaryNav
          show={showPrimaryNav}
          activeKey={activeNavKey}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <RouteOutlet withRightPanel={withRightPanel}>{children}</RouteOutlet>

        {withRightPanel ? rightPanel : null}
      </div>

      <GlobalOverlayHost>{overlay}</GlobalOverlayHost>

      <style>{`
        .app-shell-root {
          min-height: 100vh;
          position: relative;
        }

        .app-shell-layout {
          display: grid;
          grid-template-columns: var(--sidebar-width) 1fr;
          min-height: 100vh;
        }

        .app-shell-layout.with-right-panel {
          grid-template-columns: var(--sidebar-width) 1fr var(--right-panel-width);
        }

        .app-shell-main {
          border-right: 1px solid var(--border-color);
          border-left: 1px solid var(--border-color);
          min-width: 0;
        }

        .app-shell-main.with-right-panel {
          border-right: 1px solid var(--border-color);
        }

        .app-shell-overlay-host {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
        }

        .app-shell-overlay-host > * {
          pointer-events: auto;
        }

        @media (max-width: 1024px) {
          .app-shell-layout.with-right-panel {
            grid-template-columns: var(--sidebar-width) 1fr;
          }
        }
      `}</style>
    </div>
  );
}

