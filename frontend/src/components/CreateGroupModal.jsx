import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '@/config';
import { usePhoneUserLookup } from '@/shared/hooks/usePhoneUserLookup';
import { ImageIcon, SearchIcon } from '@/shared/ui/Icons';

const STEP_CONFIG = [
  { id: 1, title: 'Название и аватар', subtitle: 'Визуал группы' },
  { id: 2, title: 'Участники', subtitle: 'Состав чата' },
  { id: 3, title: 'Подтверждение', subtitle: 'Финальная проверка' }
];

function CreateGroupModal({ token, onClose, onGroupCreated }) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('forward');

  const [groupName, setGroupName] = useState('');
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [lastAddedUserId, setLastAddedUserId] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const avatarInputRef = useRef(null);

  const {
    phone,
    setPhone,
    status,
    user,
    error: lookupError
  } = usePhoneUserLookup({ token, minLen: 9, debounceMs: 350 });

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (groupAvatarUrl && groupAvatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(groupAvatarUrl);
      }
    };
  }, [groupAvatarUrl]);

  useEffect(() => {
    if (!lastAddedUserId) return undefined;
    const timer = setTimeout(() => setLastAddedUserId(''), 500);
    return () => clearTimeout(timer);
  }, [lastAddedUserId]);

  const isAlreadySelected = useMemo(
    () => Boolean(user?.id && selectedUsers.some((item) => item.id === user.id)),
    [selectedUsers, user?.id]
  );

  const canGoNext = step === 1
    ? groupName.trim().length > 0
    : step === 2
      ? selectedUsers.length > 0
      : false;

  const canCreate = groupName.trim().length > 0 && selectedUsers.length > 0 && !isCreating;
  const progressPercent = ((step - 1) / (STEP_CONFIG.length - 1)) * 100;

  const searchHint = useMemo(() => {
    if (!phone) return 'Введите номер телефона участника';
    if (status === 'too_short') return 'Укажите номер полностью (минимум 9 цифр)';
    if (status === 'loading') return 'Поиск пользователя...';
    if (status === 'not_found') return 'Пользователь не найден';
    if (status === 'rate_limited') return lookupError || 'Слишком много запросов. Попробуйте позже';
    if (status === 'error') return lookupError || 'Ошибка поиска';
    if (status === 'found' && isAlreadySelected) return 'Пользователь уже добавлен';
    return '';
  }, [isAlreadySelected, lookupError, phone, status]);

  const goToStep = useCallback((targetStep) => {
    if (targetStep === step) return;
    setDirection(targetStep > step ? 'forward' : 'backward');
    setStep(targetStep);
    setError('');
  }, [step]);

  const handleNext = useCallback(() => {
    if (step === 1 && !groupName.trim()) {
      setError('Введите название группы');
      return;
    }

    if (step === 2 && selectedUsers.length === 0) {
      setError('Добавьте хотя бы одного участника');
      return;
    }

    goToStep(Math.min(3, step + 1));
  }, [goToStep, groupName, selectedUsers.length, step]);

  const handleBack = useCallback(() => {
    goToStep(Math.max(1, step - 1));
  }, [goToStep, step]);

  const handlePickAvatar = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
      setError('Для аватара используйте изображение');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Максимальный размер аватара: 5MB');
      return;
    }

    if (groupAvatarUrl && groupAvatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(groupAvatarUrl);
    }

    setGroupAvatarFile(file);
    setGroupAvatarUrl(URL.createObjectURL(file));
    setError('');
  }, [groupAvatarUrl]);

  const handleSelectUser = useCallback(() => {
    if (!user?.id || isAlreadySelected) {
      setPhone('');
      return;
    }

    setSelectedUsers((prev) => [...prev, user]);
    setLastAddedUserId(user.id);
    setPhone('');
    setError('');
  }, [isAlreadySelected, setPhone, user]);

  const handleRemoveUser = useCallback((userId) => {
    setSelectedUsers((prev) => prev.filter((item) => item.id !== userId));
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      setError('Введите название группы');
      return;
    }

    if (selectedUsers.length < 1) {
      setError('Добавьте хотя бы одного участника');
      return;
    }

    try {
      setIsCreating(true);
      setError('');

      const res = await fetch(`${API_URL}/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: trimmedName,
          participantIds: selectedUsers.map((item) => item.id)
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось создать группу');
      }

      onGroupCreated?.(data);
    } catch (err) {
      setError(err?.message || 'Не удалось создать группу');
    } finally {
      setIsCreating(false);
    }
  }, [groupName, onGroupCreated, selectedUsers, token]);

  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && status === 'found' && user && !isAlreadySelected) {
      event.preventDefault();
      handleSelectUser();
    }
  }, [handleSelectUser, isAlreadySelected, status, user]);

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <section className="wizard-panel-inner">
          <h3 className="wizard-heading">Шаг 1. Название и визуал</h3>
          <p className="wizard-description">Придумайте имя группы и добавьте аватар для узнаваемости.</p>

          <div className="wizard-avatar-row">
            <div className="wizard-avatar-preview">
              {groupAvatarUrl ? (
                <img src={groupAvatarUrl} alt="Group avatar" className="wizard-avatar-image" />
              ) : (
                <span className="wizard-avatar-fallback">{String(groupName || 'G').charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="wizard-avatar-actions">
              <button type="button" className="btn btn-secondary" onClick={handlePickAvatar}>
                <ImageIcon size={16} />
                {groupAvatarFile ? 'Сменить аватар' : 'Выбрать аватар'}
              </button>
              <div className="wizard-helper-text">PNG/JPG, до 5MB</div>
            </div>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />

          <div className="wizard-field-block">
            <label className="wizard-label" htmlFor="group-name-input">Название группы</label>
            <input
              id="group-name-input"
              className="wizard-input"
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Например: Команда продукта"
              maxLength={60}
            />
            <div className="wizard-counter">{groupName.trim().length || 0}/60</div>
          </div>
        </section>
      );
    }

    if (step === 2) {
      return (
        <section className="wizard-panel-inner">
          <h3 className="wizard-heading">Шаг 2. Добавьте участников</h3>
          <p className="wizard-description">Введите номер телефона и добавьте людей в один клик.</p>
          <div className="wizard-meta-banner">
            <span className="wizard-meta-label">Добавлено участников</span>
            <span className="wizard-meta-value">{selectedUsers.length}</span>
          </div>

          <div className="wizard-field-block">
            <label className="wizard-label" htmlFor="group-member-phone">Поиск по номеру</label>
            <div className="wizard-search-wrap">
              <SearchIcon size={16} />
              <input
                id="group-member-phone"
                className="wizard-search-input"
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Введите номер телефона"
              />
            </div>
            <div className="wizard-helper-text">{searchHint}</div>
          </div>

          {status === 'found' && user ? (
            <div className="wizard-search-result">
              <div className="wizard-user-avatar">{String(user?.name || '?').charAt(0).toUpperCase()}</div>
              <div className="wizard-user-content">
                <div className="wizard-user-name">{user?.name || 'Пользователь'}</div>
                <div className="wizard-user-phone">{phone}</div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSelectUser}
                disabled={isAlreadySelected}
              >
                {isAlreadySelected ? 'Уже добавлен' : 'Добавить'}
              </button>
            </div>
          ) : null}

          <div className="wizard-chip-zone">
            {selectedUsers.length === 0 ? (
              <div className="wizard-empty-chip">Участники пока не добавлены</div>
            ) : (
              selectedUsers.map((item) => (
                <div
                  key={item.id}
                  className={`wizard-chip ${lastAddedUserId === item.id ? 'is-new' : ''}`}
                >
                  <span className="wizard-chip-avatar">{String(item?.name || '?').charAt(0).toUpperCase()}</span>
                  <span className="wizard-chip-name">{item?.name || 'Пользователь'}</span>
                  <button
                    type="button"
                    className="wizard-chip-remove"
                    onClick={() => handleRemoveUser(item.id)}
                    aria-label="Удалить участника"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="wizard-panel-inner">
        <h3 className="wizard-heading">Шаг 3. Подтверждение</h3>
        <p className="wizard-description">Проверьте настройки и создайте группу.</p>

        <div className="wizard-summary-card">
          <div className="wizard-summary-header">
            <div className="wizard-avatar-preview small">
              {groupAvatarUrl ? (
                <img src={groupAvatarUrl} alt="Group avatar" className="wizard-avatar-image" />
              ) : (
                <span className="wizard-avatar-fallback">{String(groupName || 'G').charAt(0).toUpperCase()}</span>
              )}
            </div>

            <div className="wizard-summary-meta">
              <div className="wizard-summary-name">{groupName.trim() || 'Без названия'}</div>
              <div className="wizard-summary-sub">Участников: {selectedUsers.length}</div>
            </div>
          </div>

          <div className="wizard-summary-members">
            {selectedUsers.map((item) => (
              <div key={item.id} className="wizard-summary-member">
                <span className="wizard-summary-member-dot" />
                <span>{item?.name || 'Пользователь'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="wizard-summary-note">
          После создания вы сразу попадете в новый групповой чат и сможете отправлять сообщения.
        </div>
      </section>
    );
  };

  return (
    <div className="group-wizard-overlay" onClick={onClose}>
      <div className="group-wizard-modal" onClick={(event) => event.stopPropagation()}>
        <header className="group-wizard-header">
          <div className="group-wizard-header-main">
            <div className="group-wizard-kicker">Создание чата</div>
            <h2 className="group-wizard-title">Новая группа</h2>
            <p className="group-wizard-subtitle">Соберите людей в один чат за три шага</p>
          </div>
          <div className="group-wizard-header-actions">
            <div className="group-wizard-step-counter">Шаг {step} из {STEP_CONFIG.length}</div>
            <button type="button" className="group-wizard-close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
        </header>

        <div className="group-wizard-progress" aria-hidden="true">
          <span className="group-wizard-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="group-wizard-steps" role="tablist" aria-label="Шаги создания группы">
          {STEP_CONFIG.map((item) => {
            const done = step > item.id;
            const active = step === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`group-step-pill ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                onClick={() => {
                  if (item.id < step) goToStep(item.id);
                }}
                disabled={item.id > step}
              >
                <span className="group-step-index">{item.id}</span>
                <span className="group-step-labels">
                  <span className="group-step-text">{item.title}</span>
                  <span className="group-step-subtext">{item.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>

        <main className="group-wizard-content">
          <div key={step} className={`wizard-panel wizard-panel-${direction}`}>
            {renderStepContent()}
          </div>
        </main>

        {error ? <div className="group-wizard-error">{error}</div> : null}

        <footer className="group-wizard-footer">
          <button type="button" className="btn btn-ghost wizard-footer-btn" onClick={onClose}>
            Отмена
          </button>

          <div className="wizard-footer-actions">
            <div className="wizard-footer-info">
              {step === 1 ? 'Сначала укажите название группы' : null}
              {step === 2 ? `Выбрано участников: ${selectedUsers.length}` : null}
              {step === 3 ? 'Проверьте данные перед созданием' : null}
            </div>
            {step > 1 ? (
              <button type="button" className="btn btn-secondary wizard-footer-btn" onClick={handleBack}>
                Назад
              </button>
            ) : null}

            {step < 3 ? (
              <button type="button" className="btn btn-primary wizard-footer-btn" onClick={handleNext} disabled={!canGoNext}>
                Далее
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary wizard-footer-btn"
                onClick={handleCreateGroup}
                disabled={!canCreate}
              >
                {isCreating ? 'Создаем...' : `Создать группу (${selectedUsers.length})`}
              </button>
            )}
          </div>
        </footer>

        <style>{`
          .group-wizard-overlay {
            position: fixed;
            inset: 0;
            z-index: 12000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-16);
            background: rgba(2, 6, 23, 0.78);
            backdrop-filter: blur(8px);
          }

          .group-wizard-modal {
            width: min(720px, calc(100vw - 32px));
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            background:
              radial-gradient(circle at 10% 0%, rgba(59, 130, 246, 0.16), transparent 38%),
              radial-gradient(circle at 92% 8%, rgba(99, 102, 241, 0.12), transparent 32%),
              var(--bg-card);
            border-radius: var(--radius-modal);
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-xl);
            overflow: hidden;
          }

          .group-wizard-header {
            padding: var(--space-20) var(--space-24) var(--space-16);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            gap: var(--space-12);
            align-items: flex-start;
          }

          .group-wizard-header-main {
            min-width: 0;
          }

          .group-wizard-kicker {
            font-size: 11px;
            color: #93c5fd;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 800;
            margin-bottom: var(--space-8);
          }

          .group-wizard-header-actions {
            display: flex;
            align-items: center;
            gap: var(--space-10);
          }

          .group-wizard-step-counter {
            border-radius: var(--radius-pill);
            border: 1px solid rgba(99, 102, 241, 0.35);
            background: rgba(79, 124, 255, 0.18);
            padding: 5px 10px;
            color: #dbeafe;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
          }

          .group-wizard-title {
            margin: 0;
            font-size: 30px;
            line-height: 1.1;
            font-weight: 820;
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }

          .group-wizard-subtitle {
            margin-top: var(--space-8);
            color: var(--text-muted);
            font-size: 14px;
          }

          .group-wizard-progress {
            height: 3px;
            background: rgba(148, 163, 184, 0.2);
          }

          .group-wizard-progress-fill {
            display: block;
            height: 100%;
            background: linear-gradient(90deg, #4f7cff, #7c8cff);
            box-shadow: 0 0 16px rgba(79, 124, 255, 0.55);
            transition: width 220ms ease;
          }

          .group-wizard-close {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: var(--bg-surface);
            color: var(--text-secondary);
            font-size: 24px;
            line-height: 1;
            transition: var(--transition-normal);
          }

          .group-wizard-close:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
          }

          .group-wizard-steps {
            padding: var(--space-12) var(--space-24);
            border-bottom: 1px solid var(--border-light);
            display: flex;
            gap: var(--space-8);
            align-items: stretch;
          }

          .group-step-pill {
            flex: 1;
            min-width: 0;
            display: inline-flex;
            align-items: center;
            gap: var(--space-8);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-md);
            background: rgba(15, 23, 42, 0.45);
            color: var(--text-muted);
            padding: 8px 10px;
            transition: var(--transition-fast);
          }

          .group-step-pill.done,
          .group-step-pill.active {
            color: #dbeafe;
            border-color: rgba(99, 102, 241, 0.46);
            background: rgba(79, 124, 255, 0.18);
          }

          .group-step-pill:disabled {
            cursor: not-allowed;
            opacity: 0.7;
          }

          .group-step-index {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 800;
            background: rgba(148, 163, 184, 0.25);
            color: #f8fafc;
          }

          .group-step-labels {
            min-width: 0;
            display: flex;
            flex-direction: column;
          }

          .group-step-text {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.015em;
            line-height: 1.2;
          }

          .group-step-subtext {
            margin-top: 1px;
            font-size: 10px;
            color: rgba(203, 213, 225, 0.72);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .group-wizard-content {
            flex: 1;
            min-height: 0;
            overflow: hidden;
            padding: var(--space-20) var(--space-24);
          }

          .wizard-panel {
            height: 100%;
            overflow: auto;
            animation-duration: 220ms;
            animation-timing-function: ease;
            animation-fill-mode: both;
          }

          .wizard-panel-forward {
            animation-name: wizardSlideInFromRight;
          }

          .wizard-panel-backward {
            animation-name: wizardSlideInFromLeft;
          }

          .wizard-panel-inner {
            max-width: 100%;
          }

          .wizard-heading {
            margin: 0;
            font-size: 24px;
            font-weight: 790;
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }

          .wizard-description {
            margin-top: var(--space-8);
            color: var(--text-muted);
            font-size: 14px;
            margin-bottom: var(--space-18);
          }

          .wizard-meta-banner {
            margin-top: calc(var(--space-8) * -1);
            margin-bottom: var(--space-14);
            display: inline-flex;
            align-items: baseline;
            gap: var(--space-8);
            padding: 6px 12px;
            border-radius: var(--radius-pill);
            border: 1px solid rgba(99, 102, 241, 0.32);
            background: rgba(79, 124, 255, 0.12);
          }

          .wizard-meta-label {
            font-size: 12px;
            color: var(--text-secondary);
          }

          .wizard-meta-value {
            font-size: 16px;
            font-weight: 800;
            color: #dbeafe;
            line-height: 1;
          }

          .wizard-avatar-row {
            display: flex;
            align-items: center;
            gap: var(--space-16);
            margin-bottom: var(--space-18);
          }

          .wizard-avatar-preview {
            width: 86px;
            height: 86px;
            border-radius: 50%;
            border: 1px solid var(--border-color);
            background: linear-gradient(135deg, rgba(79, 124, 255, 0.22), rgba(139, 92, 246, 0.2));
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #e2e8f0;
            font-size: 30px;
            font-weight: 800;
            overflow: hidden;
            flex-shrink: 0;
          }

          .wizard-avatar-preview.small {
            width: 66px;
            height: 66px;
            font-size: 24px;
          }

          .wizard-avatar-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .wizard-avatar-fallback {
            line-height: 1;
          }

          .wizard-avatar-actions {
            display: flex;
            flex-direction: column;
            gap: var(--space-8);
          }

          .wizard-field-block {
            margin-top: var(--space-8);
          }

          .wizard-label {
            display: block;
            margin-bottom: var(--space-8);
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.07em;
            text-transform: uppercase;
          }

          .wizard-input,
          .wizard-search-input {
            width: 100%;
            border-radius: var(--radius-md);
            border: 1px solid var(--border-input);
            background: rgba(2, 6, 23, 0.52);
            color: var(--text-primary);
            padding: 13px 14px;
            transition: var(--transition-normal);
          }

          .wizard-search-wrap {
            display: flex;
            align-items: center;
            gap: var(--space-8);
            border-radius: var(--radius-md);
            border: 1px solid var(--border-input);
            background: rgba(2, 6, 23, 0.52);
            color: var(--text-muted);
            padding: 0 12px;
          }

          .wizard-search-input {
            border: none;
            background: transparent;
            padding-left: 0;
          }

          .wizard-input:focus,
          .wizard-search-wrap:focus-within {
            border-color: rgba(99, 102, 241, 0.56);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
          }

          .wizard-helper-text {
            color: var(--text-muted);
            font-size: 12px;
            min-height: 18px;
          }

          .wizard-counter {
            margin-top: var(--space-6);
            font-size: 12px;
            color: var(--text-muted);
            text-align: right;
          }

          .wizard-search-result {
            margin-top: var(--space-12);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            background: rgba(15, 23, 42, 0.62);
            padding: var(--space-10);
            display: flex;
            align-items: center;
            gap: var(--space-10);
          }

          .wizard-user-avatar,
          .wizard-chip-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.9));
            color: #eef2ff;
            font-size: 15px;
            font-weight: 800;
            flex-shrink: 0;
          }

          .wizard-user-content {
            flex: 1;
            min-width: 0;
          }

          .wizard-user-name {
            font-size: 14px;
            font-weight: 720;
            color: var(--text-primary);
          }

          .wizard-user-phone {
            margin-top: 2px;
            font-size: 12px;
            color: var(--text-muted);
          }

          .wizard-chip-zone {
            margin-top: var(--space-16);
            display: flex;
            flex-wrap: wrap;
            gap: var(--space-8);
          }

          .wizard-empty-chip {
            width: 100%;
            border: 1px dashed var(--border-color);
            border-radius: var(--radius-md);
            background: rgba(15, 23, 42, 0.45);
            color: var(--text-muted);
            font-size: 13px;
            text-align: center;
            padding: var(--space-12);
          }

          .wizard-chip {
            display: inline-flex;
            align-items: center;
            gap: var(--space-8);
            border-radius: var(--radius-pill);
            border: 1px solid rgba(99, 102, 241, 0.36);
            background: rgba(79, 124, 255, 0.16);
            color: #dbeafe;
            padding: 6px 10px 6px 6px;
          }

          .wizard-chip.is-new {
            animation: chipPopIn 240ms ease;
          }

          .wizard-chip-avatar {
            width: 26px;
            height: 26px;
            font-size: 12px;
          }

          .wizard-chip-name {
            font-size: 12px;
            font-weight: 700;
            max-width: 170px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .wizard-chip-remove {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 1px solid rgba(191, 219, 254, 0.35);
            background: rgba(15, 23, 42, 0.55);
            color: #dbeafe;
            font-size: 12px;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: var(--transition-fast);
          }

          .wizard-chip-remove:hover {
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(248, 113, 113, 0.45);
            color: #fecaca;
          }

          .wizard-summary-card {
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            background: rgba(15, 23, 42, 0.66);
            padding: var(--space-14);
          }

          .wizard-summary-note {
            margin-top: var(--space-12);
            border: 1px dashed rgba(148, 163, 184, 0.35);
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.5);
            color: var(--text-secondary);
            font-size: 13px;
            line-height: 1.45;
            padding: 12px;
          }

          .wizard-summary-header {
            display: flex;
            align-items: center;
            gap: var(--space-12);
            margin-bottom: var(--space-12);
            padding-bottom: var(--space-12);
            border-bottom: 1px solid var(--border-light);
          }

          .wizard-summary-meta {
            min-width: 0;
          }

          .wizard-summary-name {
            color: var(--text-primary);
            font-size: 19px;
            font-weight: 780;
          }

          .wizard-summary-sub {
            margin-top: 4px;
            color: var(--text-muted);
            font-size: 13px;
          }

          .wizard-summary-members {
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
            max-height: 220px;
            overflow: auto;
          }

          .wizard-summary-member {
            display: flex;
            align-items: center;
            gap: var(--space-8);
            color: var(--text-secondary);
            font-size: 14px;
          }

          .wizard-summary-member-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--accent);
            box-shadow: 0 0 0 4px rgba(79, 124, 255, 0.16);
          }

          .group-wizard-error {
            margin: 0 var(--space-24) var(--space-10);
            border-radius: 12px;
            border: 1px solid rgba(248, 113, 113, 0.35);
            background: rgba(244, 63, 94, 0.12);
            color: #fecaca;
            font-size: 13px;
            font-weight: 600;
            padding: 10px 12px;
          }

          .group-wizard-footer {
            border-top: 1px solid var(--border-color);
            padding: var(--space-14) var(--space-24);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: var(--space-10);
            background: rgba(10, 15, 27, 0.75);
          }

          .wizard-footer-actions {
            display: inline-flex;
            gap: var(--space-10);
            align-items: center;
          }

          .wizard-footer-info {
            margin-right: var(--space-4);
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
          }

          .wizard-footer-btn {
            min-width: 156px;
            border-radius: 12px;
          }

          @keyframes wizardSlideInFromRight {
            from {
              opacity: 0;
              transform: translateX(18px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes wizardSlideInFromLeft {
            from {
              opacity: 0;
              transform: translateX(-18px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes chipPopIn {
            0% {
              opacity: 0;
              transform: translateY(6px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @media (max-width: 768px) {
            .group-wizard-overlay {
              padding: var(--space-10);
            }

            .group-wizard-modal {
              width: 100%;
              max-height: 94vh;
            }

            .group-wizard-title {
              font-size: 24px;
            }

            .group-wizard-header,
            .group-wizard-steps,
            .group-wizard-content,
            .group-wizard-footer {
              padding-left: var(--space-14);
              padding-right: var(--space-14);
            }

            .group-step-text {
              font-size: 11px;
            }

            .group-step-subtext {
              display: none;
            }

            .group-wizard-step-counter {
              display: none;
            }

            .group-wizard-footer {
              flex-direction: column;
              align-items: stretch;
            }

            .wizard-footer-actions {
              width: 100%;
              flex-direction: column;
            }

            .wizard-footer-info {
              width: 100%;
              margin-right: 0;
              margin-bottom: var(--space-8);
              text-align: center;
            }

            .wizard-footer-btn {
              width: 100%;
            }

            .wizard-avatar-row {
              flex-direction: column;
              align-items: flex-start;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default CreateGroupModal;
