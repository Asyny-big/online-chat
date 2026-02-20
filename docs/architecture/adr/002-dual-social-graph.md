# ADR-002: Dual Social Graph (Followers + Friends)

**Date:** 2026-02-20
**Status:** Accepted

## Context
Product strategy is communication-first hybrid social. V1 needs both semi-public reach and trusted private sharing.

## Options Considered

### Option 1: Followers Only
**Approach:** one-directional follow graph.
**Gains:** simple mental model.
**Loses:** weak private-circle semantics.
**Fits when:** content-first/public network.

### Option 2: Friends Only
**Approach:** mutual friendship required for interactions.
**Gains:** strong privacy and trust.
**Loses:** limited discoverability and growth.
**Fits when:** closed-community network.

### Option 3: Dual Graph
**Approach:** followers for audience, friends for trusted/private layer.
**Gains:** balances reach and intimacy.
**Loses:** extra UX and policy complexity.
**Fits when:** hybrid communication-centric social model.

## Decision
**Chosen option:** Dual Graph.

**Rationale:** directly matches V1 positioning and visibility requirements (`Public`, `Followers`, `Friends`).

## Consequences
### Enables
- Separate pathways for discovery and trusted sharing.
- Better alignment with "post for circle" concept.

### Constrains
- Requires explicit rule clarity in product copy/UI.
- More complex policy checks than single-graph models.

### Assumes
- Users can understand the distinction with minimal onboarding.

## Reversal Cost
**How hard to change:** Hard.

**What reversal requires:** migration of relationship semantics, visibility rules, and feed audience logic.
