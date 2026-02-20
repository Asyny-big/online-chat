# GovChat V1 Frontend Restructure Plan

Status date: 2026-02-20
Scope: UI/frontend restructure only, no backend call-pipeline breakage.

## 0. Current Frontend Diagnosis

### Structural issues observed
1. Routing is hash-based and hand-rolled in `frontend/src/App.jsx` with route branching in one file.
2. `ChatPage` is overloaded (routing-adjacent state + socket + calls + messages + push handling in one component).
3. `HrumToastProvider` is local to chat route only, while `useHrumToast` is used in profile subpages too.
4. App layout is inconsistent by route (messages 2-column, social 3-column) but controlled ad-hoc in `App.jsx`.
5. Several pages/components keep large inline styles and mixed concerns (UI + side effects + business rules).
6. Right panel uses static mock data and is not connected to domain data.

### Concrete provider bug
- `useHrumToast` consumer in profile: `frontend/src/pages/profile/TasksPanel.jsx:36`
- `useHrumToast` consumer in profile: `frontend/src/pages/profile/ShopPanel.jsx:29`
- provider exists only in chat wrapper: `frontend/src/pages/ChatPage.jsx:844`
- profile page has no toast provider boundary: `frontend/src/pages/ProfilePage.jsx:66`

### Call-critical coupling
- Socket connection and call lifecycle are currently owned by `frontend/src/pages/ChatPage.jsx`.
- 1:1 call signaling in `frontend/src/components/CallModal.jsx`.
- Group call flow in `frontend/src/components/GroupCallModalLiveKit.jsx`.

## 1. New Information Architecture (Communication-First)

Primary navigation (top-level):
1. Messages
2. Calls
3. Feed
4. Notifications
5. Profile

Secondary navigation:
- Search/Discover (inside Feed and Messages contexts, not primary identity tab)
- Admin (hidden route)

Route model (V1):
- `/messages`
- `/messages/:chatId`
- `/calls`
- `/feed`
- `/notifications`
- `/profile` (self)
- `/profile/:userId` (public profile view, phase 2)
- `/admin`

IA principles:
1. Default landing for authenticated users: `Messages` (communication-first).
2. Feed is contextual social continuation, not primary home algorithmic destination.
3. Calls are first-class top-level domain, while still launchable from chat thread.
4. Notifications aggregate social + message + call signals in one inbox.

## 2. App Shell Model

### Shell composition
- `RootAppShell`
  - `TopBar` (context actions, search entry, presence)
  - `PrimaryNav` (desktop left rail / mobile bottom nav)
  - `RouteOutlet`
  - `GlobalOverlayHost` (toasts, call modals, system dialogs)

### Layout behavior
1. Desktop:
- Messages: split layout (`InboxPane` + `ThreadPane`), optional right contextual pane.
- Other routes: centered content with optional right rail widgets.

2. Tablet:
- Messages collapses to master/detail transitions.

3. Mobile:
- Bottom navigation with stacked screens.
- Global overlays (incoming call, toast) remain shell-level.

### Shell responsibilities
- Route composition only.
- Global providers mounting.
- Global overlays and non-domain UI chrome.
- No domain business logic.

## 3. Provider Hierarchy (with `useHrumToast` fix)

Target hierarchy (top -> bottom):
1. `AppErrorBoundary`
2. `AuthSessionProvider`
3. `ApiClientProvider`
4. `PushNotificationsProvider`
5. `SocketProvider`
6. `CallSessionProvider`
7. `HrumToastProvider`  <- global placement fix
8. `ModalHostProvider`
9. `AppRouterProvider`
10. Route-level domain providers (example: `EconomyStoreProvider` only for profile/economy scope)

Fix rationale:
- `HrumToastProvider` must be above both chat and profile trees to satisfy all `useHrumToast` consumers.
- Keep `EconomyStoreProvider` route-scoped (profile domain), not app-global.

Provider ownership rules:
1. Global cross-domain state in shell providers only.
2. Domain-specific state in route/domain providers.
3. Business side effects (socket events, push actions) in providers/services, not presentational components.

## 4. Domain-Based Folder Structure

Target `frontend/src` structure:

```text
src/
  app/
    bootstrap/
      index.jsx
    router/
      routes.jsx
      guards.jsx
    shell/
      RootAppShell.jsx
      TopBar.jsx
      PrimaryNav.jsx
      MobileNav.jsx
    providers/
      AuthSessionProvider.jsx
      ApiClientProvider.jsx
      SocketProvider.jsx
      CallSessionProvider.jsx
      HrumToastProvider.jsx
      PushNotificationsProvider.jsx
      ModalHostProvider.jsx
    styles/
      tokens.css
      globals.css

  domains/
    feed/
      pages/FeedPage.jsx
      components/
      api/
      hooks/
      model/
    messages/
      pages/MessagesPage.jsx
      components/
      api/
      hooks/
      model/
    calls/
      pages/CallsPage.jsx
      components/
      api/
      hooks/
      model/
      adapters/
        LegacyCallModalAdapter.jsx
        LegacyGroupCallAdapter.jsx
    profile/
      pages/ProfilePage.jsx
      components/
      api/
      hooks/
      model/
    notifications/
      pages/NotificationsPage.jsx
      components/
      api/
      hooks/
      model/

  shared/
    ui/
    lib/
    hooks/
    api/
    config/
    types/

  legacy/
    pages/
    components/
```

Migration rule:
- Existing big components move first to `legacy/` and are wrapped via adapters.
- New domain modules are introduced incrementally without immediate full rewrite.

## 5. Phased Refactor Plan (No Calls Breakage)

## Phase 0: Baseline and Contracts Freeze
1. Freeze call contracts (socket events and payloads):
- `call:*`, `group-call:*`, `chat:join`
- ICE/TURN endpoints (`/webrtc/ice`, `/webrtc/config`)
2. Add call smoke checklist (manual + scripted where possible):
- 1:1 incoming/outgoing call
- group call start/join/leave
- call while route changes
- attachment send in active chat

Gate to exit:
- Baseline tests pass on current branch.

## Phase 1: Introduce New App Shell + Global Providers
1. Create `app/router` and `app/shell`.
2. Mount existing pages through adapter routes (no deep rewrite yet).
3. Move `HrumToastProvider` to shell-global provider tree.

Gate to exit:
- `useHrumToast` error disappears in profile and chat paths.
- Existing calls still work unchanged.

## Phase 2: Extract Socket/Call Session from ChatPage (Adapter-first)
1. Introduce `SocketProvider` with single connection ownership.
2. Introduce `CallSessionProvider` with current event semantics.
3. Keep legacy `CallModal` and `GroupCallModalLiveKit` through adapters.

Gate to exit:
- Call flows pass baseline smoke tests with identical backend events.

## Phase 3: Messages Domain Split
1. Decompose monolithic `ChatPage` into:
- `MessagesPage`
- `ChatListPane`
- `ThreadPane`
- `Composer`
2. Keep backend API/socket contracts untouched.

Gate to exit:
- Message send/read/delete + attachments stable.
- Call start from thread still works.

## Phase 4: Feed/Profile/Notifications Domain Refactor
1. Move each route to domain folder with clear data hooks and UI components.
2. Remove route-specific layout hacks from old `App.jsx`.
3. Connect right rail to real domain data (not mock).

Gate to exit:
- Unified shell works on desktop/tablet/mobile.
- No route-level runtime provider errors.

## Phase 5: Legacy Cleanup + Hardening
1. Remove duplicated legacy components after parity.
2. Consolidate style system (tokens + route CSS modules).
3. Add regression checklist for every release.

Gate to exit:
- Old `App.jsx`/hash-router path retired.
- All core journeys green: Feed, Messages, Calls, Profile, Notifications.

## 6. Non-Negotiable Call-Safety Rules During Refactor

1. Do not rename or reshape socket call events in frontend until backend migration is explicitly planned.
2. Do not change ICE/TURN fetching flow.
3. Keep call overlay mount global in shell so route changes do not drop active call UI state.
4. Introduce adapters before replacing legacy call components.
5. Every phase must pass call smoke tests before merge.
