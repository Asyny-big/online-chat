# GovChat Onboarding Component Map

## Global Layer

- `frontend/src/onboarding/OnboardingProvider.jsx`
  Responsibility: lifecycle, persistence, target resolution, route sync, step navigation.
- `frontend/src/onboarding/onboardingSteps.js`
  Responsibility: declarative step definitions.

## Render Layer

- `frontend/src/onboarding/OnboardingStep.jsx`
  Responsibility: compose overlay, highlight, and popover for the active step.
- `frontend/src/onboarding/OnboardingOverlay.jsx`
  Responsibility: backdrop dimming.
- `frontend/src/onboarding/OnboardingHighlight.jsx`
  Responsibility: spotlight box around the active target.
- `frontend/src/onboarding/OnboardingPopover.jsx`
  Responsibility: copy, progress, and controls.

## Product Integration Points

- `frontend/src/App.jsx`
  Responsibility: provide current route and navigation callback to onboarding.
- `frontend/src/domains/feed/pages/FeedPage.jsx`
  Responsibility: expose feed surface and first post actions as targets.
- `frontend/src/components/PostComposer.jsx`
  Responsibility: expose post creation entry point.
- `frontend/src/components/Sidebar.jsx`
  Responsibility: expose chat list surface.
- `frontend/src/components/ChatWindow.jsx`
  Responsibility: expose call actions surface.
- `frontend/src/domains/messages/pages/ChatPage.jsx`
  Responsibility: make onboarding-safe chat selection decisions.
- `frontend/src/domains/profile/pages/ProfilePage.jsx`
  Responsibility: expose support CTA and manual onboarding restart.

## Boundaries

- Step config knows selectors and route placement.
- Product pages only expose stable target markers and small onboarding-safe state adjustments.
- Visual onboarding components do not know application business logic.
