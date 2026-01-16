// ============================================
// СТИЛИ АВТОРИЗАЦИИ - СОВРЕМЕННЫЙ ДИЗАЙН
// ============================================

export const authStyles = {
  authContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    minHeight: '100dvh',
    padding: '20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: "'Inter', 'Segoe UI', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  authBox: {
    background: '#1a1d29',
    padding: '48px 40px',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
    width: '100%',
    maxWidth: '440px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    animation: 'slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  title: {
    textAlign: 'center',
    marginBottom: '12px',
    fontSize: '36px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    letterSpacing: '-1px',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: '32px',
    fontSize: '15px',
    color: '#a0aec0',
    fontWeight: '500',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '32px',
    background: '#242837',
    padding: '6px',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  tab: {
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    background: 'transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    color: '#718096',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    padding: '14px 18px',
    border: '2px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '14px',
    fontSize: '15px',
    background: '#2d3142',
    color: '#ffffff',
    outline: 'none',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    fontWeight: '500',
  },
  button: {
    padding: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    marginTop: '8px',
    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)',
    transform: 'translateY(0)',
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'center',
    padding: '12px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '12px',
    fontWeight: '500',
    border: '1px solid rgba(239, 68, 68, 0.2)',
  },
};

// Добавляем анимации и hover эффекты
if (typeof document !== 'undefined' && !document.getElementById('auth-styles-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'auth-styles-animations';
  styleSheet.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Hover эффекты для кнопок */
    [data-auth-button]:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5) !important;
    }

    [data-auth-button]:active {
      transform: translateY(0) !important;
    }

    /* Фокус для инпутов */
    [data-auth-input]:focus {
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2) !important;
    }

    /* Hover для табов */
    [data-auth-tab]:hover:not([data-auth-tab-active]) {
      background: rgba(255, 255, 255, 0.05);
      color: #a0aec0;
    }

    /* Плавные анимации для всех элементов */
    [data-auth-element] * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
  `;
  document.head.appendChild(styleSheet);
}

export default authStyles;
