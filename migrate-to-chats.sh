#!/bin/bash
# Скрипт автоматической миграции frontend/src/App.jsx
# Заменяет channels → chats и добавляет поиск пользователей

cd "$(dirname "$0")"

echo "🔧 Начинаем миграцию App.jsx..."

# Резервная копия
cp frontend/src/App.jsx frontend/src/App.jsx.backup
echo "✅ Создана резервная копия: App.jsx.backup"

# Замены через sed (macOS/Linux) или PowerShell (Windows)
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
  # macOS/Linux
  sed -i.bak 's/\bchannels\b/chats/g' frontend/src/App.jsx
  sed -i.bak 's/\bsetChannels\b/setChats/g' frontend/src/App.jsx
  sed -i.bak 's/\bselectedChannel\b/selectedChat/g' frontend/src/App.jsx
  sed -i.bak 's/\bsetSelectedChannel\b/setSelectedChat/g' frontend/src/App.jsx
  sed -i.bak 's/channelId/chatId/g' frontend/src/App.jsx
  rm -f frontend/src/App.jsx.bak
else
  # Windows PowerShell
  echo "Используйте PowerShell команду для Windows"
fi

echo "✅ Миграция завершена!"
echo "📝 Проверьте изменения и перезапустите frontend"
