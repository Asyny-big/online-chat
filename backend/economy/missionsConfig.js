// Missions are product configuration: stable IDs, deterministic targets/rewards.
// Progress and rewards are tracked/applied on the backend only.

const MISSIONS = [
  {
    id: 'daily_login_bonus',
    type: 'daily',
    eventKey: 'daily_login',
    title: 'Ежедневный вход',
    description: 'Заходите в GovChat каждый день',
    target: 1,
    rewardHrum: '5'
  },
  {
    id: 'daily_messages_20',
    type: 'daily',
    eventKey: 'message_sent',
    title: 'Активный чат',
    description: 'Отправьте 20 сообщений за день',
    target: 20,
    rewardHrum: '10'
  },
  {
    id: 'daily_call_1',
    type: 'daily',
    eventKey: 'call_completed',
    title: 'Созвониться',
    description: 'Завершите 1 звонок за день',
    target: 1,
    rewardHrum: '15'
  },
  {
    id: 'streak_login_7',
    type: 'streak',
    eventKey: 'daily_login',
    title: 'Серия 7 дней',
    description: 'Сделайте ежедневный вход 7 дней подряд',
    target: 7,
    rewardHrum: '50'
  },
  {
    id: 'progress_messages_100',
    type: 'progress',
    eventKey: 'message_sent',
    title: '100 сообщений',
    description: 'Отправьте 100 сообщений',
    target: 100,
    rewardHrum: '100'
  },
  {
    id: 'progress_calls_10',
    type: 'progress',
    eventKey: 'call_completed',
    title: '10 звонков',
    description: 'Завершите 10 звонков',
    target: 10,
    rewardHrum: '80'
  },
  {
    id: 'progress_invite_3',
    type: 'progress',
    eventKey: 'invite_friend',
    title: 'Пригласить друзей',
    description: 'Пригласите 3 друзей',
    target: 3,
    rewardHrum: '60'
  }
];

function getMissions() {
  return MISSIONS.slice();
}

function getMissionsByEvent(eventKey) {
  const k = String(eventKey || '').trim();
  if (!k) return [];
  return MISSIONS.filter((m) => m.eventKey === k);
}

module.exports = { getMissions, getMissionsByEvent };

