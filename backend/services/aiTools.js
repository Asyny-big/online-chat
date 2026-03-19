const AI_TOOLS = Object.freeze({
  create_group: {
    description: 'Create a new group chat for the current user.',
    progressText: 'Создаю группу...',
    risk: 'safe',
    requiresConfirmation: false
  },
  add_user: {
    description: 'Add a user to a group chat. If it follows create_group, chatId may be omitted.',
    progressText: 'Добавляю участника в группу...',
    risk: 'dangerous',
    requiresConfirmation: true
  },
  get_server_status: {
    description: 'Check backend, MongoDB, socket and call subsystem status.',
    progressText: 'Проверяю состояние сервера...',
    risk: 'safe',
    requiresConfirmation: false
  },
  explain_feature: {
    description: 'Explain a GovChat feature or list real capabilities.',
    progressText: 'Подбираю нужную подсказку...',
    risk: 'safe',
    requiresConfirmation: false
  },
  suggest_fix_connection: {
    description: 'Analyze connection issues and suggest quick fixes with server status context.',
    progressText: 'Проверяю соединение и ищу причину...',
    risk: 'safe',
    requiresConfirmation: false
  },
  get_user_chats: {
    description: 'List the current user chats in a compact form.',
    progressText: 'Смотрю ваши чаты...',
    risk: 'safe',
    requiresConfirmation: false
  },
  start_call: {
    description: 'Start a real private call by userId or private chatId.',
    progressText: 'Запускаю звонок...',
    risk: 'dangerous',
    requiresConfirmation: true
  }
});

const AI_TOOL_PROGRESS_TEXT = Object.freeze({
  create_group: 'Создаю группу...',
  add_user: 'Добавляю участника в группу...',
  get_server_status: 'Проверяю состояние сервера...',
  explain_feature: 'Подбираю нужную подсказку...',
  suggest_fix_connection: 'Проверяю соединение и ищу причину...',
  get_user_chats: 'Смотрю ваши чаты...',
  start_call: 'Запускаю звонок...'
});

function getAiToolManifestText() {
  return Object.entries(AI_TOOLS)
    .map(([name, meta]) => `- ${name}: ${meta.description}`)
    .join('\n');
}

function getAiToolProgressText(action) {
  return AI_TOOL_PROGRESS_TEXT[action] || 'Выполняю действие...';
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
  isDangerousAiAction,
  planRequiresConfirmation
};
