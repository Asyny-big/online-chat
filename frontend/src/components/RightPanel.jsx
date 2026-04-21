import React from 'react';
import PromoCard from './PromoCard';

const RightPanel = () => (
  <aside className="right-panel">
    <PromoCard />

    <style>{`
      .right-panel {
        width: var(--right-panel-width);
        height: 100%;
        min-height: 0;
        position: sticky;
        top: 0;
        padding:
          max(var(--space-16), var(--safe-area-top))
          max(var(--space-16), var(--safe-area-right))
          max(var(--space-16), var(--safe-area-bottom))
          var(--space-16);
        border-left: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        gap: var(--space-20);
        overflow-y: auto;
        background:
          linear-gradient(180deg, rgba(15, 23, 42, 0.8), rgba(7, 11, 20, 0.9)),
          var(--bg-primary);
      }

      @media (max-width: 1024px) {
        .right-panel {
          display: none;
        }
      }
    `}</style>
  </aside>
);

export default RightPanel;
