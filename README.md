# GovChat

> **GovChat** — коммуникационная платформа с real-time сообщениями, звонками, социальной лентой, AI-помощником, push-уведомлениями, Android-приложением и собственной серверной архитектурой.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?logo=socket.io&logoColor=white)
![Android](https://img.shields.io/badge/Android-Kotlin%20%2B%20Compose-3DDC84?logo=android&logoColor=white)
![LiveKit](https://img.shields.io/badge/LiveKit-SFU%20Calls-FF6F00)

## Обзор

GovChat объединяет мессенджер, мини-социальную сеть и мобильное приложение в одном репозитории.

- **Real-time мессенджер** — личные и групповые чаты, typing-индикаторы, статусы, read receipts.
- **Медиа-платформа** — файлы, изображения, видео, голосовые сообщения, видеозаметки и корректная отдача media ranges.
- **Звонки** — private/group calls, WebRTC, LiveKit SFU, TURN credentials и мобильный call UX.
- **Социальная лента** — посты, комментарии, реакции, друзья, подписки и уведомления.
- **AI-помощник** — системный чат поддержки с OpenRouter, памятью, очередью и серверными действиями.
- **Экономика HRUM** — кошелек, транзакции, магазин, задания, daily rewards и admin-операции.
- **Android-приложение** — Kotlin, Jetpack Compose, FCM, foreground services, автообновления APK и tunnel network layer.

Production-домен, на который ориентированы текущие конфиги:

```text
https://govchat.ru
```

## Возможности

### Мессенджер

- **Личные чаты** — создание диалогов по пользователю, номеру телефона или идентификатору.
- **Групповые чаты** — участники, роли, добавление пользователей и групповые события.
- **Socket.IO доставка** — `message:send`, `message:new`, `typing:update`, `messages:read`.
- **Редактирование и удаление** — ревизии сообщений и защита от конфликтов.
- **Непрочитанные сообщения** — счетчики по чатам.
- **Онлайн-статусы** — активность определяется через socket-сессии.

### Файлы и медиа

- **Загрузка вложений** через `/api/upload`.
- **Лимит файлов** до 100 МБ.
- **MIME detection** для популярных форматов.
- **Range requests** для аудио и видео.
- **Inline preview** для медиа.
- **Unicode filenames** при скачивании.

### Звонки

- **Private calls** — аудио/видео звонки в личных чатах.
- **Group calls** — групповые вызовы с событиями входа, выхода и завершения.
- **LiveKit SFU** — защищенная выдача room token через backend.
- **WebRTC fallback** — ICE/STUN/TURN конфигурация.
- **TURN security** — временные credentials генерируются только на backend.
- **Android UX** — входящие вызовы, foreground service, уведомления и Picture-in-Picture.

### Социальная часть

- **Feed** — персональная лента с fallback на публичные посты.
- **Posts** — создание, редактирование, удаление и профильные посты.
- **Comments** — обсуждения под публикациями.
- **Reactions** — toggle-реакции.
- **Friends/followers** — заявки в друзья, подписки и отписки.
- **Notifications** — социальные уведомления и read state.

### AI support

- **Системный чат поддержки** создается автоматически при регистрации и входе.
- **OpenRouter integration** с основной и fallback-моделью.
- **Очередь ответов** защищает от конфликтов параллельной генерации.
- **AI memory** хранит контекст, предпочтения и недавние события.
- **AI actions/tools** позволяют выполнять поддерживаемые действия на сервере.
- **Runtime diagnostics** помогают анализировать ошибки и медленные запросы.

### Экономика HRUM

- **Wallet** — баланс пользователя.
- **Transactions** — история операций.
- **Daily login rewards** — ежедневные награды с cooldown.
- **Tasks** — задания и получение наград.
- **Shop** — покупка предметов за HRUM.
- **Admin economy** — выдача и списание HRUM с idempotency-защитой.

### Уведомления и локация

- **FCM push** — регистрация device token для Android/iOS/web.
- **Message/call notifications** — push участникам чатов.
- **Location requests** — запрос координат у собеседника.
- **Permissions** — управление доступом к геолокации.
- **TTL/rate limits** — защита от спама запросами локации.

## Архитектура проекта

```text
online-chat/
├── backend/                 # Node.js + Express + Socket.IO API
│   ├── routes/              # REST endpoints
│   ├── models/              # Mongoose-модели
│   ├── services/            # AI, notifications, calls, location, diagnostics
│   ├── social/              # Лента, отношения, фоновые jobs
│   ├── economy/             # HRUM wallet, rewards, shop, tasks
│   ├── middleware/          # Auth, admin-only, chat access
│   ├── socket/              # Socket.IO gateway
│   └── downloads/           # Android release manifest и APK
├── frontend/                # React web-клиент
│   ├── src/app/             # App shell и providers
│   ├── src/components/      # Чат, звонки, посты, модалки, панели
│   ├── src/domains/         # Feed, messages, profile, notifications, search, HRUM
│   ├── src/onboarding/      # Route-aware onboarding engine
│   ├── src/mobile/          # Push integration
│   └── src/shared/          # Общие hooks, UI и утилиты
├── android-app/             # Нативное Android-приложение Kotlin/Compose
│   └── app/src/main/java/ru/govchat/app/
│       ├── core/            # API, calls, media, notifications, storage, update
│       ├── tunnel/          # VPN/tunnel network layer
│       ├── push/            # Firebase Messaging
│       ├── service/         # Foreground services
│       └── ui/              # Compose screens, navigation, theme
├── docs/architecture/       # Архитектурные заметки
├── tools/                   # Вспомогательные инструменты
├── Dockerfile               # Контейнерная сборка backend + frontend
└── capacitor.config.ts      # Конфиг web-wrapper/Capacitor
```

## Технологический стек

### Frontend

| Технология | Назначение |
| --- | --- |
| React 18 | Web UI |
| CRACO | Webpack alias `@` |
| Axios / Fetch | HTTP-запросы |
| Socket.IO Client | Real-time события |
| LiveKit Client | SFU-звонки в web |
| Capacitor packages | Mobile/web bridge для платформенных API |

### Backend

| Технология | Назначение |
| --- | --- |
| Node.js + Express | REST API |
| Socket.IO | Real-time gateway |
| MongoDB + Mongoose | Основная база данных |
| JWT | Авторизация |
| bcryptjs | Хеширование паролей |
| Multer | Загрузка файлов |
| Firebase Admin | Push-уведомления |
| LiveKit Server SDK | Выдача SFU-токенов |
| BullMQ + Redis | Фоновые social jobs |
| OpenRouter API | AI-помощник |

### Android

| Технология | Назначение |
| --- | --- |
| Kotlin | Основной язык Android-приложения |
| Jetpack Compose | UI |
| Navigation Compose | Навигация |
| Retrofit + OkHttp | API-клиент |
| Moshi | JSON |
| Socket.IO Java Client | Real-time |
| Firebase Messaging | Push |
| LiveKit Android / WebRTC | Звонки |
| CameraX / Media3 | Камера и медиа |
| DataStore / Room | Локальное состояние |
| WorkManager | Фоновые задачи |
| libbox/sing-box layer | Сетевой tunnel для Android |

## Быстрый старт

### Требования

- **Node.js 18+**
- **npm**
- **MongoDB** локально или MongoDB Atlas
- **Redis** опционально, нужен для social worker/BullMQ
- **JDK 17+ / Android Studio** для Android-сборки
- **LiveKit credentials** для SFU-звонков
- **Firebase service account** для push-уведомлений
- **OpenRouter API key** для AI-помощника

### Backend

```bash
cd backend
npm install
npm start
```

Backend поднимает API на:

```text
http://localhost:5000/api
```

Локальный конфиг обычно хранится в `backend/config.local.js`. Минимальный набор:

```js
module.exports = {
  PORT: 5000,
  MONGODB_URI: 'mongodb://127.0.0.1:27017/govchat',
  JWT_SECRET: 'replace-with-strong-secret',
  TURN_SECRET: 'replace-with-turn-secret',
  FCM: {
    serviceAccountPath: './firebase-service-account.json'
  }
};
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Production-сборка:

```bash
npm run build
npm start
```

Web-клиент использует:

- **в браузере:** относительный путь `/api`
- **в нативной среде:** `NATIVE_SERVER_BASE` из `frontend/src/config.js`

### AI и внешние сервисы

Пример переменных есть в `backend/.env.example`.

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=stepfun/step-3.5-flash:free
OPENROUTER_FALLBACK_MODEL=openrouter/free
OPENROUTER_HTTP_REFERER=https://your-app.example
OPENROUTER_APP_TITLE=GovChat

LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

Опционально для очередей:

```env
REDIS_URL=redis://127.0.0.1:6379
SOCIAL_QUEUE_NAME=social_background
SOCIAL_WORKER_CONCURRENCY=8
```

### Social worker

```bash
cd backend
npm run social:migrate
npm run social:worker
```

## REST API карта

Все защищенные endpoints используют JWT:

```http
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Назначение |
| --- | --- | --- |
| POST | `/api/auth/register` | Регистрация по телефону, имени и паролю |
| POST | `/api/auth/login` | Вход и выдача JWT |

### Current user

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/me` | Профиль текущего пользователя |
| PATCH | `/api/me` | Обновление имени, username и темы |
| POST | `/api/me/change-password` | Смена пароля |
| POST | `/api/me/logout-all` | Инвалидация токенов |
| POST | `/api/me/device-token` | Регистрация FCM token |

### Chats and messages

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/chats` | Список чатов пользователя |
| GET | `/api/chats/:chatId` | Получение чата |
| POST | `/api/chats/private` | Создание/получение личного чата |
| POST | `/api/chats/group` | Создание группового чата |
| GET | `/api/messages/:chatId` | История сообщений |
| PATCH | `/api/messages/:id` | Редактирование сообщения |
| DELETE | `/api/messages/:id` | Удаление сообщения |
| POST | `/api/upload` | Загрузка файла |
| GET | `/api/download/:filename` | Защищенное скачивание |

### Calls

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/webrtc/ice` | ICE/STUN/TURN конфигурация |
| GET | `/api/webrtc/config` | WebRTC config |
| GET | `/api/livekit/token` | LiveKit room token |

### Social

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/social/feed` | Лента |
| POST | `/api/social/posts` | Создание поста |
| PATCH | `/api/social/posts/:postId` | Редактирование поста |
| DELETE | `/api/social/posts/:postId` | Удаление поста |
| GET | `/api/social/posts/profile/:userId` | Посты профиля |
| POST | `/api/social/comments` | Комментарий |
| GET | `/api/social/comments/post/:postId` | Комментарии поста |
| POST | `/api/social/reactions/toggle` | Реакция |
| GET | `/api/social/notifications` | Уведомления |
| PATCH | `/api/social/notifications/read-all` | Прочитать все |
| GET | `/api/social/profile/:userId` | Social profile |

### Relationships

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/social/relationships/search` | Поиск пользователей |
| POST | `/api/social/relationships/friend-request` | Заявка в друзья |
| POST | `/api/social/relationships/friend-request/:fromUserId/accept` | Принять заявку |
| POST | `/api/social/relationships/friend-request/:fromUserId/reject` | Отклонить заявку |
| GET | `/api/social/relationships/friends` | Список друзей |
| POST | `/api/social/relationships/follow/:toUserId` | Подписаться |
| DELETE | `/api/social/relationships/follow/:toUserId` | Отписаться |

### Economy

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/economy/wallet` | Баланс HRUM |
| GET | `/api/economy/transactions` | История транзакций |
| POST | `/api/economy/earn/daily-login` | Ежедневная награда |
| GET | `/api/economy/shop/items` | Товары магазина |
| POST | `/api/economy/shop/buy` | Покупка товара |
| GET | `/api/economy/tasks` | Список заданий |
| POST | `/api/economy/tasks/claim` | Получить награду |

### Location

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/location/permissions/:targetUserId` | Проверить разрешение |
| PUT | `/api/location/permissions/:allowedUserId` | Изменить разрешение |
| POST | `/api/location/requests` | Запросить геолокацию |
| POST | `/api/location/requests/:requestId/respond` | Ответить координатами |
| POST | `/api/location/requests/:requestId/fail` | Сообщить об ошибке |

### Devices and updates

| Method | Endpoint | Назначение |
| --- | --- | --- |
| POST | `/api/devices/register` | Зарегистрировать push token |
| POST | `/api/devices/unregister` | Удалить push token |
| GET | `/api/app/android-update` | Manifest актуальной Android-версии |
| GET | `/api/app/android-apk/latest` | Скачать последний APK |
| GET | `/api/app/android-apk/:filename` | Скачать конкретный APK |

### Admin

| Method | Endpoint | Назначение |
| --- | --- | --- |
| GET | `/api/admin/overview` | Online users, calls, server stats |
| POST | `/api/admin/cleanup-calls` | Очистка зависших звонков |
| POST | `/api/admin/economy/grant` | Выдать HRUM |
| POST | `/api/admin/economy/revoke` | Списать HRUM |

## Socket.IO события

Socket.IO подключение требует JWT.

### Messages

| Event | Направление | Назначение |
| --- | --- | --- |
| `message:send` | client → server | Отправить сообщение |
| `message:new` | server → client | Новое сообщение |
| `new_message` | server → client | Legacy-событие нового сообщения |
| `typing:start` | client → server | Пользователь печатает |
| `typing:stop` | client → server | Пользователь перестал печатать |
| `typing:update` | server → client | Обновление typing-индикатора |
| `messages:read` | client → server | Сообщения прочитаны |

### Calls

| Event | Направление | Назначение |
| --- | --- | --- |
| `call:start` | client → server | Начать private call |
| `call:incoming` | server → client | Входящий звонок |
| `call:participant_left` | server → client | Участник вышел |
| `group-call:start` | client → server | Начать групповой звонок |
| `group-call:incoming` | server → client | Входящий групповой звонок |
| `group-call:started` | server → client | Групповой звонок начат |
| `group-call:join` | client → server | Присоединиться |
| `group-call:participant-joined` | server → client | Участник присоединился |
| `group-call:participant-left` | server → client | Участник вышел |
| `group-call:updated` | server → client | Обновление звонка |
| `group-call:ended` | server → client | Звонок завершен |
| `group-call:signal` | both | WebRTC signaling |
| `group-call:sfu-stream` | both | Mapping LiveKit/SFU stream |

### Notifications and location

| Event | Направление | Назначение |
| --- | --- | --- |
| `notification:new` | server → client | Новое уведомление |
| `location:response` | client → server | Ответ на запрос локации |
| `location:response:ack` | server → client | Подтверждение обработки |

## Android-сборка

Android-приложение находится в:

```text
android-app/
```

Сборка release APK:

```powershell
cd android-app
.\gradlew :app:assembleRelease
```

Результат:

```text
android-app/app/build/outputs/apk/
```

Текущая Android-конфигурация:

- **applicationId:** `ru.govchat.app`
- **namespace:** `ru.govchat.app`
- **minSdk:** 26
- **targetSdk:** 36
- **API base URL:** `https://govchat.ru/api/`
- **Socket base URL:** `https://govchat.ru`
- **LiveKit URL:** `wss://govchat.ru/rtc`
- **ABI split:** `arm64-v8a`

Для FCM положите Firebase config в:

```text
android-app/app/google-services.json
```

## Android updates

Backend читает release manifest:

```text
backend/downloads/android-release.json
```

И отдает APK через:

```text
/api/app/android-update
/api/app/android-apk/latest
```

После новой сборки обновите:

- **APK-файл** в `backend/downloads/`
- **latestVersion**
- **latestVersionCode**
- **apkSha256**
- **changelog**

## Docker

В корне есть `Dockerfile`, который устанавливает зависимости backend/frontend, собирает frontend и запускает backend на порту `5000`.

```bash
docker build -t govchat .
docker run --env-file backend/.env -p 5000:5000 govchat
```

## Качество и архитектура

Frontend содержит архитектурную проверку:

```bash
cd frontend
npm run check:arch
```

Архитектурные документы лежат в:

```text
docs/architecture/
```

Сейчас там описан route-aware onboarding engine:

- **OnboardingProvider** — lifecycle, persistence, target resolution и route sync.
- **OnboardingStep** — композиция overlay/highlight/popover.
- **OnboardingOverlay** — затемнение.
- **OnboardingHighlight** — spotlight вокруг активного элемента.
- **OnboardingPopover** — текст, прогресс и controls.
- **onboardingSteps.js** — декларативные шаги onboarding.

## Безопасность

- **JWT** для API и Socket.IO.
- **bcryptjs** для паролей.
- **Auth middleware** на приватных routes.
- **Admin-only middleware** для админских endpoints.
- **Chat access checks** для сообщений и операций с чатами.
- **TURN credentials** генерируются только на backend.
- **FCM service account** не должен попадать в клиент.
- **Локальные секреты** должны оставаться в `config.local.js` или env и не коммититься.

## Production checklist

- **MongoDB URI** настроен на production-базу.
- **JWT_SECRET** заменен на сильный секрет.
- **TURN_SECRET** совпадает с TURN/coturn настройками.
- **LIVEKIT_API_KEY / LIVEKIT_API_SECRET** заданы.
- **OPENROUTER_API_KEY** задан, если AI-помощник включен.
- **Firebase service account** доступен backend.
- **Redis** запущен, если используются BullMQ social jobs.
- **HTTPS** включен для WebRTC, LiveKit, камеры, микрофона и push.
- **Android release manifest** содержит актуальный APK hash.
- **CORS/proxy** настроены под домены клиента.

## Почему проект выглядит серьезно

GovChat — это уже не учебный чат на WebSocket. Внутри есть признаки настоящего продукта:

- **Многоуровневая архитектура** с разделением backend, frontend и native Android.
- **Собственный realtime gateway** с авторизацией и доменными событиями.
- **Сложный mobile layer**: push, foreground services, PiP, media pipeline, updates, network tunnel.
- **Социальный граф**: друзья, подписки, фид, реакции и уведомления.
- **Экономика** с транзакциями, магазином, заданиями и админскими операциями.
- **AI support system** с памятью, инструментами, очередью и диагностикой.
- **Готовность к эксплуатации**: diagnostics, фоновые workers, release manifest и защищенные endpoints.

## Статус

Проект активно развивается. README описывает текущую структуру репозитория и основные возможности, найденные в кодовой базе.

---

**GovChat** — платформа для общения, которая выросла из чата в полноценную экосистему для web и Android.
