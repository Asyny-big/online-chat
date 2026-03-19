const AI_TOOLS = Object.freeze({
  create_group: {
    description: 'Create a new group chat for the current user.',
    progressText: 'РЎРѕР·РґР°СЋ РіСЂСѓРїРїСѓ...',
    risk: 'safe',
    requiresConfirmation: false
  },
  add_user: {
    description: 'Add a user to a group chat. If it follows create_group, chatId may be omitted.',
    progressText: 'Р”РѕР±Р°РІР»СЏСЋ СѓС‡Р°СЃС‚РЅРёРєР° РІ РіСЂСѓРїРїСѓ...',
    risk: 'dangerous',
    requiresConfirmation: true
  },
  get_server_status: {
    description: 'Check backend, MongoDB, socket and call subsystem status.',
    progressText: 'РџСЂРѕРІРµСЂСЏСЋ СЃРѕСЃС‚РѕСЏРЅРёРµ СЃРµСЂРІРµСЂР°...',
    risk: 'safe',
    requiresConfirmation: false
  },
  explain_feature: {
    description: 'Explain a GovChat feature or list real capabilities.',
    progressText: 'РџРѕРґР±РёСЂР°СЋ РЅСѓР¶РЅСѓСЋ РїРѕРґСЃРєР°Р·РєСѓ...',
    risk: 'safe',
    requiresConfirmation: false
  },
  suggest_fix_connection: {
    description: 'Analyze connection issues and suggest quick fixes with server status context.',
    progressText: 'РџСЂРѕРІРµСЂСЏСЋ СЃРѕРµРґРёРЅРµРЅРёРµ Рё РёС‰Сѓ РїСЂРёС‡РёРЅСѓ...',
    risk: 'safe',
    requiresConfirmation: false
  },
  get_user_chats: {
    description: 'List the current user chats in a compact form.',
    progressText: 'РЎРјРѕС‚СЂСЋ РІР°С€Рё С‡Р°С‚С‹...',
    risk: 'safe',
    requiresConfirmation: false
  },
  start_call: {
    description: 'Start a real private call by userId or private chatId.',
    progressText: 'Р—Р°РїСѓСЃРєР°СЋ Р·РІРѕРЅРѕРє...',
    risk: 'dangerous',
    requiresConfirmation: true
  }
});

const AI_TOOL_PROGRESS_TEXT = Object.freeze({
  create_group: 'РЎРѕР·РґР°СЋ РіСЂСѓРїРїСѓ...',
  add_user: 'Р”РѕР±Р°РІР»СЏСЋ СѓС‡Р°СЃС‚РЅРёРєР° РІ РіСЂСѓРїРїСѓ...',
  get_server_status: 'РџСЂРѕРІРµСЂСЏСЋ СЃРѕСЃС‚РѕСЏРЅРёРµ СЃРµСЂРІРµСЂР°...',
  explain_feature: 'РџРѕРґР±РёСЂР°СЋ РЅСѓР¶РЅСѓСЋ РїРѕРґСЃРєР°Р·РєСѓ...',
  suggest_fix_connection: 'РџСЂРѕРІРµСЂСЏСЋ СЃРѕРµРґРёРЅРµРЅРёРµ Рё РёС‰Сѓ РїСЂРёС‡РёРЅСѓ...',
  get_user_chats: 'РЎРјРѕС‚СЂСЋ РІР°С€Рё С‡Р°С‚С‹...',
  start_call: 'Р—Р°РїСѓСЃРєР°СЋ Р·РІРѕРЅРѕРє...'
});

function getAiToolManifestText() {
  return Object.entries(AI_TOOLS)
    .map(([name, meta]) => `- ${name}: ${meta.description}`)
    .join('\n');
}

function getAiToolProgressText(action) {
  return AI_TOOL_PROGRESS_TEXT[action] || 'Р’С‹РїРѕР»РЅСЏСЋ РґРµР№СЃС‚РІРёРµ...';
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
