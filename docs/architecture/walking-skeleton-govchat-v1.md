# Walking Skeleton: GovChat V1

## The Thinnest Path
A logged-in user creates a `Friends` visibility post, a friend receives it in feed with notification, opens direct chat, and starts a 1:1 video call via existing pipeline.

**Input:** authenticated user actions in feed/chat UI.
**Processing:** relationship check -> post write -> feed fanout -> notification write/delivery -> chat action -> call signaling.
**Output:** friend sees post + notification, then successful call join flow.

## Purpose
The walking skeleton validates:
- [x] Social and communication domains are connected in one journey.
- [x] Feed materialization and visibility rules work.
- [x] Notification pipeline reaches UI.
- [x] Existing call pipeline remains intact after frontend/domain restructuring.

## Components Involved

### App Shell + Feed UI
**In skeleton:** route to feed, create post form, display first page.
**Stubbed/Deferred:** advanced composer and media editing.
**Validates:** unified navigation and basic feed UX.

### Social Service
**In skeleton:** create post + friends visibility + fanout materialization.
**Stubbed/Deferred:** ranking/recommendations.
**Validates:** social graph rules and feed write path.

### Notification Service
**In skeleton:** persistent record + socket emission.
**Stubbed/Deferred:** advanced batching and preference settings.
**Validates:** event propagation from social action.

### Messaging + Calls
**In skeleton:** open DM, start and join 1:1 call using existing signaling.
**Stubbed/Deferred:** group-call edge cases.
**Validates:** communication continuity from feed context.

## What This Validates
- [x] Friends visibility restricts feed audience correctly.
- [x] Fanout write produces retrievable feed rows.
- [x] Notification appears in near-real-time.
- [x] Chat -> call transition works without WebRTC regression.

## What This Defers
- Followers feed tuning and discovery UX (phase 2).
- Group call enhancements and call quality tooling (phase 2).
- Media-heavy post flows (phase 2).
- Advanced notification preferences (phase 3).

## Build Order
1. **Fix app-shell provider tree and core routes**
   - Why first: removes runtime blockers and enables all domains.
   - Done when: profile/feed/messages/calls routes mount without provider errors.

2. **Implement relationship-aware post creation + fanout**
   - Why second: core social data path.
   - Done when: friend can fetch created post in feed endpoint.

3. **Wire notification creation and socket delivery**
   - Why third: validates cross-domain eventing.
   - Done when: friend client receives unread notification for post event.

4. **Validate DM open + 1:1 call start/join from same session**
   - Why fourth: verifies communication-first continuity and preserves call stack.
   - Done when: successful call lifecycle without signaling/TURN regressions.

## Definition of Skeleton Complete
- [ ] End-to-end demo works with two users.
- [ ] No mocked data in critical path.
- [ ] Feed, notification, chat, and call domains integrate in one journey.
- [ ] Core logs show deterministic flow across modules.

## After Skeleton
1. Add followers visibility path.
2. Add group-call entry from social context.
3. Add attachment flow from feed-to-chat conversion.
