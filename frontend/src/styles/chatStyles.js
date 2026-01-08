// ===== ПРЕМИАЛЬНЫЙ ДИЗАЙН - СВЕТЛАЯ ТЕМА =====
// Современный, минималистичный, визуально лёгкий интерфейс
// Вдохновлён: Apple Messages, Telegram, Linear

// === ЦВЕТОВАЯ ПАЛИТРА ===
const colors = {
  // Основные
  white: '#ffffff',
  background: '#f8fafc',
  backgroundSecondary: '#f1f5f9',
  
  // Акцент
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryLight: 'rgba(59, 130, 246, 0.1)',
  primarySoft: 'rgba(59, 130, 246, 0.08)',
  
  // Текст
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  
  // Границы и разделители
  border: '#e2e8f0',
  borderLight: 'rgba(0, 0, 0, 0.04)',
  
  // Статусы
  success: '#10b981',
  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.1)',
  warning: '#f59e0b',
  
  // Тени
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.04)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.06)',
  shadowLg: '0 8px 24px rgba(0, 0, 0, 0.08)',
};

// === ОСНОВНОЙ КОНТЕЙНЕР ===
export const page = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: colors.background,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  color: colors.textPrimary,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
};

// === САЙДБАР ===
export const sidebar = {
  width: 320,
  background: colors.white,
  borderRight: `1px solid ${colors.border}`,
  boxShadow: '1px 0 8px rgba(0, 0, 0, 0.02)',
  padding: "0",
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  position: "relative",
};

export const sidebarTitle = {
  fontWeight: 700,
  fontSize: 20,
  letterSpacing: '-0.02em',
  color: colors.textPrimary,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

export const channelList = {
  flex: 1,
  overflowY: "auto",
  padding: '8px 12px',
  scrollbarWidth: "thin",
  scrollbarColor: `${colors.border} transparent`,
};

export const channelItem = isActive => ({
  cursor: "pointer",
  background: isActive ? colors.primaryLight : "transparent",
  color: isActive ? colors.primary : colors.textPrimary,
  borderRadius: 12,
  padding: "12px 14px",
  marginBottom: 4,
  fontWeight: isActive ? 600 : 500,
  boxShadow: isActive ? colors.shadowSm : "none",
  transition: "all 0.2s ease",
  border: "none",
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

export const createBtn = {
  background: colors.primary,
  color: colors.white,
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: `0 2px 8px ${colors.primaryLight}`,
  transition: "all 0.2s ease",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

export const logoutBtn = {
  background: "transparent",
  color: colors.danger,
  border: `1.5px solid ${colors.danger}`,
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s ease",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

// === ЧАТ КОНТЕЙНЕР ===
export const chatContainer = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  height: "100%",
  position: "relative",
  background: colors.background,
};

export const usernameBox = {
  color: colors.primary,
  fontWeight: 600,
  fontSize: 14,
  padding: "6px 14px",
  background: colors.white,
  borderRadius: 20,
  boxShadow: colors.shadowSm,
  border: `1px solid ${colors.border}`,
};

export const chatTitle = {
  fontWeight: 700,
  fontSize: 18,
  color: colors.textPrimary,
  letterSpacing: '-0.01em',
};

export const chatBox = {
  flex: 1,
  background: colors.background,
  borderRadius: 0,
  padding: "20px",
  overflowY: "auto",
  minHeight: 0,
  scrollbarWidth: "thin",
  scrollbarColor: `${colors.border} transparent`,
};

export const messageRow = isMine => ({
  display: "flex",
  justifyContent: isMine ? "flex-end" : "flex-start",
  marginBottom: 8,
});

export const message = isMine => ({
  marginBottom: 0,
  padding: "10px 16px",
  borderRadius: 18,
  borderBottomRightRadius: isMine ? 6 : 18,
  borderBottomLeftRadius: isMine ? 18 : 6,
  background: isMine ? colors.primary : colors.white,
  color: isMine ? colors.white : colors.textPrimary,
  boxShadow: colors.shadowSm,
  fontSize: 15,
  lineHeight: 1.45,
  wordBreak: "break-word",
  maxWidth: "70%",
  transition: "all 0.15s ease",
});

export const messageSender = {
  fontWeight: 600,
  color: colors.primary,
  fontSize: 13,
  marginBottom: 4,
};

// === ПОЛЕ ВВОДА ===
export const inputRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "16px 20px",
  background: colors.white,
  borderTop: `1px solid ${colors.border}`,
};

export const input = {
  flex: 1,
  borderRadius: 24,
  border: `1.5px solid ${colors.border}`,
  padding: "12px 20px",
  fontSize: 15,
  background: colors.background,
  color: colors.textPrimary,
  outline: "none",
  transition: "all 0.2s ease",
};

export const sendBtn = {
  background: colors.primary,
  color: colors.white,
  border: "none",
  borderRadius: "50%",
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: `0 2px 8px ${colors.primaryLight}`,
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const attachBtn = {
  background: colors.background,
  color: colors.textSecondary,
  border: `1.5px solid ${colors.border}`,
  borderRadius: "50%",
  width: 44,
  height: 44,
  minWidth: 44,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

export const attachBtnHover = {
  background: colors.backgroundSecondary,
  borderColor: colors.primary,
  color: colors.primary,
};

export const typing = {
  color: colors.textMuted,
  fontStyle: "normal",
  fontSize: 13,
  fontWeight: 500,
  padding: "4px 0",
};

// === АВТОРИЗАЦИЯ ===
export const authContainer = {
  margin: "auto",
  background: colors.white,
  borderRadius: 24,
  boxShadow: colors.shadowLg,
  padding: "48px 40px",
  minWidth: 320,
  maxWidth: 420,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  border: `1px solid ${colors.border}`,
};

export const authTitle = {
  fontWeight: 700,
  fontSize: 26,
  marginBottom: 8,
  color: colors.textPrimary,
  letterSpacing: '-0.02em',
};

export const authInput = {
  width: "100%",
  borderRadius: 14,
  border: `1.5px solid ${colors.border}`,
  padding: "14px 18px",
  fontSize: 15,
  background: colors.background,
  color: colors.textPrimary,
  outline: "none",
  marginBottom: 14,
  transition: "all 0.2s ease",
  boxSizing: "border-box",
};

export const authBtn = {
  width: "100%",
  background: colors.primary,
  color: colors.white,
  border: "none",
  borderRadius: 14,
  padding: "14px 20px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  marginBottom: 12,
  boxShadow: `0 2px 12px ${colors.primaryLight}`,
  transition: "all 0.2s ease",
};

export const switchBtn = {
  width: "100%",
  background: "transparent",
  color: colors.primary,
  border: `1.5px solid ${colors.primary}`,
  borderRadius: 14,
  padding: "14px 20px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

export const error = {
  color: colors.danger,
  marginBottom: 14,
  fontWeight: 500,
  fontSize: 14,
  textAlign: "center",
  padding: "12px 16px",
  background: colors.dangerLight,
  borderRadius: 12,
};

// === ПРОФИЛЬ ===
export const profileBtnBox = {
  position: "absolute",
  right: 20,
  bottom: 20,
  zIndex: 10,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

export const profileBtn = {
  background: colors.white,
  border: `1.5px solid ${colors.border}`,
  padding: 0,
  cursor: "pointer",
  borderRadius: "50%",
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: colors.shadowMd,
  transition: "all 0.2s ease",
};

export const profilePopup = {
  position: "fixed",
  left: 20,
  bottom: 20,
  width: 320,
  maxHeight: "75vh",
  background: colors.white,
  color: colors.textPrimary,
  borderRadius: 20,
  boxShadow: colors.shadowLg,
  padding: "24px 20px",
  zIndex: 100,
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${colors.border}`,
  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
};

export const profileAvatar = {
  width: 100,
  height: 100,
  borderRadius: "50%",
  background: `linear-gradient(135deg, ${colors.primary}, #8b5cf6)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 42,
  color: colors.white,
  margin: "0 auto 16px",
  boxShadow: colors.shadowMd,
};

export const profileTitle = {
  fontWeight: 700,
  fontSize: 18,
  textAlign: "center",
  color: colors.textPrimary,
  marginBottom: 4,
};

export const profileCloseBtn = {
  position: "absolute",
  top: 16,
  right: 16,
  background: colors.background,
  color: colors.textSecondary,
  border: "none",
  borderRadius: "50%",
  width: 32,
  height: 32,
  fontSize: 18,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
};

export const profileSectionTitle = {
  color: colors.textMuted,
  fontWeight: 600,
  fontSize: 11,
  marginTop: 20,
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export const profileField = {
  marginBottom: 8,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

export const profileLabel = {
  color: colors.textMuted,
  fontWeight: 500,
  fontSize: 13,
};

export const profileValue = {
  color: colors.textPrimary,
  fontWeight: 500,
  fontSize: 15,
};

export const profilePhone = {
  color: colors.textPrimary,
  fontWeight: 600,
  fontSize: 16,
  textAlign: "center",
  marginBottom: 8,
};

export const profileLogoutBtn = {
  background: colors.dangerLight,
  color: colors.danger,
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

export const profileInfoNote = {
  color: colors.textMuted,
  fontSize: 12,
  marginTop: 16,
  textAlign: "center",
};

export const profileEditBtn = {
  background: colors.primary,
  color: colors.white,
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: `0 2px 8px ${colors.primaryLight}`,
  transition: "all 0.2s ease",
};

export const profileInput = {
  borderRadius: 10,
  border: `1.5px solid ${colors.border}`,
  padding: "10px 14px",
  fontSize: 14,
  background: colors.background,
  color: colors.textPrimary,
  outline: "none",
  transition: "all 0.2s ease",
};

// === ТЕМЫ ===
export const themes = [
  {
    name: "Светлая",
    pageBg: colors.background,
    chatBg: colors.background
  },
  {
    name: "Тёплая",
    pageBg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    chatBg: "#fffbeb"
  },
  {
    name: "Прохладная",
    pageBg: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
    chatBg: "#f0f9ff"
  },
  {
    name: "Мятная",
    pageBg: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
    chatBg: "#ecfdf5"
  }
];

export const recordBtn = {
  ...attachBtn,
  background: colors.background,
  color: colors.textSecondary,
};

// === МОБИЛЬНЫЕ СТИЛИ ===
export const mobileHeader = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "calc(56px + env(safe-area-inset-top))",
  paddingTop: "env(safe-area-inset-top)",
  background: colors.white,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  boxShadow: colors.shadowSm,
  borderBottom: `1px solid ${colors.border}`,
};

export const mobileMenuBtn = {
  position: "absolute",
  left: 12,
  top: "calc(env(safe-area-inset-top) + 8px)",
  width: 40,
  height: 40,
  background: "transparent",
  border: "none",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: colors.textPrimary,
  cursor: "pointer",
};

export const mobileMenuOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0, 0, 0, 0.3)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  zIndex: 200,
};

export const mobileMenu = {
  background: colors.white,
  width: "85vw",
  maxWidth: 360,
  height: "100vh",
  boxShadow: "4px 0 24px rgba(0, 0, 0, 0.1)",
  borderRadius: "0 24px 24px 0",
  padding: "calc(24px + env(safe-area-inset-top)) 0 24px 0",
  display: "flex",
  flexDirection: "column",
};

export const mobileMenuCloseBtn = {
  position: "absolute",
  top: "calc(env(safe-area-inset-top) + 16px)",
  right: 16,
  background: colors.background,
  border: "none",
  color: colors.textSecondary,
  width: 36,
  height: 36,
  borderRadius: 10,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const mobileMenuChannels = {
  flex: 1,
  overflowY: "auto",
  padding: "0 16px",
};

export const mobileMenuFooter = {
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  borderTop: `1px solid ${colors.border}`,
};

export const mobileMenuTitle = {
  fontWeight: 700,
  fontSize: 22,
  marginBottom: 20,
  color: colors.textPrimary,
  textAlign: "center",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
};

export const mobileMenuBtnAction = {
  background: colors.primary,
  color: colors.white,
  border: "none",
  borderRadius: 12,
  padding: "14px 20px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: `0 2px 8px ${colors.primaryLight}`,
  transition: "all 0.2s ease",
  width: "100%",
};

export const mobileMenuBtnSecondary = {
  background: "transparent",
  color: colors.primary,
  border: `1.5px solid ${colors.primary}`,
  borderRadius: 12,
  padding: "14px 20px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "all 0.2s ease",
  width: "100%",
};

// === КНОПКИ ЗВОНКОВ ===
export const videoCallBtn = {
  background: "transparent",
  border: `1.5px solid ${colors.border}`,
  color: colors.textSecondary,
  cursor: "pointer",
  borderRadius: "50%",
  width: 42,
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
};

export const videoCallBtnActive = {
  background: colors.primary,
  borderColor: colors.primary,
  color: colors.white,
};

export const videoCallModal = {
  position: "fixed",
  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0, 0, 0, 0.9)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
};

export const videoCallBox = {
  background: colors.white,
  borderRadius: 24,
  boxShadow: colors.shadowLg,
  padding: "24px",
  minWidth: 320,
  maxWidth: 480,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
};

export const videoRow = {
  display: "flex",
  flexDirection: "row",
  gap: 12,
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  marginBottom: 16,
  position: "relative",
};

export const video = {
  width: 180,
  height: 135,
  background: "#000",
  borderRadius: 16,
  objectFit: "cover",
};

export const videoCallControls = {
  display: "flex",
  flexDirection: "row",
  gap: 16,
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "rgba(255, 255, 255, 0.9)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 28,
  boxShadow: colors.shadowLg,
};

export const videoCallControlBtn = {
  background: colors.background,
  color: colors.textPrimary,
  border: "none",
  borderRadius: "50%",
  width: 52,
  height: 52,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: colors.shadowSm,
  transition: "all 0.2s ease",
};

export const videoCallEndBtn = {
  background: colors.danger,
  color: colors.white,
  border: "none",
  borderRadius: "50%",
  width: 56,
  height: 56,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: `0 4px 12px rgba(239, 68, 68, 0.3)`,
  transition: "all 0.2s ease",
};

export const videoCallIncomingBox = {
  background: colors.white,
  borderRadius: 20,
  boxShadow: colors.shadowLg,
  padding: "24px 20px",
  minWidth: 240,
  maxWidth: 340,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  zIndex: 100050,
  position: "fixed",
  left: "50%",
  transform: "translateX(-50%)",
  top: "calc(env(safe-area-inset-top) + 20px)",
  border: `1px solid ${colors.border}`,
};

export const videoCallIncomingBtn = {
  background: colors.primary,
  color: colors.white,
  border: "none",
  borderRadius: 14,
  padding: "12px 24px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  margin: "12px 0 0 0",
  boxShadow: `0 2px 8px ${colors.primaryLight}`,
  transition: "all 0.2s ease",
};

export const videoCallBanner = {
  background: colors.white,
  border: `1px solid ${colors.success}`,
  borderRadius: 16,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: `0 4px 20px rgba(16, 185, 129, 0.15)`,
  position: "fixed",
  left: 20,
  right: 20,
  top: "calc(env(safe-area-inset-top) + 70px)",
  zIndex: 90,
};

export const videoCallBannerIcon = {
  fontSize: 20,
  marginRight: 12,
};

export const videoCallBannerText = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  color: colors.textPrimary,
  fontWeight: 500,
};

export const videoCallBannerBtn = {
  background: colors.success,
  color: colors.white,
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  marginLeft: 8,
  transition: "all 0.2s ease",
};

export const videoCallBannerDeclineBtn = {
  background: colors.dangerLight,
  color: colors.danger,
  border: "none",
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  marginLeft: 8,
  transition: "all 0.2s ease",
};

// === АДАПТИВНЫЕ СТИЛИ ===
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

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

@keyframes callPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
  }
}

/* Smooth hover transitions */
button:hover {
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0);
}

/* Input focus states */
input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}

@media (max-width: 700px) {
  html, body, #root {
    height: 100vh !important;
    width: 100vw !important;
    overflow: hidden !important;
  }
  
  .govchat-page {
    flex-direction: column !important;
    padding: 0 !important;
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
  }
  
  .govchat-input-row {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    padding-bottom: calc(env(safe-area-inset-bottom, 8px) + 8px) !important;
  }
  
  .govchat-profile-popup {
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 90vw !important;
    max-width: 340px !important;
    border-radius: 20px !important;
  }
}
`;
