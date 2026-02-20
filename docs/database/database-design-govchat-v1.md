# GovChat V1 Database Design (MongoDB + Mongoose)

Status date: 2026-02-20
Scope: modular monolith, communication-first hybrid, V1 without ML ranking, scale up to ~100k users.

## 1. Logical Model

### 1.1 Domain ownership (modular monolith)

| Module | Collections it owns |
|---|---|
| identity | users, profiles, user_devices |
| social-graph | relationships |
| social-content | posts, comments, reactions |
| feed | feed_entries |
| messaging | chats, chat_members, messages |
| media | attachments |
| calls | calls |
| notifications | notifications |

### 1.2 Core entities and responsibilities

#### users
Account/auth entity.

Key fields:
- user_id
- phone_normalized (unique)
- password_hash
- status (online/offline/custom)
- last_seen_at
- tokens_valid_after
- created_at, updated_at

Notes:
- Keep auth-critical fields here.
- Do not overload with high-churn social presentation data.

#### profiles
Public/social profile projection.

Key fields:
- user_id (unique reference to users)
- display_name
- avatar_url
- bio/city/age
- counters: followers_count, following_count, friends_count, posts_count
- privacy_settings (V1: defaults only)
- created_at, updated_at

Notes:
- Profile can be updated without touching auth record.

#### relationships (dual graph)
Single edge collection for follow/friend/request/block.

Key fields:
- from_user_id
- to_user_id
- edge_type: follow | friend | request | block
- status: pending | accepted | rejected
- created_at, updated_at

Rules:
- `follow`: directed, accepted.
- `friend`: represented as directed accepted edges in both directions for O(1) outgoing checks.
- `request`: directed pending until accept/reject.
- `block`: directed accepted, highest priority in access checks.

#### posts
Social publication entity.

Key fields:
- author_id
- author_snapshot (display_name, avatar_url) for read-path speed
- text
- attachment_ids[]
- visibility: public | followers | friends
- stats: likes_count, comments_count
- created_at, updated_at, deleted_at(optional)

#### comments
Threaded comments for posts.

Key fields:
- post_id
- author_id
- author_snapshot
- parent_comment_id (nullable)
- text
- likes_count
- created_at, updated_at, deleted_at(optional)

#### reactions
Like/reaction on post/comment/message.

Key fields:
- target_type: post | comment | message
- target_id
- user_id
- reaction_type (V1 default: like)
- created_at

Rule:
- One reaction per (target_type, target_id, user_id).

#### feed_entries (bounded fanout-on-write)
Materialized user timeline rows.

Key fields:
- recipient_user_id
- post_id
- author_id
- score (immutable, created_at based; no ML rank)
- visibility_snapshot (public/followers/friends)
- created_at

Rules:
- On post creation, fanout inserts rows for recipient set (self + followers/friends by visibility).
- Read path does not recompute audience; it trusts materialization and block filters.

#### chats
Chat room metadata.

Key fields:
- chat_id
- chat_type: private | group
- title, avatar_url
- direct_key (for private chats only, unique sparse)
- last_message_preview (text/type/sender/time)
- last_activity_at
- created_at, updated_at

#### chat_members
Membership and per-user chat state.

Key fields:
- chat_id
- user_id
- role: admin | member
- joined_at
- muted
- last_read_message_id (or last_read_at)
- unread_count
- pinned(optional)
- last_activity_at (projection)

Notes:
- This prevents expensive unread aggregation over messages on every chat list request.

#### messages
Chat messages.

Key fields:
- chat_id
- sender_id
- sender_snapshot
- message_type: text | image | video | file | audio | system
- text
- attachment_ids[]
- system_event (optional)
- created_at, edited_at, deleted_at(optional)

Notes:
- Avoid large `readBy[]` arrays for scale; keep read watermark in `chat_members`.

#### attachments
Unified media/attachment object for posts and messages.

Key fields:
- owner_id
- storage_provider, storage_key, public_url
- mime_type, size_bytes, sha256
- media_meta (width, height, duration, thumb_url)
- scope_type: message | post | profile
- scope_id
- chat_id (nullable)
- message_id (nullable)
- post_id (nullable)
- created_at

Notes:
- One attachment model for chat + social reuse.
- Supports cleanup and ownership checks.

#### calls
Call session history and active-state persistence.

Key fields:
- chat_id
- initiator_id
- call_type: audio | video
- status: ringing | active | ended | missed | declined
- participants[]: user_id, joined_at, left_at
- started_at, ended_at
- end_reason

Notes:
- Existing WebRTC signaling pipeline remains unchanged.

#### notifications (unified pipeline, persistent-first)
One row per recipient event.

Key fields:
- user_id (recipient)
- notification_type: like | comment | friend_request | friend_accept | message | call_incoming | call_cancelled
- actor_id
- actor_snapshot
- entity_type/entity_id
- meta
- read_at (nullable)
- delivery: socket_status, push_status, delivered_at
- dedupe_key (nullable)
- created_at

Notes:
- Persistent first, then socket/push delivery attempts.
- Can safely replay undelivered notifications.

#### user_devices
Push destination registry.

Key fields:
- user_id
- device_id
- platform
- fcm_token
- app_version
- last_seen_at
- created_at, updated_at

## 2. Query Contracts (Anti-N+1 baseline)

1. Feed read:
- Query `feed_entries` by `recipient_user_id` + cursor.
- Batch fetch posts with `$in`.
- Do not call per-post access checks in loop; enforce visibility in fanout stage and block-filter in set-based query.

2. Notification list:
- Return from `notifications` directly with `actor_snapshot`; no per-row populate.

3. Chat list:
- Query `chat_members` by user and join `chats` in one aggregation or two batched queries.
- Use stored `unread_count`; avoid per-chat message aggregation.

4. Message list:
- Query `messages` by `(chat_id, created_at/_id)` cursor.
- Sender data from `sender_snapshot`; no per-message user lookup.

5. Attachments:
- Load by `attachment_ids` in one batched query when needed.

## 3. Physical Model (Indexes)

### 3.1 users

| Index | Type | Purpose |
|---|---|---|
| `{ phone_normalized: 1 }` | unique | login/registration by phone |
| `{ tokens_valid_after: 1 }` | btree | token revocation checks |
| `{ status: 1, last_seen_at: -1 }` | btree | online/offline presence reads |
| `{ created_at: -1 }` | btree | admin/order by newest |

### 3.2 profiles

| Index | Type | Purpose |
|---|---|---|
| `{ user_id: 1 }` | unique | profile by user |
| `{ display_name: 1, _id: -1 }` | btree | search/list by name |
| `{ followers_count: -1, _id: -1 }` | btree | lightweight popularity lists |

### 3.3 relationships (dual graph)

| Index | Type | Purpose |
|---|---|---|
| `{ from_user_id: 1, to_user_id: 1, edge_type: 1 }` | unique | dedupe edge pair/type |
| `{ to_user_id: 1, edge_type: 1, status: 1, created_at: -1, _id: -1 }` | btree | incoming followers/requests |
| `{ from_user_id: 1, edge_type: 1, status: 1, created_at: -1, _id: -1 }` | btree | outgoing follows/friends |
| `{ from_user_id: 1, to_user_id: 1, status: 1 }` | btree | quick pair state checks |
| `{ edge_type: 1, status: 1, to_user_id: 1 }` | btree | fanout recipient resolution |

### 3.4 posts

| Index | Type | Purpose |
|---|---|---|
| `{ author_id: 1, created_at: -1, _id: -1 }` | btree | author timeline |
| `{ visibility: 1, created_at: -1, _id: -1 }` | btree | public/followers/friends scans |
| `{ created_at: -1, _id: -1 }` | btree | global recent feed/debug |
| `{ deleted_at: 1 }` | btree/partial | soft-delete filtering |

### 3.5 comments

| Index | Type | Purpose |
|---|---|---|
| `{ post_id: 1, parent_comment_id: 1, created_at: -1, _id: -1 }` | btree | comment tree page |
| `{ post_id: 1, created_at: -1, _id: -1 }` | btree | flat comment pagination |
| `{ author_id: 1, created_at: -1, _id: -1 }` | btree | author comments |

### 3.6 reactions

| Index | Type | Purpose |
|---|---|---|
| `{ target_type: 1, target_id: 1, user_id: 1 }` | unique | one reaction per user/target |
| `{ target_type: 1, target_id: 1, created_at: -1 }` | btree | reaction listing/counting |
| `{ user_id: 1, created_at: -1 }` | btree | user activity |

### 3.7 feed_entries (fanout store)

| Index | Type | Purpose |
|---|---|---|
| `{ recipient_user_id: 1, score: -1, _id: -1 }` | btree | feed cursor pagination |
| `{ recipient_user_id: 1, post_id: 1 }` | unique | dedupe per recipient/post |
| `{ post_id: 1, recipient_user_id: 1 }` | btree | delete/rebuild by post |
| `{ author_id: 1, recipient_user_id: 1 }` | btree | author-based cleanup/block rebuild |

### 3.8 chats

| Index | Type | Purpose |
|---|---|---|
| `{ direct_key: 1 }` | unique sparse | idempotent private chat create |
| `{ last_activity_at: -1, _id: -1 }` | btree | recent chats admin/debug |
| `{ chat_type: 1, last_activity_at: -1 }` | btree | group/private filters |

### 3.9 chat_members

| Index | Type | Purpose |
|---|---|---|
| `{ chat_id: 1, user_id: 1 }` | unique | membership identity |
| `{ user_id: 1, last_activity_at: -1, chat_id: 1 }` | btree | user chat list |
| `{ chat_id: 1, role: 1, user_id: 1 }` | btree | member/admin listing |
| `{ user_id: 1, unread_count: -1 }` | btree | unread prioritization |

### 3.10 messages

| Index | Type | Purpose |
|---|---|---|
| `{ chat_id: 1, created_at: -1, _id: -1 }` | btree | chat history pagination |
| `{ chat_id: 1, _id: -1 }` | btree | ObjectId cursor fallback |
| `{ sender_id: 1, created_at: -1 }` | btree | user message history |
| `{ attachment_ids: 1 }` | multikey | message-by-attachment lookup |
| `{ deleted_at: 1 }` | btree/partial | hide soft-deleted messages |

### 3.11 attachments

| Index | Type | Purpose |
|---|---|---|
| `{ owner_id: 1, created_at: -1 }` | btree | owner media list |
| `{ sha256: 1 }` | btree | dedupe/integrity checks |
| `{ scope_type: 1, scope_id: 1, created_at: -1 }` | btree | load by entity |
| `{ chat_id: 1, created_at: -1 }` | btree | chat media gallery |
| `{ message_id: 1 }` | btree | message attachment lookup |
| `{ post_id: 1 }` | btree | post media lookup |

### 3.12 calls

| Index | Type | Purpose |
|---|---|---|
| `{ chat_id: 1, status: 1, started_at: -1 }` | btree | active call check in chat |
| `{ status: 1, started_at: -1 }` | btree | admin active calls/stale cleanup |
| `{ participants.user_id: 1, status: 1 }` | multikey | disconnect cleanup of active calls |
| `{ started_at: -1 }` | btree | call history pagination |

### 3.13 notifications

| Index | Type | Purpose |
|---|---|---|
| `{ user_id: 1, _id: -1 }` | btree | notification list cursor |
| `{ user_id: 1, read_at: 1, _id: -1 }` | btree | unread/read filtering |
| `{ user_id: 1, "delivery.push_status": 1, _id: 1 }` | btree | undelivered push replay |
| `{ user_id: 1, "delivery.socket_status": 1, _id: 1 }` | btree | undelivered socket replay |
| `{ user_id: 1, dedupe_key: 1 }` | unique partial | dedupe repeated events |
| `{ created_at: 1 }` | TTL optional | retention policy (for example 90-180 days) |

### 3.14 user_devices

| Index | Type | Purpose |
|---|---|---|
| `{ user_id: 1, device_id: 1 }` | unique | one record per device |
| `{ fcm_token: 1 }` | unique sparse | token uniqueness |
| `{ user_id: 1, last_seen_at: -1 }` | btree | active devices per user |

## 4. Scaling plan (up to ~100k users)

1. Start with single replica set (3-node recommended).
2. Keep fanout writes bounded in batches (already aligned with service behavior).
3. Promote heavy collections for sharding readiness first: `feed_entries`, `messages`, `notifications`.
4. Preferred future shard keys:
- `feed_entries`: hashed `recipient_user_id`
- `messages`: hashed `chat_id`
- `notifications`: hashed `user_id`
5. Apply retention for high-volume collections (notifications, optionally old feed entries) to cap storage growth.

## 5. N+1 prevention rules (explicit)

1. Never populate users one-by-one in feed/message/notification loops.
2. Use snapshots (`author_snapshot`, `sender_snapshot`, `actor_snapshot`) on hot read paths.
3. Keep unread counters in `chat_members` instead of counting unread messages per chat request.
4. Use set-based checks (`$in`) for visibility/block relations, not per-item checks in loop.
5. Define response DTOs with fixed projections to avoid `SELECT *`-style document inflation.

## 6. Final schema set for V1

Required collections:
- users
- profiles
- user_devices
- relationships
- posts
- comments
- reactions
- feed_entries
- chats
- chat_members
- messages
- attachments
- calls
- notifications

This set is sufficient for:
- dual social graph
- bounded fanout-on-write feed
- unified notification pipeline
- chats + calls + attachments
without introducing microservices or ML ranking.
