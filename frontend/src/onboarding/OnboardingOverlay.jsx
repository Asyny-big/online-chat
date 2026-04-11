import React from 'react';

function normalizeRect(rect) {
  if (!rect || typeof window === 'undefined') return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = Math.max(0, Math.min(rect.left, viewportWidth));
  const top = Math.max(0, Math.min(rect.top, viewportHeight));
  const right = Math.max(left, Math.min(rect.left + rect.width, viewportWidth));
  const bottom = Math.max(top, Math.min(rect.top + rect.height, viewportHeight));

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

export default function OnboardingOverlay({ rect, targetMissing = false }) {
  const normalizedRect = normalizeRect(rect);

  if (!normalizedRect || targetMissing) {
    return (
      <div className="onboarding-overlay" aria-hidden="true">
        <div className="onboarding-overlay-fill" />
      </div>
    );
  }

  return (
    <div className="onboarding-overlay" aria-hidden="true">
      <div
        className="onboarding-overlay-panel onboarding-overlay-panel--top"
        style={{ height: `${normalizedRect.top}px` }}
      />
      <div
        className="onboarding-overlay-panel onboarding-overlay-panel--left"
        style={{
          top: `${normalizedRect.top}px`,
          width: `${normalizedRect.left}px`,
          height: `${normalizedRect.height}px`
        }}
      />
      <div
        className="onboarding-overlay-panel onboarding-overlay-panel--right"
        style={{
          top: `${normalizedRect.top}px`,
          left: `${normalizedRect.right}px`,
          height: `${normalizedRect.height}px`
        }}
      />
      <div
        className="onboarding-overlay-panel onboarding-overlay-panel--bottom"
        style={{ top: `${normalizedRect.bottom}px` }}
      />
    </div>
  );
}
