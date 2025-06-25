export const page = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "linear-gradient(120deg, #232526 0%, #414345 100%)",
  fontFamily: "'Segoe UI', 'Roboto', Arial, sans-serif",
  color: "#f5f6fa",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
};

export const sidebar = {
  width: 260,
  background: "rgba(30,32,34,0.98)",
  borderRight: "1px solid #232526",
  boxShadow: "2px 0 12px 0 rgba(0,0,0,0.12)",
  padding: "32px 18px 18px 18px",
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  position: "relative", // добавлено
};

export const sidebarTitle = {
  fontWeight: 700,
  fontSize: 22,
  marginBottom: 18,
  letterSpacing: 1,
  color: "#00c3ff",
  textShadow: "0 2px 8px #0002",
};

export const channelList = {
  flex: 1,
  overflowY: "auto",
  marginBottom: 18,
  paddingBottom: 60, // добавлено, чтобы не перекрывалось кнопкой "Выйти"
};

export const channelItem = isActive => ({
  cursor: "pointer",
  background: isActive ? "linear-gradient(90deg,#00c3ff33,#3a7bd5cc)" : "transparent",
  color: isActive ? "#fff" : "#b2bec3",
  borderRadius: 8,
  padding: "8px 12px",
  marginBottom: 6,
  fontWeight: isActive ? 600 : 400,
  boxShadow: isActive ? "0 2px 8px #00c3ff22" : "none",
  transition: "background 0.2s, color 0.2s",
  border: "none",
});

export const createBtn = {
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 0",
  marginTop: 10,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
};

export const logoutBtn = {
  marginTop: "auto", // теперь всегда внизу
  background: "none",
  color: "#ff7675",
  border: "1px solid #ff7675",
  borderRadius: 8,
  padding: "8px 0",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "background 0.2s, color 0.2s",
  position: "sticky", // закрепить
  bottom: 10,
  width: "100%",
  zIndex: 2,
  backgroundClip: "padding-box",
};

export const chatContainer = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  height: "100%",
  position: "relative",
  padding: "24px 0 8px 0",
};

export const usernameBox = {
  position: "absolute",
  top: -28,
  right: 0,
  color: "#00c3ff",
  fontWeight: "bold",
  fontSize: 17,
  padding: "4px 16px",
  background: "rgba(30,32,34,0.85)",
  borderRadius: 16,
  boxShadow: "0 2px 8px #00c3ff22",
  letterSpacing: 1,
};

export const chatTitle = {
  fontWeight: 700,
  fontSize: 20,
  marginBottom: 10,
  color: "#fff",
  textShadow: "0 2px 8px #0002",
};

export const chatBox = {
  flex: 1,
  background: "rgba(40,42,44,0.98)",
  borderRadius: 12,
  boxShadow: "0 2px 12px #0003",
  padding: "18px 18px 18px 18px",
  marginBottom: 0,
  overflowY: "auto",
  minHeight: 0,
  paddingBottom: 70, // добавлено, чтобы не перекрывалось inputRow
  /* Кастомный скроллбар */
  scrollbarWidth: "thin",
  scrollbarColor: "#00c3ff #232526",
};

export const messageRow = isMine => ({
  display: "flex",
  justifyContent: isMine ? "flex-end" : "flex-start",
  marginBottom: 10,
});

export const message = isMine => ({
  marginBottom: 0,
  padding: "7px 12px",
  borderRadius: 8,
  background: isMine ? "linear-gradient(90deg,#00c3ff99,#3a7bd599)" : "rgba(60,62,64,0.85)",
  color: "#fff",
  boxShadow: "0 1px 4px #0002",
  fontSize: 15,
  wordBreak: "break-word",
  maxWidth: "70%",
  alignSelf: isMine ? "flex-end" : "flex-start",
  textAlign: isMine ? "right" : "left",
});

export const messageSender = {
  fontWeight: 600,
  color: "#00c3ff",
  marginRight: 6,
};

export const inputRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 8,
  marginBottom: 8,
  position: "sticky", // закрепить
  bottom: 0,
  background: "rgba(40,42,44,0.98)", // совпадает с chatBox
  zIndex: 2,
  padding: "8px 0 8px 0",
};

export const input = {
  flex: 1,
  borderRadius: 8,
  border: "1px solid #3a7bd5",
  padding: "10px 14px",
  fontSize: 15,
  background: "#232526",
  color: "#fff",
  outline: "none",
  transition: "border 0.2s",
};

export const sendBtn = {
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 22px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
};

export const attachBtn = {
  background: "#fff",
  color: "#222", // черная скрепка
  border: "none",
  borderRadius: "50%",
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  marginRight: 2,
  boxShadow: "0 2px 8px #0002",
  cursor: "pointer",
  transition: "background 0.18s, box-shadow 0.18s, color 0.18s",
};
export const attachBtnHover = {
  background: "#e0e0e0",
  color: "#111",
  boxShadow: "0 4px 16px #00c3ff22",
};

export const typing = {
  color: "#b2bec3",
  fontStyle: "italic",
  fontSize: 14,
  margin: "0",
  minHeight: 18,
  background: "none", // убираем фон
  borderRadius: 0,    // убираем скругления
  boxShadow: "none",  // убираем тень
};

export const authContainer = {
  margin: "auto",
  background: "rgba(30,32,34,0.98)",
  borderRadius: 16,
  boxShadow: "0 2px 16px #00c3ff33",
  padding: "40px 32px",
  minWidth: 320,
  maxWidth: 400,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center", // добавлено для вертикального центрирования
};

export const authTitle = {
  fontWeight: 700,
  fontSize: 22,
  marginBottom: 18,
  color: "#00c3ff",
  textShadow: "0 2px 8px #0002",
};

export const authInput = {
  width: "100%",
  maxWidth: 320,
  display: "block",
  marginLeft: "auto",
  marginRight: "auto",
  borderRadius: 8,
  border: "1px solid #3a7bd5",
  padding: "10px 14px",
  fontSize: 15,
  background: "#232526",
  color: "#fff",
  outline: "none",
  marginBottom: 12,
  transition: "border 0.2s",
  boxSizing: "border-box", // чтобы padding не увеличивал ширину
};

export const authBtn = {
  width: "100%",
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 0",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 10,
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
};

export const switchBtn = {
  width: "100%",
  background: "none",
  color: "#00c3ff",
  border: "1px solid #00c3ff",
  borderRadius: 8,
  padding: "10px 0",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 0,
  transition: "background 0.2s, color 0.2s",
};

export const error = {
  color: "#ff7675",
  marginBottom: 10,
  fontWeight: 500,
  fontSize: 15,
  textAlign: "center",
};

export const profileBtnBox = {
  position: "absolute",
  right: 70, // было 38, теперь ещё левее
  bottom: 70,
  zIndex: 10,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
};

export const profileBtn = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  borderRadius: "50%",
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "box-shadow 0.2s",
};

export const profilePopup = {
  position: "fixed",
  left: 0,
  top: "35vh", // было 50vh, теперь окно начинается выше
  // bottom: 0, // убираем bottom, чтобы не растягивалось до низа
  width: 370,
  minWidth: 320,
  maxWidth: 420,
  height: "65vh", // было 50vh, теперь окно выше
  background: "#232526",
  color: "#fff",
  borderRadius: "0 18px 0 0",
  boxShadow: "2px 0 24px #00c3ff44",
  padding: "28px 32px 18px 32px", // уменьшили верхний и нижний padding
  zIndex: 100,
  fontSize: 16,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  willChange: "transform, opacity",
  transition: "transform 0.32s cubic-bezier(.4,1.4,.6,1), opacity 0.22s",
};

export const profileAvatar = {
  width: 110,
  height: 110,
  borderRadius: "50%",
  background: "#35363a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 54,
  color: "#b2bec3",
  margin: "10px auto 10px auto", // уменьшили верхний и нижний отступ
  boxShadow: "0 2px 12px #0003",
};

export const profileTitle = {
  fontWeight: 700,
  fontSize: 19, // уменьшили размер
  color: "#fff",
  margin: "0 auto 4px auto", // уменьшили нижний отступ
  textAlign: "center",
  letterSpacing: 0.5,
};

export const profileCloseBtn = {
  position: "absolute",
  top: 10,
  right: 16,
  background: "none",
  color: "#b2bec3",
  border: "none",
  borderRadius: "50%",
  width: 32,
  height: 32,
  fontSize: 22,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s, color 0.2s",
  zIndex: 101,
};

export const profileSectionTitle = {
  color: "#b2bec3",
  fontWeight: 500,
  fontSize: 15,
  marginTop: 22,
  marginBottom: 2,
  letterSpacing: 0.2,
};

export const profileField = {
  marginBottom: 6, // уменьшили отступ между полями
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

export const profileLabel = {
  color: "#b2bec3",
  fontWeight: 400,
  fontSize: 14,
  marginBottom: 0,
};

export const profileValue = {
  color: "#fff",
  fontWeight: 500,
  fontSize: 16,
  marginBottom: 0,
  wordBreak: "break-word",
};

export const profilePhone = {
  color: "#fff",
  fontWeight: 500,
  fontSize: 17,
  letterSpacing: 0.5,
  marginBottom: 0,
};

export const profileLogoutBtn = {
  marginTop: 0, // убран верхний отступ для выравнивания по горизонтали
  background: "#35363a",
  color: "#ff7675",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  width: "auto",
  transition: "background 0.2s, color 0.2s",
  boxShadow: "0 2px 8px #0002",
  marginLeft: 0,
};

export const profileInfoNote = {
  color: "#b2bec3",
  fontSize: 13,
  marginTop: 18,
  textAlign: "center",
  opacity: 0.8,
};

export const profileEditBtn = {
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 0, // убран верхний отступ для выравнивания по горизонтали
  marginBottom: 0,
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
};

export const profileInput = {
  borderRadius: 8,
  border: "1px solid #3a7bd5",
  padding: "7px 10px",
  fontSize: 15,
  background: "#232526",
  color: "#fff",
  outline: "none",
  marginLeft: 8,
  minWidth: 80,
  marginBottom: 2,
  transition: "border 0.2s",
};

export const themes = [
  {
    name: "Классика",
    pageBg: "linear-gradient(120deg, #232526 0%, #414345 100%)",
    chatBg: "rgba(40,42,44,0.98)"
  },
  {
    name: "Светлая",
    pageBg: "linear-gradient(120deg, #e0eafc 0%, #cfdef3 100%)",
    chatBg: "#fff"
  },
  {
    name: "Розовый закат",
    pageBg: "linear-gradient(120deg, #ffafbd 0%, #ffc3a0 100%)",
    chatBg: "#fff0f6"
  },
  {
    name: "Голубая волна",
    pageBg: "linear-gradient(120deg, #43cea2 0%, #185a9d 100%)",
    chatBg: "#e3f6fd"
  }
];

// Можно добавить стили для превью файлов и модального окна, если потребуется

// Для кнопки записи используем attachBtn, можно добавить отдельный стиль при необходимости
export const recordBtn = {
  ...attachBtn,
  background: "#fff",
  color: "#222",
};

export const mobileHeader = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: 56,
  background: "rgba(30,32,34,0.98)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  boxShadow: "0 2px 8px #0002",
};

export const mobileMenuBtn = {
  position: "absolute",
  left: 12,
  top: 8,
  width: 40,
  height: 40,
  background: "none",
  border: "none",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  color: "#00c3ff",
  cursor: "pointer",
  zIndex: 101,
};

export const mobileMenuOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.18)",
  zIndex: 200,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
};

export const mobileMenu = {
  background: "rgba(30,32,34,0.98)",
  width: "82vw",
  maxWidth: 340,
  minWidth: 220,
  height: "100vh",
  boxShadow: "2px 0 16px #0004",
  borderRadius: "0 18px 18px 0",
  padding: "18px 0 18px 0",
  display: "flex",
  flexDirection: "column",
  zIndex: 201,
  animation: "slideInLeft 0.22s",
};

export const mobileMenuCloseBtn = {
  position: "absolute",
  top: 12,
  right: 18,
  background: "none",
  border: "none",
  color: "#b2bec3",
  fontSize: 26,
  cursor: "pointer",
  zIndex: 202,
};

export const mobileMenuChannels = {
  flex: 1,
  overflowY: "auto",
  padding: "0 18px",
  marginBottom: 18,
};

export const mobileMenuFooter = {
  padding: "0 18px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

export const mobileMenuTitle = {
  fontWeight: 700,
  fontSize: 22,
  marginBottom: 18,
  letterSpacing: 1,
  color: "#00c3ff",
  textShadow: "0 2px 8px #0002",
  textAlign: "center",
};

export const mobileMenuBtnAction = {
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 0",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 0,
  marginTop: 0,
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
  width: "100%",
};

export const mobileMenuBtnSecondary = {
  background: "none",
  color: "#00c3ff",
  border: "1px solid #00c3ff",
  borderRadius: 8,
  padding: "10px 0",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 0,
  marginTop: 0,
  transition: "background 0.2s, color 0.2s",
  width: "100%",
};

// --- Адаптивные стили ---
export const responsive = `
@media (max-width: 700px) {
  body, #root {
    min-width: 100vw !important;
    min-height: 100vh !important;
    overflow-x: hidden !important;
  }
  .govchat-page {
    flex-direction: column !important;
    padding: 0 !important;
    min-width: 100vw !important;
    min-height: 100vh !important;
  }
  .govchat-sidebar {
    display: none !important;
  }
  .govchat-mobile-header {
    display: flex !important;
  }
`;