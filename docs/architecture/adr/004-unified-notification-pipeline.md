# ADR-004: Unified Notification Pipeline (Persistent-First)

**Date:** 2026-02-20
**Status:** Accepted

## Context
V1 requires social, message, and call notifications across in-app, socket, and mobile push channels.

## Options Considered

### Option 1: Socket-only notifications
**Approach:** only real-time ephemeral events.
**Gains:** simple and low latency.
**Loses:** no history, missed events for offline users.
**Fits when:** online-only app with no push expectations.

### Option 2: Persistent-first + multi-channel delivery
**Approach:** write notification record first, then deliver via socket/push.
**Gains:** reliability, unread state, channel resilience.
**Loses:** more moving parts and delivery status handling.
**Fits when:** mixed online/offline usage.

## Decision
**Chosen option:** Persistent-first + multi-channel delivery.

**Rationale:** required for communication-first product where missing call/message/social events is costly.

## Consequences
### Enables
- Unified notification inbox.
- Replay and read-state tracking.
- Better offline behavior.

### Constrains
- Requires idempotency and duplication controls.
- Delivery monitoring becomes necessary.

### Assumes
- Existing socket/FCM integrations remain stable.

## Reversal Cost
**How hard to change:** Moderate.

**What reversal requires:** redesign notification data model and channel adapters.
