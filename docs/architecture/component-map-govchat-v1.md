# Component Map: GovChat V1

## Overview
GovChat V1 is a communication-first social network built as a modular monolith. The system combines social publishing and relationship management with real-time messaging/calls. Existing WebRTC and attachment pipelines are preserved, while frontend and backend boundaries are clarified by domain modules.

## Components

### App Shell (Frontend)
**Responsibility:** own route model, global providers, and main layout.
**Depends on:** Auth API, domain modules.
**Provides to:** Feed, Messages, Calls, Profile, Notifications pages.
**Key decisions:** ADR-001.

### Social Domain
**Responsibility:** manage relationships, posts, comments, reactions, feed materialization.
**Depends on:** Identity, database, notification domain.
**Provides to:** Feed UI, Profile UI, Notifications.
**Key decisions:** ADR-002, ADR-003.

### Messaging Domain
**Responsibility:** private/group chats, message persistence, attachment metadata linkage.
**Depends on:** Identity, chat access policy, media domain, socket transport.
**Provides to:** Messages UI, notification domain.
**Key decisions:** ADR-001.

### Calls Domain
**Responsibility:** call lifecycle, signaling, room membership, call records.
**Depends on:** Messaging domain (chat membership), TURN config, socket transport.
**Provides to:** Calls UI, call notifications.
**Key decisions:** preserve existing pipeline (constraint-bound).

### Media/Attachment Domain
**Responsibility:** upload validation, storage path generation, media metadata.
**Depends on:** Auth, filesystem/storage.
**Provides to:** Messaging, Social posts.
**Key decisions:** ADR-001.

### Notification Domain
**Responsibility:** persistent notification creation and multi-channel delivery.
**Depends on:** Social, Messaging, Calls, socket service, FCM.
**Provides to:** Notifications UI, badge counters, push alerts.
**Key decisions:** ADR-004.

### Identity/Profile Domain
**Responsibility:** auth context, profile read/update, social identity fields.
**Depends on:** User store, auth middleware.
**Provides to:** all domains for actor identity and visibility rules.
**Key decisions:** ADR-001.

## Data Flow

```
[User Action] -> [Frontend App Shell + Domain UI]
              -> [Domain API Route]
              -> [Domain Service]
              -> [Mongo Persistence]
              -> [Socket/Push side effects]
              -> [Client UI update]
```

**Entry points:** HTTP API routes, Socket events, push open actions.
**Exit points:** UI state updates, FCM pushes, media URLs, call state events.
**Persistence:** MongoDB collections for users, relationships, posts, feed, chats, messages, calls, notifications, media.

## External Integrations

| External System | What We Need From It | What We Provide | Risk/Failure Mode |
|---|---|---|---|
| TURN server | relay credentials and reachability | short-lived credentials | NAT/corporate network failures |
| FCM | mobile push delivery | notification payloads + tokens | delayed or dropped pushes |
| Socket transport | bidirectional real-time events | event payloads | disconnect/reconnect race conditions |
| File storage (local/current) | binary storage | upload stream + metadata | storage growth and I/O bottlenecks |

## Boundaries

### Internal Boundaries
- UI domain boundaries by route domain (`feed/messages/calls/profile/notifications`).
- Backend boundaries by module service ownership.
- Notification side effects isolated from core write operations.

### External Boundaries
- User interface boundary.
- API boundary.
- File system/media boundary.
- TURN/FCM boundaries.
- Configuration boundary (`config.local.js`, secrets).

## Integration Checklist
- [x] Authentication.
- [x] Configuration.
- [x] Error handling.
- [x] Logging/observability baseline.
- [x] Deployment compatibility with existing stack.
