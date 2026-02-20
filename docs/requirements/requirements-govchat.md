# GovChat Requirements Analysis (Validated)

Status date: 2026-02-20
Current maturity: RA5 (validated)

## 1. Problem Statement

### The Problem
GovChat has strong real-time communication capabilities, but user experience is fragmented between social features and messenger flows. Core journeys are inconsistent and partially broken, so users cannot use the product as a coherent social network for everyday interaction.

**Who:** primary audience 18-30 (active Telegram/Discord users) and small communities (friends, gamers, startup groups).
**Problem:** communication, profile, and social publishing are not unified into a single reliable interaction model.
**Impact:** weak retention, low trust in product stability, unclear differentiation versus Telegram/VK/Discord.

### Current State
**Current approach:** messenger + calls + attachments are mature; social layer exists (feed/posts/comments/relationships/notifications) but is fragmented in UX and architecture.
**Why it's insufficient:** profile journey has runtime provider mismatch and app information architecture is inconsistent between domains.

### Why Now
The project already has valuable infrastructure (WebRTC calls, TURN, chat, attachments). A focused transformation now can produce a differentiated communication-first social product without rebuilding the call stack.

### Success Looks Like
- [ ] User can complete profile, build connections, consume feed, publish posts, and switch to chat/call in one coherent flow.
- [ ] Existing private/group calls and attachments remain stable with unchanged WebRTC pipeline.
- [ ] Product position is explicit: communication-first social network.

### Not Trying to Solve (V1)
- [ ] Livestream platform.
- [ ] Marketplace/e-commerce.
- [ ] Third-party mini-app ecosystem.
- [ ] ML ranking/recommendations.

## 2. Need Hierarchy

### Core Needs (Must Have)

### Need 1: Unify social and communication journey
**Why essential:** without a unified journey, product remains two disconnected apps.
**Derived from:** fragmentation and unclear product identity.
**Testable by:** user moves Feed -> Profile -> Messages -> Calls without route/context loss.
**Minimum viable:** one app shell and explicit IA for Feed, Messages, Calls, Profile, Notifications.

### Need 2: Stabilize core reliability of primary flows
**Why essential:** runtime failures block adoption.
**Derived from:** broken profile/provider flow and inconsistent frontend architecture.
**Testable by:** no blocking runtime errors in profile, feed, messaging, and call entry points.
**Minimum viable:** corrected provider tree, route guards, smoke tests for top journeys.

### Need 3: Preserve communication foundation
**Why essential:** calls and attachments are strategic differentiators.
**Derived from:** explicit non-negotiable constraints.
**Testable by:** private/group calls + attachments operate with current signaling/TURN contracts.
**Minimum viable:** zero breaking changes in WebRTC backend contract.

### Need 4: Define communication-first social model
**Why essential:** features must have one product logic.
**Derived from:** positioning target and differentiation.
**Testable by:** social graph, visibility, feed rules, and notifications are deterministic and documented.
**Minimum viable:** dual graph + bounded feed scope + clear visibility modes.

---

## Supporting Needs (Should Have)

### Need: Improve visual consistency and modern structure
**Why valuable:** directly impacts perceived quality and retention.
**Depends on:** core IA and stable flows.
**Defer trigger:** can be partially deferred only if navigation and reliability are already solved.

### Need: Add baseline operational observability
**Why valuable:** enables quick diagnosis of runtime regressions.
**Depends on:** stable API contracts and route ownership.
**Defer trigger:** can defer advanced telemetry, but basic error visibility cannot be deferred.

---

## Enhancement Needs (Could Have)

### Need: Enhance recommendation quality
**Value if included:** better feed relevance.
**Why deferrable:** V1 explicitly avoids ML ranking.

### Need: Advanced profile customization
**Value if included:** stronger identity expression.
**Why deferrable:** not required for communication-first MVP.

---

## Explicitly Deferred (Won't Have in V1)

### Need: Build circles/custom audience lists
**Why deferred:** adds privacy complexity beyond V1.
**Reconsider when:** stable growth demands granular privacy control.

### Need: Build algorithmic feed ranking
**Why deferred:** high complexity, low V1 necessity.
**Reconsider when:** baseline engagement plateaus with chronological feed.

### Need: Build microservices architecture
**Why deferred:** one developer, 6-8 weeks, high operational overhead.
**Reconsider when:** team and traffic exceed modular monolith limits.

## 3. Constraint Inventory

### Real Constraints (Facts)

| Constraint | Impact on Solution | Source/Evidence |
|---|---|---|
| Existing WebRTC pipeline must be preserved | No signaling/TURN contract breakage in V1 | User constraint |
| Private and group calls are mandatory | Calls remain first-class domain | User constraint |
| Attachments are mandatory | Message/media flows must stay intact | User constraint |
| Delivery model is solo developer | Architecture must minimize operational complexity | User constraint |
| Timeline is 6-8 weeks | Strict V1 boundary and walking skeleton required | User constraint |
| No microservices in V1 | Choose modular monolith | User constraint |
| Runtime provider mismatch exists in profile path | Provider architecture must be corrected early | Codebase evidence |

### Time Constraints
- **Available hours per week:** variable (solo capacity), assume constrained.
- **Target completion:** 6-8 weeks from planning start.
- **Hard deadline:** V1 window tied to solo execution bandwidth.

### Skill Constraints
- **Skills I have:** current fullstack stack (React/Node/Mongo/WebRTC).
- **Skills I'd need to learn:** minimal; focus is product/system restructuring.
- **Skills explicitly avoiding:** ML ranking, distributed ops complexity.

### Resource Constraints
- **Budget:** constrained/lean.
- **Infrastructure available:** existing backend/frontend, TURN, push pipeline.
- **Tools/services committed to:** current stack and deployment footprint.

### Integration Constraints
- **Must work with:** existing auth, chat, call signaling, TURN credentials, media uploads, push notifications.
- **Must NOT touch:** breakage of call media/signaling pipeline.

---

## Assumptions (To Validate)

| Assumption | If Wrong... | How to Validate | Status |
|---|---|---|---|
| Communication-first positioning will differentiate enough | Product may still look generic | Pilot feedback + activation funnel | Unvalidated |
| Dual social graph (followers + friends) is understandable in V1 | UX confusion and privacy errors | Usability testing and support logs | Unvalidated |
| Chronological/simple feed is enough for first growth | Low feed engagement | Engagement telemetry after pilot | Unvalidated |
| 6-8 weeks is sufficient for stable V1 | Scope misses deadline | Weekly milestone tracking | Unvalidated |

---

## Risks (Pre-Mortem Results)

| Failure Mode | Probability | Impact | Mitigation |
|---|---|---|---|
| Scope explosion during redesign | High | High | MoSCoW + strict V1 gate |
| Regression in calls during refactor | Medium | High | Contract protection + isolated call module |
| Social graph complexity leaks into poor UX | Medium | Medium | explicit product copy + predictable rules |
| Feed/notification load issues | Medium | Medium | indexed pagination and bounded fanout |

### Top 3 Risks to Monitor
1. Call regression risk - Watch for: drop in successful call start/join.
2. Scope creep risk - Watch for: new feature requests entering V1 without trade-off.
3. UX confusion risk - Watch for: increased back navigation and abandoned profile/feed actions.

---

## Dependencies

| Dependency | Type | Status | Blocker If Missing |
|---|---|---|---|
| Product thesis locked (communication-first hybrid) | Internal | Available | Yes |
| Social graph rules and visibility finalized | Internal | Available | Yes |
| Frontend provider/route restructuring | Internal | Pending | Yes |
| Smoke testing for core journeys | Internal | Pending | Yes |

## 4. V1 Scope Boundary (Final)

### In V1 (Must Ship)
1. Communication-first hybrid UX with unified sections: Feed, Messages, Calls, Profile, Notifications.
2. Social graph dual model: followers + friends.
3. Feed scope limited to: own posts, friends, and follows; no complex ranking.
4. Post visibility modes: Public, Followers, Friends.
5. Messaging: private and group chats with attachments.
6. Calls: private and group calls over existing WebRTC/TURN pipeline.
7. Notification baseline: social + message + call events with read/unread.

### Out of V1 (Explicit)
1. Circles/custom audience lists.
2. Algorithmic ML feed ranking.
3. Microservices split.
4. Livestreams, marketplaces, mini-app platform.

### V1 Exit Criteria
1. End-to-end core journeys pass smoke checks.
2. No blocking runtime errors in core routes.
3. Call pipeline metrics are not worse than current baseline.
4. Feed/notification pagination behaves predictably under pilot load.

## 5. RA State Diagnostic

- RA0: closed.
- RA1: closed.
- RA2: closed.
- RA3: closed.
- RA4: closed.
- RA5: reached.

## 6. RA5 Declaration

Requirements Analysis is complete and validated at RA5.
Ready handoff to system design.
