# GovChat Onboarding Design

## Problem

GovChat already has feed, messaging, calls, FAQ/support, and profile flows, but a first-time user lands in the product without guided discovery. The onboarding must explain the main surface areas without blocking the product or introducing brittle dependencies.

## Constraints

- Existing app uses React with route state based on `window.location.hash`.
- UI is already split across route-level pages and embedded component styles.
- The solution must survive missing DOM targets, empty feed states, and mobile layout differences.
- No new frontend dependency should be required for the first version.

## Decision

Build a custom onboarding layer around:

- `OnboardingProvider` for state, persistence, route-aware step orchestration.
- `OnboardingStep` for a single rendered step.
- `OnboardingOverlay`, `OnboardingHighlight`, `OnboardingPopover` for the visual layer.
- `steps` config as the only place where product copy, selectors, and route bindings live.

The provider renders through a portal so the walkthrough stays above every route and modal host. Step targets are referenced by `data-onboarding-id`, which keeps integration low-risk and easy to extend.

## Why this is the right level of complexity

- Simpler than introducing `react-joyride` or `shepherd.js` and then bending them around hash routing and custom fallback logic.
- More robust than ad hoc local state inside each page.
- Scales by adding new step configs and target markers, not by rewriting onboarding flow logic.

## Critical behaviors

- Auto-start only for users who have not completed or dismissed onboarding.
- Persist progress in `localStorage`.
- Navigate between routes when a step belongs to another surface.
- Scroll target into view if needed.
- Fall back to a centered tooltip when a target is missing.
- Allow manual restart from profile.

## Risks and mitigations

- Empty feed means like/comment targets may not exist.
  Mitigation: centered fallback message instead of a hard failure.
- Mobile chat page can hide the sidebar when a chat is open.
  Mitigation: onboarding forces the list view for the chats step on mobile.
- Support step depends on the profile home view.
  Mitigation: onboarding forces the profile page back to `home` for that step.
