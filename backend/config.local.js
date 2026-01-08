// Локальная конфигурация без переменных окружения
// ВНИМАНИЕ: храните секреты аккуратно. Этот файл попадёт в репозиторий,
// если вы сами его закоммитите.

module.exports = {
  // Порт backend-сервера
  PORT: 5000,

  // Строка подключения к MongoDB (можно указать локальный или Atlas)
  MONGODB_URI: 'mongodb+srv://sanya210105:KBu09c0aYFWCdBaU@cluster0.fav8tsg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',

  // ОБЯЗАТЕЛЬНО: секрет для JWT токенов
  JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',

  // TURN сервер (coturn) - секрет для генерации временных credentials
  // Должен совпадать с static-auth-secret в turnserver.conf
  TURN_SECRET: '2df3e9ebdd61adb9a317d33b8fb358d5e04996a3209cc3008940944a0df9421d',

  // Разрешённые origins для CORS
  CORS_ORIGINS: [
    'http://localhost:3000',
    'https://frutin.me',
    'https://govchat.ru'
  ],

  // Настройки Firebase Cloud Messaging (любой один из способов ниже)
  FCM: {
    // 1) Вставьте объект сервис-аккаунта прямо здесь:
    // serviceAccount: {
    //   "type": "service_account",
    //   "project_id": "...",
    //   "private_key_id": "...",
    //   "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    //   "client_email": "...",
    //   "client_id": "...",
    //   "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    //   "token_uri": "https://oauth2.googleapis.com/token",
    //   "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    //   "client_x509_cert_url": "..."
    // },

    // 2) ЛИБО путь к json файлу с сервис-аккаунтом:
    // serviceAccountPath: require('path').join(__dirname, 'firebase-service-account.json'),

    // 3) ЛИБО base64 от JSON с сервис-аккаунтом:
    // serviceAccountJsonBase64: ''
  }
};
