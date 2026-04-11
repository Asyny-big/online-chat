export const GOVCHAT_ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в GovChat',
    description: 'Покажем ленту, общение и помощь за минуту.',
    route: '#/',
    placement: 'center',
    spotlightPadding: 0
  },
  {
    id: 'feed',
    title: 'Лента постов',
    description: 'Здесь появляются посты и обновления вашей ленты.',
    route: '#/',
    selector: '[data-onboarding-id="feed-list"]',
    placement: 'right'
  },
  {
    id: 'like',
    title: 'Лайки',
    description: 'Нажмите, чтобы быстро поддержать автора поста.',
    missingDescription: 'Кнопка лайка появится, когда в ленте будет хотя бы один пост.',
    route: '#/',
    selector: '[data-onboarding-id="post-like-button"]',
    placement: 'bottom'
  },
  {
    id: 'comment',
    title: 'Комментарии',
    description: 'Здесь можно отвечать и продолжать обсуждение.',
    missingDescription: 'Кнопка комментариев появится вместе с первым постом в ленте.',
    route: '#/',
    selector: '[data-onboarding-id="post-comment-button"]',
    placement: 'bottom'
  },
  {
    id: 'composer',
    title: 'Создание поста',
    description: 'Пишите текст, добавляйте медиа и публикуйте пост отсюда.',
    route: '#/',
    selector: '[data-onboarding-id="post-composer"]',
    placement: 'bottom'
  },
  {
    id: 'chats',
    title: 'Чаты',
    description: 'Все диалоги и быстрый старт нового чата находятся здесь.',
    route: '#/messages',
    selector: '[data-onboarding-id="chat-sidebar"]',
    placement: 'right'
  },
  {
    id: 'calls',
    title: 'Звонки',
    description: 'В открытом чате доступны аудио- и видеозвонки прямо в приложении.',
    missingDescription: 'Кнопки звонка появятся, когда у вас будет открыт обычный или групповой чат.',
    route: '#/messages',
    selector: '[data-onboarding-id="chat-call-actions"]',
    placement: 'bottom'
  },
  {
    id: 'support',
    title: 'Поддержка',
    description: 'Нужна помощь? Откройте FAQ или сразу напишите в поддержку.',
    route: '#/profile',
    selector: '[data-onboarding-id="profile-support-button"]',
    placement: 'left'
  }
];

export const GOVCHAT_ONBOARDING_VERSION = 1;
