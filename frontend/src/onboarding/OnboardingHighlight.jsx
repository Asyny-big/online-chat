import React from 'react';

export default function OnboardingHighlight({ rect }) {
  if (!rect) return null;

  return (
    <div
      className="onboarding-highlight"
      aria-hidden="true"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      }}
    />
  );
}
