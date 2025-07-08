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
  position: "relative", 
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
  paddingBottom: 60, 
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
  marginTop: "auto", 
  background: "none",
  color: "#ff7675",
  border: "1px solid #ff7675",
  borderRadius: 8,
  padding: "8px 0",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "background 0.2s, color 0.2s",
  position: "sticky", 
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
  position: "sticky",
  bottom: 0,
  background: "rgba(40,42,44,0.98)",
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
  background: "none", 
  borderRadius: 0,    
  boxShadow: "none",  
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
  justifyContent: "center", 
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
  boxSizing: "border-box", 
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
  right: 70,  // 38
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
  bottom: 0,
  top: "auto",
  width: 280,
  minWidth: 180,
  maxWidth: 320,
  height: "auto",
  maxHeight: "70vh",
  background: "#232526",
  color: "#fff",
  borderRadius: "12px 12px 0 0",
  boxShadow: "2px 4px 18px #00c3ff44",
  padding: "16px 14px 10px 14px",
  zIndex: 100,
  fontSize: 14,
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
  margin: "10px auto 10px auto", 
  boxShadow: "0 2px 12px #0003",
};

export const profileTitle = {
  fontWeight: 700,
  fontSize: 19, 
  color: "#fff",
  margin: "0 auto 4px auto",
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
  marginBottom: 6, 
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

// Для кнопки записи используем attachBtn
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
  touchAction: "none", // предотвращаем прокрутку фона
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
  touchAction: "auto", // разрешаем прокрутку внутри меню
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
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  transition: "background 0.2s, color 0.2s",
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

export const videoCallBtn = {
  background: "none",
  border: "none",
  color: "#00c3ff",
  fontSize: 26,
  cursor: "pointer",
  marginLeft: 8,
  marginRight: 0,
  padding: 0,
  borderRadius: "50%",
  width: 38,
  height: 38,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.18s, color 0.18s",
  boxShadow: "0 2px 8px #00c3ff22",
};

export const videoCallBtnActive = {
  background: "#00c3ff",
  color: "#fff",
};

export const videoCallModal = {
  position: "fixed",
  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.75)",
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
};

export const videoCallBox = {
  background: "#232526",
  borderRadius: 16,
  boxShadow: "0 2px 16px #00c3ff33",
  padding: "18px 18px 12px 18px",
  minWidth: 280,
  maxWidth: 480,
  minHeight: 220,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
};

export const videoRow = {
  display: "flex",
  flexDirection: "row",
  gap: 10,
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  marginBottom: 10,
  position: "relative", //  для абсолютного позиционирования локального видео
};

export const video = {
  width: 180,
  height: 130,
  background: "#000",
  borderRadius: 10,
  objectFit: "cover",
};

export const videoCallControls = {
  display: "flex",
  flexDirection: "row",
  gap: 16,
  marginTop: 10,
  alignItems: "center",
  justifyContent: "center",
};

export const videoCallEndBtn = {
  background: "#ff7675",
  color: "#fff",
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

// стили для кнопок управления видеозвонком
export const videoCallControlBtn = {
  background: "#35363a",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
  fontSize: 18,
  cursor: "pointer",
  width: "auto",
  minWidth: 44,
  height: 36,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s, color 0.2s",
  boxShadow: "0 2px 8px #0002",
  marginLeft: 0,
};

export const videoCallIncomingBox = {
  background: "#232526",
  color: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 16px #00c3ff33",
  padding: "24px 18px",
  minWidth: 220,
  maxWidth: 340,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  zIndex: 2100,
  position: "relative", //  для корректного позиционирования
};

export const videoCallIncomingBtn = {
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  margin: "10px 0 0 0",
  boxShadow: "0 2px 8px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
};

export const videoCallBanner = {
  background: "linear-gradient(90deg, #00c3ff22, #3a7bd522)",
  border: "1px solid #00c3ff",
  borderRadius: 8,
  padding: "12px 16px",
  marginBottom: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#fff",
  fontSize: 15,
  fontWeight: 500,
  boxShadow: "0 2px 8px #00c3ff33",
  animation: "pulse 2s infinite",
};

export const videoCallBannerIcon = {
  fontSize: 20,
  marginRight: 8,
  animation: "bounce 1s infinite",
};

export const videoCallBannerText = {
  flex: 1,
  display: "flex",
  alignItems: "center",
};

export const videoCallBannerBtn = {
  background: "linear-gradient(90deg,#00c3ff,#3a7bd5)",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  marginLeft: 8,
  boxShadow: "0 2px 6px #00c3ff33",
  transition: "background 0.2s, box-shadow 0.2s",
};

export const videoCallBannerDeclineBtn = {
  background: "#ff7675",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "6px 12px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  marginLeft: 8,
  boxShadow: "0 2px 6px #ff767533",
  transition: "background 0.2s, box-shadow 0.2s",
};

// --- Адаптивные стили ---
export const responsive = `
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 2px 8px #00c3ff33;
    transform: scale(1);
  }
  50% {
    box-shadow: 0 2px 16px #00c3ff66;
    transform: scale(1.05);
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-3px);
  }
  60% {
    transform: translateY(-2px);
  }
}

/* НОВОЕ: Анимация для индикатора звонка */
@keyframes callPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
    box-shadow: 0 0 6px #ff4757;
  }
  50% {
    opacity: 0.7;
    transform: scale(1.3);
    box-shadow: 0 0 12px #ff4757;
  }
}

@media (max-width: 700px) {
  html, body, #root {
    height: 100vh !important;
    width: 100vw !important;
    min-height: 100vh !important;
    min-width: 100vw !important;
    max-height: 100vh !important;
    max-width: 100vw !important;
    overflow: hidden !important;
    touch-action: pan-x pan-y;
  }
  .govchat-page {
    flex-direction: column !important;
    padding: 0 !important;
    min-width: 100vw !important;
    min-height: 100vh !important;
    height: 100vh !important;
    max-height: 100vh !important;
    overflow: hidden !important;
  }
  .govchat-sidebar {
    display: none !important;
  }
  .govchat-mobile-header {
    display: flex !important;
  }
  .govchat-chat-container {
    padding-top: 56px !important;
    height: calc(100vh - 56px) !important;
    max-height: calc(100vh - 56px) !important;
    min-height: calc(100vh - 56px) !important;
    overflow: hidden !important;
  }
  .govchat-chat-box {
    max-height: calc(100vh - 180px) !important;
    min-height: 0 !important;
    overflow-y: auto !important;
  }
  /* Предотвращаем случайное открытие меню */
  .govchat-mobile-menu-overlay {
    pointer-events: auto !important;
  }
  .govchat-mobile-menu {
    pointer-events: auto !important;
  }
  /* --- Меньше окно профиля по центру на мобильном --- */
  .govchat-profile-popup {
    left: 50% !important;
    top: 50% !important;
    right: auto !important;
    bottom: auto !important;
    transform: translate(-50%, -50%) !important;
    margin: 0 !important;
    width: 92vw !important;
    max-width: 340px !important;
    min-width: 0 !important;
    height: auto !important;
    max-height: 80vh !important;
    border-radius: 14px !important;
    padding: 10px 6px 8px 6px !important;
    box-shadow: 0 2px 16px #00c3ff33 !important;
    font-size: 15px !important;
    background: #232526 !important;
    display: flex !important;
    flex-direction: column !important;
  }
  /* --- Поднять строку ввода выше на мобильном --- */
  .govchat-input-row {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 2px !important;
    width: 100vw !important;
    background: rgba(40,42,44,0.98) !important;
    z-index: 20 !important;
    margin-bottom: 0 !important;
    border-radius: 0 !important;
    padding-bottom: env(safe-area-inset-bottom, 0) !important;
    box-shadow: none !important;
    padding-left: 2vw !important;
    padding-right: 2vw !important;
  }
  .govchat-input-row button[title="Отправить"] {
    margin-left: 0vw !important;
    margin-right: 7vw !important; /* добавьте или увеличьте это значение */
  }
  .govchat-mobile-profile-actions {
    margin-top: 114px !important;
    margin-bottom: 118px !important;
    gap: 18px !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
  }
  
  .govchat-video-call-banner {
    padding: 8px 12px !important;
    font-size: 14px !important;
    flex-direction: column !important;
    gap: 8px !important;
    align-items: stretch !important;
  }
  
  .govchat-video-call-banner-text {
    text-align: center !important;
    margin-bottom: 0 !important;
  }
  
  .govchat-video-call-banner-buttons {
    display: flex !important;
    gap: 8px !important;
    justify-content: center !important;
  }
  
  .govchat-video-call-banner-btn,
  .govchat-video-call-banner-decline-btn {
    flex: 1 !important;
    min-width: 0 !important;
    font-size: 13px !important;
    padding: 6px 8px !important;
  }
  
  /* НОВОЕ: Улучшенная анимация для индикатора звонка */
  .govchat-call-indicator {
    animation: callPulse 2s infinite !important;
  }
}
`;