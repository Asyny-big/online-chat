# GovChat V1 System Design (Communication-First Hybrid)

Status date: 2026-02-20
Design maturity: SD6 (validated for implementation start)
Input requirements: `docs/requirements/requirements-govchat.md`

## 1. Design Context Brief

### Requirements Summary
GovChat V1 is a communication-first social network for users 18-30 and micro-communities. The product must unify social and communication flows while preserving existing private/group calls, attachments, and WebRTC pipeline. Scope is constrained to a 6-8 week solo implementation using a modular monolith.

**Problem:** social and communication experiences are fragmented and unreliable.
**Core needs:** unified IA, reliability of core flows, preserved call stack, explicit social model.
**Key constraints:** no microservices, no ML feed ranking, preserve WebRTC/TURN pipeline, solo delivery.

### Quality Attributes (Prioritized)
1. **Reliability** - runtime stability in core journeys is mandatory for trust.
2. **Simplicity** - solo team and timeline require low operational overhead.
3. **Maintainability** - refactor must produce clear domain seams for future growth.
4. **Performance** - sufficient for pilot scale with predictable query/index behavior.

### Explicitly Not Optimizing For
- Hyper-scale architecture in V1.
- Fully personalized ranking engine.
- Maximal feature breadth.

## 2. SD State Diagnostic

- SD0: passed (RA5 available).
- SD1: addressed via explicit component map and data flows.
- SD2: controlled by rejecting microservices and speculative abstractions.
- SD3: addressed with integration contracts (Auth, Socket, FCM, TURN, Media).
- SD4: addressed with ADR set (`docs/architecture/adr`).
- SD5: addressed with walking skeleton (`docs/architecture/walking-skeleton-govchat-v1.md`).
- SD6: reached.

## 3. Architecture Model

### Decision
Use **modular monolith** (single deployable backend + modular frontend domains).

### Why
- Fits solo team and 6-8 week timeline.
- Preserves existing working call/messaging infrastructure.
- Allows domain separation without distributed-system overhead.

### Backend domain modules
1. `auth-identity`
2. `profile`
3. `social` (posts/comments/reactions/relationships/feed)
4. `messaging`
5. `calls` (existing WebRTC signaling and call lifecycle)
6. `media-attachments`
7. `notifications`

### Frontend domain slices
1. `app-shell` (routing, layout, providers)
2. `feed`
3. `messages`
4. `calls`
5. `profile`
6. `notifications`
7. shared `entities`/`api`/`ui`

## 4. Social Graph Model

### Decision
Use **dual graph**:
1. `Follower` relation for public/follower content.
2. `Friend` relation for private/trusted interaction.

### Behavioral rules (V1)
1. `Public` posts: visible to everyone with access to app feed scope.
2. `Followers` posts: visible to accepted followers.
3. `Friends` posts: visible only to mutual friend links.
4. Feed candidates are limited to: own posts + friends + follows.
5. Blocking overrides all visibility and interaction.

## 5. Feed Architecture

### Decision
Use **fanout-on-write (bounded)** with feed materialization collection.

### Why
- Aligns with existing `Feed` model.
- Simplifies read latency and pagination for pilot.
- Avoids ranking complexity (explicitly out of scope).

### Flow
1. Author publishes post.
2. Visibility resolver computes recipient set (friends/followers/public scope).
3. Worker writes feed items for recipients (bounded batching).
4. Feed read endpoint returns cursor-paginated timeline.

### Guardrails
- Cap fanout batch size per job.
- Retry queue for failed batches.
- Fallback: if fanout delayed, author sees own post immediately.

## 6. Notification System

### Decision
Use unified notification pipeline inside monolith with multi-channel delivery.

### Channels
1. In-app persistent notifications (`notifications` collection).
2. Real-time socket push for online users.
3. Mobile push via existing FCM integration.

### Event sources
- Social: like, comment, follow, friend request/accept.
- Messaging: new message in non-open context.
- Calls: incoming call/ring events.

### Delivery semantics
1. Create persistent notification record first.
2. Attempt socket delivery (if connected).
3. Attempt FCM delivery for registered devices.
4. Track delivery/read status.

## 7. Expensive-to-Change Decisions (ADR Summary)

1. ADR-001: Modular monolith over microservices.
2. ADR-002: Dual social graph model.
3. ADR-003: Bounded fanout-on-write feed.
4. ADR-004: Unified notification pipeline with persistent-first semantics.

Detailed ADRs: `docs/architecture/adr/001-modular-monolith.md`, `docs/architecture/adr/002-dual-social-graph.md`, `docs/architecture/adr/003-feed-fanout-on-write.md`, `docs/architecture/adr/004-unified-notification-pipeline.md`

## 8. Implementation Start Point

Walking skeleton definition: `docs/architecture/walking-skeleton-govchat-v1.md`
Component map: `docs/architecture/component-map-govchat-v1.md`
