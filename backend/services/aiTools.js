const AI_TOOLS = Object.freeze({
  create_group: {
    description: 'Create a new group chat for the current user.',
    progressText: 'Создаю группу...'
  },
  get_server_status: {
    description: 'Check backend, MongoDB, socket and call subsystem status.',
    progressText: 'Проверяю состояние сервера...'
  },
  explain_feature: {
    description: 'Explain a GovChat feature or list real capabilities.',
    progressText: 'Подбираю нужную подсказку...'
  },
  suggest_fix_connection: {
    description: 'Analyze connection issues and suggest quick fixes with server status context.',
    progressText: 'Проверяю соединение и ищу причину...'
  },
  get_user_chats: {
    description: 'List the current user chats in a compact form.',
    progressText: 'Смотрю ваши чаты...'
  },
  start_call: {
    description: 'Prepare a private call flow with another user if possible.',
    progressText: 'Проверяю возможность звонка...'
  }
});

function getAiToolManifestText() {
  return Object.entries(AI_TOOLS)
    .map(([name, meta]) => `- ${name}: ${meta.description}`)
    .join('\n');
}

function getAiToolProgressText(action) {
  return AI_TOOLS[action]?.progressText || 'Выполняю действие...';
}

module.exports = {
  AI_TOOLS,
  getAiToolManifestText,
  getAiToolProgressText
};
