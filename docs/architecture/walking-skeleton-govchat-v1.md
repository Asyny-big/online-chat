# GovChat Onboarding Walking Skeleton

## Thin End-to-End Slice

1. Authenticated user lands in GovChat.
2. `OnboardingProvider` loads persisted state from `localStorage`.
3. If onboarding is not completed or dismissed, the provider opens step 1.
4. Step config decides whether the current step needs a route change.
5. Provider navigates to the required route and waits for a DOM target.
6. If target appears, it is scrolled into view and highlighted.
7. If target does not appear, the tooltip falls back to a centered state.
8. User can go next, back, skip, or finish.
9. Completion or dismissal is persisted.
10. User can restart the tour from profile.

## Validation Targets

- Feed step renders without blocking the page.
- Route change from feed to messages works.
- Calls step still works if no chat is preselected.
- Support step still works if the profile page was left inside FAQ.
- Refresh during onboarding resumes from the last step.
