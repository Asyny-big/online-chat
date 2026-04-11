# ADR 001: Use a custom onboarding engine instead of a third-party walkthrough library

## Status

Accepted

## Context

GovChat onboarding needs to:

- travel across multiple hash-based routes,
- survive missing or delayed DOM targets,
- adapt to mobile-specific layout behavior,
- keep visual control consistent with the existing dark UI,
- avoid bringing new dependencies into a relatively small React bundle.

## Decision

Implement onboarding with internal React components and a portal-based provider.

## Consequences

### Positive

- Full control over route-aware step transitions.
- Easy fallback handling when selectors are missing.
- No third-party dependency cost.
- UI can match GovChat styling exactly.

### Negative

- Positioning and lifecycle logic are now owned by the app.
- Future advanced features like beacons or click-through step validation would require extra work.

## Rejected alternatives

- `react-joyride`
  Rejected because it would still require custom glue for route transitions and missing-target recovery.
- `shepherd.js`
  Rejected for the same reason and because it adds another visual system on top of the current UI.
