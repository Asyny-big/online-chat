import React from 'react';
import AppNavSidebar from '@/components/AppNavSidebar';

function TopBar() {
  return null;
}

function PrimaryNav({ show, activeKey, onNavigate, onLogout, badgeCounts }) {
  if (!show) return null;

  return (
    <AppNavSidebar
      activeKey={activeKey}
      onNavigate={onNavigate}
      onLogout={onLogout}
      badgeCounts={badgeCounts}
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
  navBadgeCounts,
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
          badgeCounts={navBadgeCounts}
        />

        <RouteOutlet withRightPanel={withRightPanel}>{children}</RouteOutlet>

        {withRightPanel ? rightPanel : null}
      </div>

      <GlobalOverlayHost>{overlay}</GlobalOverlayHost>

      <style>{`
        .app-shell-root {
          height: 100vh;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }

        .app-shell-layout {
          display: grid;
          grid-template-columns: var(--sidebar-width) 1fr;
          height: 100%;
          min-height: 100%;
        }

        .app-shell-layout.with-right-panel {
          grid-template-columns: var(--sidebar-width) 1fr var(--right-panel-width);
        }

        .app-shell-main {
          border-right: 1px solid var(--border-color);
          border-left: 1px solid var(--border-color);
          min-width: 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
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
