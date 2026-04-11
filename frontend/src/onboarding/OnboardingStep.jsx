import React from 'react';
import OnboardingOverlay from './OnboardingOverlay';
import OnboardingHighlight from './OnboardingHighlight';
import OnboardingPopover from './OnboardingPopover';

export default function OnboardingStep(props) {
  const { targetRect, targetMissing, activeStep } = props;

  if (!activeStep) return null;

  return (
    <div className="onboarding-layer" role="dialog" aria-modal="true" aria-label={activeStep.title}>
      <OnboardingOverlay rect={targetRect} targetMissing={targetMissing} />
      {!targetMissing ? <OnboardingHighlight rect={targetRect} /> : null}
      <OnboardingPopover {...props} />
    </div>
  );
}
