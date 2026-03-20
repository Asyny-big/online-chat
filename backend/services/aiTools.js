const AI_TOOLS = Object.freeze({
  create_group: {
    label: 'создание группы',
    description: 'Create a new group chat for the current user. Optional participants may be passed as userIds or phone numbers.',
    progressText: 'Создаю группу...',
    risk: 'safe',
    requiresConfirmation: false
  },
  add_user: {
    label: 'добавление участника',
    description: 'Add a user to a group chat by userId, phone number or identifier. If it follows create_group, chatId may be omitted.',
    progressText: 'Добавляю участника в группу...',
    risk: 'dangerous',
    requiresConfirmation: true
  },
  get_server_status: {
    label: 'диагностика сервера',
    description: 'Legacy alias for a quick backend, MongoDB, socket and call status snapshot.',
    progressText: 'Проверяю состояние сервера...',
    risk: 'safe',
    requiresConfirmation: false
  },
  system_diagnostics: {
    label: 'системная диагностика',
    description: 'Collect CPU, memory, event loop, MongoDB and socket diagnostics.',
    progressText: 'Собираю системную диагностику...',
    risk: 'safe',
    requiresConfirmation: false
  },
  analyze_slow_requests: {
    label: 'анализ медленных запросов',
    description: 'Analyze slow HTTP/API requests and recent backend errors.',
    progressText: 'Проверяю медленные запросы и ошибки...',
    risk: 'safe',
    requiresConfirmation: false
  },
  check_realtime_health: {
    label: 'проверка realtime',
    description: 'Check realtime socket stability, reconnects and dropped events.',
    progressText: 'Проверяю realtime и сокеты...',
    risk: 'safe',
    requiresConfirmation: false
  },
  check_calls_health: {
    label: 'проверка звонков',
    description: 'Check WebRTC, TURN and SFU/LiveKit call health.',
    progressText: 'Проверяю качество звонков и медиастек...',
    risk: 'safe',
    requiresConfirmation: false
  },
  explain_issue: {
    label: 'объяснение причины',
    description: 'Explain the likely root cause using collected diagnostics and suggest actions.',
    progressText: 'Собираю вывод и рекомендации...',
    risk: 'safe',
    requiresConfirmation: false
  },
  explain_feature: {
    label: 'объяснение функции',
    description: 'Explain a GovChat feature or list real capabilities.',
    progressText: 'Подбираю нужную подсказку...',
    risk: 'safe',
    requiresConfirmation: false
  },
  suggest_fix_connection: {
    label: 'поиск причины связи',
    description: 'Analyze connection issues and suggest quick fixes with server status context.',
    progressText: 'Проверяю соединение и ищу причину...',
    risk: 'safe',
    requiresConfirmation: false
  },
  get_user_chats: {
    label: 'список чатов',
    description: 'List the current user chats in a compact form.',
    progressText: 'Смотрю ваши чаты...',
    risk: 'safe',
    requiresConfirmation: false
  },
  find_user: {
    label: 'поиск пользователя',
    description: 'Find a user by userId, phone number or identifier and return compact profile data.',
    progressText: 'Ищу пользователя...',
    risk: 'safe',
    requiresConfirmation: false
  },
  start_call: {
    label: 'запуск звонка',
    description: 'Start a real private call by userId, phone number or private chatId.',
    progressText: 'Запускаю звонок...',
    risk: 'dangerous',
    requiresConfirmation: true
  }
});

const AI_TOOL_PROGRESS_TEXT = Object.freeze(
  Object.fromEntries(
    Object.entries(AI_TOOLS).map(([name, meta]) => [name, meta.progressText])
  )
);

function getAiToolManifestText() {
  return Object.entries(AI_TOOLS)
    .map(([name, meta]) => `- ${name}: ${meta.description}`)
    .join('\n');
}

function getAiToolProgressText(action) {
  return AI_TOOL_PROGRESS_TEXT[action] || 'Выполняю действие...';
}

function getAiToolDisplayName(action) {
  return AI_TOOLS[action]?.label || String(action || '').trim() || 'действие';
}

function isDangerousAiAction(action) {
  return AI_TOOLS[action]?.risk === 'dangerous';
}

function planRequiresConfirmation(actions) {
  return (Array.isArray(actions) ? actions : []).some((step) => {
    const action = String(step?.action || '').trim();
    return action && AI_TOOLS[action]?.requiresConfirmation;
  });
}

module.exports = {
  AI_TOOLS,
  getAiToolManifestText,
  getAiToolProgressText,
  getAiToolDisplayName,
  isDangerousAiAction,
  planRequiresConfirmation
};
