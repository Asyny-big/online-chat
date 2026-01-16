// ============================================
// СОВРЕМЕННЫЙ ДИЗАЙН ДЛЯ GOVCHAT
// ============================================

// Цветовая палитра
const colors = {
  // Основные цвета фона
  background: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    secondary: '#1a1d29',
    tertiary: '#242837',
    elevated: '#2d3142',
  },
  // Акцентные цвета
  accent: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    hover: '#7c3aed',
  },
  // Текстовые цвета
  text: {
    primary: '#ffffff',
    secondary: '#a0aec0',
    tertiary: '#718096',
    muted: '#4a5568',
  },
  // Статусы
  status: {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  },
  // Границы
  border: {
    primary: 'rgba(255, 255, 255, 0.1)',
    secondary: 'rgba(255, 255, 255, 0.05)',
  }
};

// Главная страница
export const page = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: colors.background.primary,
  fontFamily: "'Inter', 'Segoe UI', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
  color: colors.text.primary,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  overflow: "hidden",
};

// Sidebar стили
export const sidebar = {
  width: 320,
  background: colors.background.secondary,
  borderRight: `1px solid ${colors.border.primary}`,
  boxShadow: "4px 0 24px rgba(0, 0, 0, 0.15)",
  padding: "0",
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  position: "relative",
  backdropFilter: "blur(10px)",
};

export const sidebarTitle = {
  fontWeight: 700,
  fontSize: 24,
  marginBottom: 20,
  letterSpacing: -0.5,
  background: colors.accent.gradient,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

export const channelList = {
  flex: 1,
  overflowY: "auto",
  marginBottom: 0,
  padding: "0 16px",
  scrollbarWidth: "thin",
  scrollbarColor: `${colors.accent.primary} transparent`,
};

export const channelItem = isActive => ({
  cursor: "pointer",
  background: isActive 
    ? colors.accent.gradient
    : "transparent",
  color: isActive ? colors.text.primary : colors.text.secondary,
  borderRadius: 12,
  padding: "12px 16px",
  marginBottom: 8,
  fontWeight: isActive ? 600 : 500,
  fontSize: 15,
  boxShadow: isActive 
    ? "0 4px 12px rgba(102, 126, 234, 0.3)" 
    : "none",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  border: "none",
  transform: isActive ? "translateY(-2px)" : "none",
});

export const createBtn = {
  background: colors.accent.gradient,
  color: colors.text.primary,
  border: "none",
  borderRadius: 12,
  padding: "12px 24px",
  marginTop: 12,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "translateY(0)",
};

export const logoutBtn = {
  marginTop: "auto",
  background: "transparent",
  color: colors.status.error,
  border: `2px solid ${colors.status.error}`,
  borderRadius: 12,
  padding: "10px 24px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  position: "sticky",
  bottom: 16,
  width: "calc(100% - 32px)",
  margin: "0 16px 16px 16px",
  zIndex: 2,
};

// Контейнер чата
export const chatContainer = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  height: "100%",
  position: "relative",
  padding: "24px",
  background: colors.background.secondary,
};

export const usernameBox = {
  position: "absolute",
  top: 24,
  right: 24,
  color: colors.text.primary,
  fontWeight: 600,
  fontSize: 14,
  padding: "8px 16px",
  background: colors.background.elevated,
  borderRadius: 20,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  letterSpacing: 0.5,
  border: `1px solid ${colors.border.primary}`,
  backdropFilter: "blur(10px)",
};

export const chatTitle = {
  fontWeight: 700,
  fontSize: 24,
  marginBottom: 16,
  color: colors.text.primary,
  letterSpacing: -0.5,
};

export const chatBox = {
  flex: 1,
  background: colors.background.tertiary,
  borderRadius: 20,
  boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.1)",
  padding: "24px",
  marginBottom: 0,
  overflowY: "auto",
  minHeight: 0,
  paddingBottom: 24,
  scrollbarWidth: "thin",
  scrollbarColor: `${colors.accent.primary} transparent`,
};

// Сообщения
export const messageRow = isMine => ({
  display: "flex",
  justifyContent: isMine ? "flex-end" : "flex-start",
  marginBottom: 12,
  animation: "slideIn 0.3s ease-out",
});

export const message = isMine => ({
  marginBottom: 0,
  padding: "10px 16px",
  borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
  background: isMine 
    ? colors.accent.gradient
    : colors.background.elevated,
  color: colors.text.primary,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
  fontSize: 15,
  lineHeight: 1.5,
  wordBreak: "break-word",
  maxWidth: "70%",
  alignSelf: isMine ? "flex-end" : "flex-start",
  textAlign: isMine ? "right" : "left",
  transition: "all 0.2s ease",
  border: isMine ? "none" : `1px solid ${colors.border.primary}`,
});

export const messageSender = {
  fontWeight: 600,
  color: colors.accent.primary,
  marginRight: 8,
  fontSize: 13,
};

export const messageTime = {
  fontSize: 11,
  color: colors.text.tertiary,
  marginTop: 4,
  opacity: 0.7,
};

// Ввод сообщений
export const inputRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginTop: 16,
  marginBottom: 0,
  position: "sticky",
  bottom: 0,
  background: colors.background.tertiary,
  zIndex: 2,
  padding: "16px",
  borderRadius: 20,
  boxShadow: "0 -2px 16px rgba(0, 0, 0, 0.1)",
};

export const input = {
  flex: 1,
  borderRadius: 16,
  border: `2px solid ${colors.border.primary}`,
  padding: "12px 18px",
  fontSize: 15,
  background: colors.background.elevated,
  color: colors.text.primary,
  outline: "none",
  transition: "all 0.3s ease",
  fontFamily: "inherit",
};

export const sendBtn = {
  background: colors.accent.gradient,
  color: colors.text.primary,
  border: "none",
  borderRadius: 14,
  padding: "12px 24px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "translateY(0)",
};

export const attachBtn = {
  background: colors.background.elevated,
  color: colors.text.secondary,
  border: `2px solid ${colors.border.primary}`,
  borderRadius: "50%",
  width: 48,
  height: 48,
  minWidth: 48,
  minHeight: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  cursor: "pointer",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "translateY(0)",
};

export const attachBtnHover = {
  background: colors.accent.primary,
  color: colors.text.primary,
  boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
  transform: "translateY(-2px)",
};

export const typing = {
  color: colors.text.secondary,
  fontStyle: "italic",
  fontSize: 14,
  margin: "8px 0",
  minHeight: 20,
  background: "none",
  borderRadius: 0,
  boxShadow: "none",
};

// Авторизация
export const authContainer = {
  margin: "auto",
  background: colors.background.secondary,
  borderRadius: 24,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  padding: "48px 40px",
  minWidth: 320,
  maxWidth: 440,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${colors.border.primary}`,
  backdropFilter: "blur(20px)",
};

export const authTitle = {
  fontWeight: 700,
  fontSize: 32,
  marginBottom: 24,
  background: colors.accent.gradient,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  letterSpacing: -1,
};

export const authInput = {
  width: "100%",
  maxWidth: 360,
  display: "block",
  marginLeft: "auto",
  marginRight: "auto",
  borderRadius: 14,
  border: `2px solid ${colors.border.primary}`,
  padding: "14px 18px",
  fontSize: 15,
  background: colors.background.elevated,
  color: colors.text.primary,
  outline: "none",
  marginBottom: 16,
  transition: "all 0.3s ease",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export const authBtn = {
  width: "100%",
  background: colors.accent.gradient,
  color: colors.text.primary,
  border: "none",
  borderRadius: 14,
  padding: "14px 0",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 12,
  boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "translateY(0)",
};

export const switchBtn = {
  width: "100%",
  background: "transparent",
  color: colors.accent.primary,
  border: `2px solid ${colors.accent.primary}`,
  borderRadius: 14,
  padding: "14px 0",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 0,
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
};

export const error = {
  color: colors.status.error,
  marginBottom: 12,
  fontWeight: 500,
  fontSize: 14,
  textAlign: "center",
  padding: "12px",
  background: "rgba(239, 68, 68, 0.1)",
  borderRadius: 12,
  border: `1px solid rgba(239, 68, 68, 0.2)`,
};

// Профиль
export const profileBtnBox = {
  position: "absolute",
  right: 80,
  bottom: 80,
  zIndex: 10,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

export const profileBtn = {
  background: colors.accent.gradient,
  border: "none",
  padding: 0,
  cursor: "pointer",
  borderRadius: "50%",
  width: 56,
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 16px rgba(102, 126, 234, 0.4)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  transform: "translateY(0)",
};

export const profilePopup = {
  position: "fixed",
  left: 0,
  bottom: 0,
  top: "auto",
  width: 320,
  minWidth: 280,
  maxWidth: 360,
  height: "auto",
  maxHeight: "80vh",
  background: colors.background.secondary,
  color: colors.text.primary,
  borderRadius: "24px 24px 0 0",
  boxShadow: "0 -4px 32px rgba(0, 0, 0, 0.3)",
  padding: "24px",
  zIndex: 100,
  fontSize: 15,
  display: "flex",
  flexDirection: "column",
  gap: 0,
  border: `1px solid ${colors.border.primary}`,
  borderBottom: "none",
  backdropFilter: "blur(20px)",
  willChange: "transform, opacity",
  transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
};

export const profileAvatar = {
  width: 120,
  height: 120,
  borderRadius: "50%",
  background: colors.accent.gradient,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 48,
  color: colors.text.primary,
  margin: "16px auto 20px auto",
  boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)",
  fontWeight: 600,
};

export const profileTitle = {
  fontWeight: 700,
  fontSize: 20,
  textAlign: "center",
  marginBottom: 24,
  color: colors.text.primary,
  letterSpacing: -0.5,
};

export const profileCloseBtn = {
  position: "absolute",
  top: 16,
  right: 16,
  background: colors.background.elevated,
  color: colors.text.secondary,
  border: "none",
  borderRadius: "50%",
  width: 36,
  height: 36,
  fontSize: 20,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.3s ease",
  zIndex: 101,
};

export const profileSectionTitle = {
  color: colors.text.secondary,
  fontWeight: 600,
  fontSize: 12,
  marginTop: 24,
  marginBottom: 12,
  letterSpacing: 1,
  textTransform: "uppercase",
};

export const profileField = {
  marginBottom: 16,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "12px",
  background: colors.background.elevated,
  borderRadius: 12,
  border: `1px solid ${colors.border.primary}`,
};

export const profileLabel = {
  color: colors.text.secondary,
  fontWeight: 500,
  fontSize: 12,
  marginBottom: 0,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export const profileValue = {
  color: colors.text.primary,
  fontWeight: 600,
  fontSize: 16,
  marginBottom: 0,
  wordBreak: "break-word",
};

export const profilePhone = {
  color: colors.text.primary,
  fontWeight: 600,
  fontSize: 18,
  letterSpacing: 0.5,
  marginBottom: 0,
};

export const profileLogoutBtn = {
  marginTop: 0,
  background: "transparent",
  color: colors.status.error,
  border: `2px solid ${colors.status.error}`,
  borderRadius: 12,
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  width: "auto",
  transition: "all 0.3s ease",
  boxShadow: "none",
  marginLeft: 0,
};

export const profileInfoNote = {
  color: colors.text.tertiary,
  fontSize: 12,
  marginTop: 24,
  textAlign: "center",
  opacity: 0.7,
};

export const profileEditBtn = {
  background: colors.accent.gradient,
  color: colors.text.primary,
  border: "none",
  borderRadius: 12,
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  marginTop: 0,
  marginBottom: 0,
  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
};

export const profileInput = {
  borderRadius: 12,
  border: `2px solid ${colors.border.primary}`,
  padding: "10px 14px",
  fontSize: 15,
  background: colors.background.tertiary,
  color: colors.text.primary,
  outline: "none",
  marginLeft: 0,
  minWidth: 120,
  marginBottom: 0,
  transition: "all 0.3s ease",
  fontFamily: "inherit",
};

// Темы (сохраняем совместимость)
export const themes = [
  {
    name: "Современный",
    pageBg: colors.background.primary,
    chatBg: colors.background.tertiary
  },
  {
    name: "Классика",
    pageBg: "linear-gradient(120deg, #232526 0%, #414345 100%)",
    chatBg: "rgba(40,42,44,0.98)"
  },
  {
    name: "Океан",
    pageBg: "linear-gradient(120deg, #2980b9 0%, #6dd5fa 100%)",
    chatBg: "rgba(30,60,90,0.95)"
  }
];

// Модальные окна
export const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.3s ease",
};

export const modal = {
  background: colors.background.secondary,
  borderRadius: 24,
  padding: "32px",
  maxWidth: 500,
  width: "90%",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
  border: `1px solid ${colors.border.primary}`,
  animation: "slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
};

export const modalTitle = {
  fontSize: 24,
  fontWeight: 700,
  marginBottom: 24,
  color: colors.text.primary,
  letterSpacing: -0.5,
};

export const modalBtn = {
  background: colors.accent.gradient,
  color: colors.text.primary,
  border: "none",
  borderRadius: 14,
  padding: "12px 24px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  marginRight: 12,
  marginTop: 16,
};

export const modalBtnSecondary = {
  background: "transparent",
  color: colors.text.secondary,
  border: `2px solid ${colors.border.primary}`,
  borderRadius: 14,
  padding: "12px 24px",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
  transition: "all 0.3s ease",
  marginTop: 16,
};

// Список участников
export const participantsList = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  marginTop: 16,
  maxHeight: 400,
  overflowY: "auto",
};

export const participantItem = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px",
  background: colors.background.elevated,
  borderRadius: 12,
  border: `1px solid ${colors.border.primary}`,
  transition: "all 0.2s ease",
};

export const participantAvatar = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: colors.accent.gradient,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  fontWeight: 600,
  color: colors.text.primary,
  flexShrink: 0,
};

export const participantName = {
  flex: 1,
  fontSize: 15,
  fontWeight: 500,
  color: colors.text.primary,
};

// Индикаторы
export const badge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export const badgePrimary = {
  ...badge,
  background: colors.accent.gradient,
  color: colors.text.primary,
};

export const badgeSuccess = {
  ...badge,
  background: colors.status.success,
  color: colors.text.primary,
};

export const badgeError = {
  ...badge,
  background: colors.status.error,
  color: colors.text.primary,
};

// Пустое состояние
export const emptyState = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  padding: "48px 24px",
  textAlign: "center",
};

export const emptyStateIcon = {
  fontSize: 64,
  marginBottom: 16,
  opacity: 0.5,
};

export const emptyStateTitle = {
  fontSize: 20,
  fontWeight: 600,
  color: colors.text.primary,
  marginBottom: 8,
};

export const emptyStateText = {
  fontSize: 14,
  color: colors.text.secondary,
  maxWidth: 320,
};

// Кнопки действий
export const actionBtn = {
  background: "transparent",
  border: "none",
  borderRadius: "50%",
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: colors.text.secondary,
  transition: "all 0.3s ease",
  fontSize: 18,
};

export const actionBtnPrimary = {
  ...actionBtn,
  background: colors.accent.primary,
  color: colors.text.primary,
};

// Hover эффекты (для документации)
export const hoverEffects = {
  button: {
    transform: "translateY(-2px)",
    boxShadow: "0 6px 20px rgba(102, 126, 234, 0.5)",
  },
  chatItem: {
    background: colors.background.elevated,
  },
  input: {
    borderColor: colors.accent.primary,
    boxShadow: `0 0 0 3px rgba(102, 126, 234, 0.1)`,
  },
};

// Анимации CSS (добавляем в head)
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    /* Прокрутка */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: ${colors.accent.primary};
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: ${colors.accent.hover};
    }

    /* Hover эффекты */
    button:hover {
      transform: translateY(-2px);
    }

    button:active {
      transform: translateY(0);
    }

    /* Плавные переходы */
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Фокус */
    input:focus,
    textarea:focus,
    button:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
    }

    /* Адаптивность */
    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        max-width: 100%;
      }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default {
  colors,
  page,
  sidebar,
  sidebarTitle,
  channelList,
  channelItem,
  createBtn,
  logoutBtn,
  chatContainer,
  usernameBox,
  chatTitle,
  chatBox,
  messageRow,
  message,
  messageSender,
  messageTime,
  inputRow,
  input,
  sendBtn,
  attachBtn,
  attachBtnHover,
  typing,
  authContainer,
  authTitle,
  authInput,
  authBtn,
  switchBtn,
  error,
  profileBtnBox,
  profileBtn,
  profilePopup,
  profileAvatar,
  profileTitle,
  profileCloseBtn,
  profileSectionTitle,
  profileField,
  profileLabel,
  profileValue,
  profilePhone,
  profileLogoutBtn,
  profileInfoNote,
  profileEditBtn,
  profileInput,
  themes,
  modalOverlay,
  modal,
  modalTitle,
  modalBtn,
  modalBtnSecondary,
  participantsList,
  participantItem,
  participantAvatar,
  participantName,
  badge,
  badgePrimary,
  badgeSuccess,
  badgeError,
  emptyState,
  emptyStateIcon,
  emptyStateTitle,
  emptyStateText,
  actionBtn,
  actionBtnPrimary,
  hoverEffects,
};
