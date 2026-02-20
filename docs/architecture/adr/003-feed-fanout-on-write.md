# ADR-003: Feed Strategy = Bounded Fanout-on-Write

**Date:** 2026-02-20
**Status:** Accepted

## Context
V1 forbids complex ranking and requires predictable feed reads for own/friends/follows content.

## Options Considered

### Option 1: Fanout-on-Read
**Approach:** compute feed on each read query.
**Gains:** low write amplification.
**Loses:** expensive read queries and harder pagination at scale.
**Fits when:** very low read traffic or simple follow graph.

### Option 2: Fanout-on-Write
**Approach:** pre-materialize recipient feed rows at post creation.
**Gains:** fast reads, simple cursor pagination.
**Loses:** write amplification and queue management.
**Fits when:** read latency predictability matters.

### Option 3: Hybrid dynamic strategy
**Approach:** per-author strategy switch by fanout size.
**Gains:** best-case flexibility.
**Loses:** high complexity for solo V1.
**Fits when:** mature platform with ops capacity.

## Decision
**Chosen option:** Fanout-on-Write with bounded batching.

**Rationale:** aligns with existing `Feed` model and V1 simplicity/performance priorities.

## Consequences
### Enables
- Cheap feed reads.
- Deterministic cursor ordering.

### Constrains
- Requires background job reliability.
- Large fanout users need batching safeguards.

### Assumes
- Pilot graph size remains within bounded fanout capacity.

## Reversal Cost
**How hard to change:** Moderate.

**What reversal requires:** swapping feed generation path and backfilling feed materialization approach.
