# Как запустить проект

1. Установите зависимости:
   ```
   npm install
   ```

2. Запустите MongoDB (если не запущен).

3. Запустите backend:
   ```
   cd backend
   node server.js
   ```

4. Запустите frontend:
   ```
   cd frontend
   npm install
   npm start
   ```

5. Откройте браузер и перейдите по адресу:
   ```
   http://localhost:3000
   ```

# Как собрать и запустить фронтенд

1. Перейдите в папку frontend:
   ```
   cd frontend
   ```

2. Установите зависимости:
   ```
   npm install
   ```

3. Соберите проект:
   ```
   npm run build
   ```

4. Для разработки запустите:
   ```
   npm start
   ```

5. Для просмотра production-сборки используйте любой статический сервер, например:
   ```
   npx serve -s build
   ```
   или откройте `build/index.html` в браузере.
