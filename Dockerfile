# Используем официальный Node.js образ
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для backend
COPY backend/package*.json ./backend/

# Копируем package.json и package-lock.json для frontend
COPY frontend/package*.json ./frontend/

# Устанавливаем зависимости backend
RUN cd backend && npm install

# Устанавливаем зависимости frontend
RUN cd frontend && npm install

# Копируем исходники backend и frontend
COPY backend ./backend
COPY frontend ./frontend

# Собираем фронтенд
RUN cd frontend && npm run build

# Копируем build фронтенда в backend/public (если нужно)
RUN mkdir -p backend/public && cp -r frontend/build/* backend/public/

# Открываем порт
EXPOSE 5000

# Запуск backend сервера
CMD ["node", "backend/server.js"]
