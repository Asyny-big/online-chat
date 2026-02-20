# ADR-001: Modular Monolith for GovChat V1

**Date:** 2026-02-20
**Status:** Accepted

## Context
GovChat V1 must ship in 6-8 weeks by one developer, preserve existing WebRTC/chat infrastructure, and support major UX/domain refactor.

## Options Considered

### Option 1: Modular Monolith
**Approach:** single backend deployable with explicit domain modules.
**Gains:** low ops overhead, fast iteration, simple debugging.
**Loses:** independent scaling/deployment per domain.
**Fits when:** small team, bounded timeline, existing monolithic base.

### Option 2: Microservices
**Approach:** split social/messaging/calls/notifications into separate services.
**Gains:** isolated scaling and autonomy.
**Loses:** high operational and integration complexity.
**Fits when:** multi-team org and high scale requirements.

## Decision
**Chosen option:** Modular Monolith.

**Rationale:** best fit for solo execution, low risk migration, and preservation of current realtime pipeline.

## Consequences
### Enables
- Fast end-to-end changes.
- Simpler local and production operations.

### Constrains
- Shared deployment blast radius.
- Requires strict module boundaries inside one codebase.

### Assumes
- Pilot scale can be handled with optimized queries and indexes.
- Team size remains small during V1.

## Reversal Cost
**How hard to change:** Moderate.

**What reversal requires:** extract domain APIs/events and split storage/infra contracts gradually.
