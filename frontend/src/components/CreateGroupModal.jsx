import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '@/config';
import { usePhoneUserLookup } from '@/shared/hooks/usePhoneUserLookup';
import { ImageIcon, SearchIcon } from '@/shared/ui/Icons';

const STEPS = [1, 2, 3];

function CreateGroupModal({ token, onClose, onGroupCreated }) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState('forward');

  const [groupName, setGroupName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [lookupUsers, setLookupUsers] = useState([]);
  const [lastAddedUserId, setLastAddedUserId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const avatarInputRef = useRef(null);

  const {
    phone,
    setPhone,
    status,
    user,
    error: lookupError
  } = usePhoneUserLookup({ token, minLen: 9, debounceMs: 320 });

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (!lastAddedUserId) return undefined;
    const timer = setTimeout(() => setLastAddedUserId(''), 360);
    return () => clearTimeout(timer);
  }, [lastAddedUserId]);

  useEffect(() => {
    if (status !== 'found' || !user?.id) return;

    setLookupUsers((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== user.id);
      return [user, ...withoutCurrent].slice(0, 20);
    });
  }, [status, user]);

  const trimmedGroupName = groupName.trim();

  const isSelectedUser = useCallback(
    (userId) => selectedUsers.some((item) => item.id === userId),
    [selectedUsers]
  );

  const canGoNextFromStepOne = trimmedGroupName.length > 0;
  const canGoNextFromStepTwo = selectedUsers.length > 0;
  const canCreate = trimmedGroupName.length > 0 && selectedUsers.length > 0 && !isSubmitting;

  const availableUsers = useMemo(() => {
    const map = new Map();

    if (user?.id) map.set(user.id, user);
    lookupUsers.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });

    return Array.from(map.values());
  }, [lookupUsers, user]);

  const searchHint = useMemo(() => {
    if (!phone) return 'Введите номер телефона участника';
    if (status === 'too_short') return 'Минимум 9 цифр для поиска';
    if (status === 'loading') return 'Ищем пользователя...';
    if (status === 'not_found') return 'Пользователь не найден';
    if (status === 'rate_limited') return lookupError || 'Слишком много запросов, попробуйте позже';
    if (status === 'error') return lookupError || 'Ошибка поиска';
    if (status === 'found') return 'Пользователь найден, добавьте в группу';
    return '';
  }, [lookupError, phone, status]);

  const goToStep = useCallback((nextStep) => {
    if (nextStep === step) return;
    setDirection(nextStep > step ? 'forward' : 'backward');
    setStep(nextStep);
    setError('');
  }, [step]);

  const onNext = useCallback(() => {
    if (step === 1 && !canGoNextFromStepOne) {
      setError('Введите название группы');
      return;
    }

    if (step === 2 && !canGoNextFromStepTwo) {
      setError('Добавьте хотя бы одного участника');
      return;
    }

    goToStep(Math.min(3, step + 1));
  }, [canGoNextFromStepOne, canGoNextFromStepTwo, goToStep, step]);

  const onBack = useCallback(() => {
    goToStep(Math.max(1, step - 1));
  }, [goToStep, step]);

  const onPickAvatar = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const onAvatarChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
      setError('Выберите изображение для аватара');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Максимальный размер файла 5MB');
      return;
    }

    if (avatarPreviewUrl && avatarPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setError('');
  }, [avatarPreviewUrl]);

  const toggleUser = useCallback((nextUser) => {
    if (!nextUser?.id) return;

    setSelectedUsers((prev) => {
      const exists = prev.some((item) => item.id === nextUser.id);
      if (exists) {
        return prev.filter((item) => item.id !== nextUser.id);
      }
      setLastAddedUserId(nextUser.id);
      return [...prev, nextUser];
    });

    setError('');
  }, []);

  const createGroup = useCallback(async () => {
    if (!trimmedGroupName) {
      setError('Введите название группы');
      return;
    }

    if (!selectedUsers.length) {
      setError('Добавьте хотя бы одного участника');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch(`${API_URL}/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: trimmedGroupName,
          participantIds: selectedUsers.map((item) => item.id)
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Не удалось создать группу');
      }

      onGroupCreated?.(data);
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось создать группу');
    } finally {
      setIsSubmitting(false);
    }
  }, [onGroupCreated, selectedUsers, token, trimmedGroupName]);

  const onSearchKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' || status !== 'found' || !user?.id) return;

    event.preventDefault();
    toggleUser(user);
  }, [status, toggleUser, user]);

  const renderStepper = () => (
    <div className="wizard-stepper" aria-label="Шаги создания группы">
      {STEPS.map((item) => {
        const isActive = item === step;
        const isDone = item < step;

        return (
          <React.Fragment key={item}>
            <button
              type="button"
              className={`wizard-step-point ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
              onClick={() => {
                if (item <= step) goToStep(item);
              }}
              disabled={item > step}
              aria-label={`Шаг ${item}`}
            >
              {item}
            </button>
            {item < STEPS.length ? <span className={`wizard-step-link ${item < step ? 'done' : ''}`} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStepOne = () => (
    <section className="wizard-step step-one">
      <h2 className="wizard-title">Новая группа</h2>
      <p className="wizard-subtitle">Название и аватар</p>

      <div className="wizard-avatar-block">
        <div className="wizard-avatar-preview">
          {avatarPreviewUrl ? (
            <img src={avatarPreviewUrl} alt="Аватар группы" className="wizard-avatar-image" />
          ) : (
            <span className="wizard-avatar-fallback">{String(trimmedGroupName || 'G').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <button type="button" className="btn btn-secondary wizard-avatar-button" onClick={onPickAvatar}>
          <ImageIcon size={16} />
          {avatarFile ? 'Сменить аватар' : 'Выбрать аватар'}
        </button>
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="wizard-hidden-input"
        onChange={onAvatarChange}
      />

      <div className="wizard-field">
        <input
          id="group-name-input"
          className="wizard-input"
          type="text"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Введите название группы"
          maxLength={60}
        />
        <div className="wizard-counter">{trimmedGroupName.length}/60</div>
      </div>
    </section>
  );

  const renderStepTwo = () => (
    <section className="wizard-step">
      <h3 className="wizard-section-title">Участники</h3>
      <p className="wizard-section-subtitle">Добавьте людей по номеру телефона</p>

      <div className="wizard-search-box">
        <SearchIcon size={18} />
        <input
          id="group-member-phone"
          className="wizard-search-input"
          type="text"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Введите номер телефона"
        />
      </div>
      <div className="wizard-search-hint">{searchHint}</div>

      <div className="wizard-chip-list" aria-label="Выбранные участники">
        {selectedUsers.length === 0 ? (
          <div className="wizard-chip-empty">Участники еще не выбраны</div>
        ) : (
          selectedUsers.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`wizard-chip ${lastAddedUserId === item.id ? 'new' : ''}`}
              onClick={() => toggleUser(item)}
              aria-label={`Удалить ${item?.name || 'пользователя'}`}
            >
              <span className="wizard-chip-dot">{String(item?.name || '?').charAt(0).toUpperCase()}</span>
              <span className="wizard-chip-text">{item?.name || 'Пользователь'}</span>
              <span className="wizard-chip-remove">×</span>
            </button>
          ))
        )}
      </div>

      <div className="wizard-user-list-wrap">
        {availableUsers.length === 0 ? (
          <div className="wizard-user-list-empty">Список пользователей появится после поиска</div>
        ) : (
          <div className="wizard-user-list" role="listbox" aria-label="Результаты поиска">
            {availableUsers.map((item) => {
              const selected = isSelectedUser(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`wizard-user-row ${selected ? 'selected' : ''}`}
                  onClick={() => toggleUser(item)}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="wizard-user-avatar">{String(item?.name || '?').charAt(0).toUpperCase()}</span>
                  <span className="wizard-user-meta">
                    <span className="wizard-user-name">{item?.name || 'Пользователь'}</span>
                    <span className="wizard-user-action">{selected ? 'Добавлен' : 'Нажмите, чтобы добавить'}</span>
                  </span>
                  <span className="wizard-user-toggle">{selected ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );

  const renderStepThree = () => (
    <section className="wizard-step">
      <h3 className="wizard-section-title">Подтверждение</h3>
      <p className="wizard-section-subtitle">Проверьте данные перед созданием группы</p>

      <div className="wizard-summary">
        <div className="wizard-summary-main">
          <div className="wizard-avatar-preview small">
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="Аватар группы" className="wizard-avatar-image" />
            ) : (
              <span className="wizard-avatar-fallback">{String(trimmedGroupName || 'G').charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="wizard-summary-meta">
            <div className="wizard-summary-name">{trimmedGroupName || 'Без названия'}</div>
            <div className="wizard-summary-count">Участников: {selectedUsers.length}</div>
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
    </section>
  );

  const renderStepContent = () => {
    if (step === 1) return renderStepOne();
    if (step === 2) return renderStepTwo();
    return renderStepThree();
  };

  const nextButtonLabel = step === 2
    ? `Далее (${selectedUsers.length} участников)`
    : 'Далее';

  const isNextDisabled = step === 1 ? !canGoNextFromStepOne : !canGoNextFromStepTwo;

  return (
    <div className="group-modal-overlay" onClick={onClose}>
      <div className="group-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="group-modal-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        {renderStepper()}

        <div key={step} className={`wizard-step-content wizard-step-content-${direction}`}>
          {renderStepContent()}
        </div>

        {error ? <div className="wizard-error">{error}</div> : null}

        <footer className="wizard-footer">
          <button type="button" className="btn btn-ghost wizard-footer-btn" onClick={onClose}>
            Отмена
          </button>

          <div className="wizard-footer-actions">
            {step > 1 ? (
              <button type="button" className="btn btn-secondary wizard-footer-btn" onClick={onBack}>
                Назад
              </button>
            ) : null}

            {step < 3 ? (
              <button
                type="button"
                className="btn btn-primary wizard-footer-btn"
                onClick={onNext}
                disabled={isNextDisabled}
              >
                {nextButtonLabel}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary wizard-footer-btn"
                onClick={createGroup}
                disabled={!canCreate}
              >
                {isSubmitting ? 'Создаем...' : `Создать группу (${selectedUsers.length})`}
              </button>
            )}
          </div>
        </footer>

        <style>{`
          .group-modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 12000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(8px);
          }

          .group-modal {
            position: relative;
            width: min(680px, 92vw);
            max-height: 85vh;
            overflow-y: auto;
            border-radius: 20px;
            border: 1px solid var(--border-color);
            background:
              radial-gradient(circle at 8% 0%, rgba(79, 124, 255, 0.16), transparent 36%),
              radial-gradient(circle at 96% 8%, rgba(59, 130, 246, 0.14), transparent 34%),
              var(--bg-card);
            box-shadow: var(--shadow-xl);
            padding: 38px;
            animation: modalIn 240ms ease;
          }

          .group-modal-close {
            position: absolute;
            top: 14px;
            right: 14px;
            width: 34px;
            height: 34px;
            border-radius: 11px;
            border: 1px solid var(--border-color);
            background: rgba(15, 23, 42, 0.7);
            color: var(--text-secondary);
            font-size: 23px;
            line-height: 1;
            transition: var(--transition-fast);
          }

          .group-modal-close:hover {
            background: rgba(59, 130, 246, 0.14);
            color: var(--text-primary);
          }

          .wizard-stepper {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: var(--space-8);
            margin-bottom: 30px;
          }

          .wizard-step-point {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            border: 1px solid rgba(148, 163, 184, 0.42);
            background: rgba(15, 23, 42, 0.6);
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 700;
            transition: var(--transition-fast);
          }

          .wizard-step-point.active,
          .wizard-step-point.done {
            border-color: rgba(96, 165, 250, 0.7);
            background: rgba(79, 124, 255, 0.22);
            color: #dbeafe;
            box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.14);
          }

          .wizard-step-point:disabled {
            cursor: not-allowed;
            opacity: 0.75;
          }

          .wizard-step-link {
            width: 38px;
            height: 2px;
            background: rgba(148, 163, 184, 0.35);
            border-radius: 999px;
            transition: var(--transition-fast);
          }

          .wizard-step-link.done {
            background: rgba(79, 124, 255, 0.86);
          }

          .wizard-step-content {
            animation-duration: 220ms;
            animation-timing-function: ease;
            animation-fill-mode: both;
          }

          .wizard-step-content-forward {
            animation-name: stepSlideInRight;
          }

          .wizard-step-content-backward {
            animation-name: stepSlideInLeft;
          }

          .wizard-step {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .step-one {
            align-items: center;
            text-align: center;
            gap: 18px;
            min-height: 420px;
            justify-content: center;
          }

          .wizard-title {
            margin: 0;
            color: var(--text-primary);
            font-size: 34px;
            line-height: 1.1;
            font-weight: 820;
            letter-spacing: -0.015em;
          }

          .wizard-subtitle {
            margin: 0;
            color: var(--text-muted);
            font-size: 14px;
          }

          .wizard-section-title {
            margin: 0;
            color: var(--text-primary);
            font-size: 28px;
            line-height: 1.15;
            font-weight: 790;
            letter-spacing: -0.01em;
          }

          .wizard-section-subtitle {
            margin: 0;
            color: var(--text-muted);
            font-size: 14px;
          }

          .wizard-avatar-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }

          .wizard-avatar-preview {
            width: 104px;
            height: 104px;
            border-radius: 50%;
            border: 1px solid var(--border-color);
            background: linear-gradient(145deg, rgba(79, 124, 255, 0.3), rgba(59, 130, 246, 0.22));
            color: #e2e8f0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }

          .wizard-avatar-preview.small {
            width: 78px;
            height: 78px;
          }

          .wizard-avatar-fallback {
            font-size: 38px;
            font-weight: 800;
            line-height: 1;
          }

          .wizard-avatar-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .wizard-avatar-button {
            border-radius: 12px;
            min-width: 180px;
          }

          .wizard-hidden-input {
            display: none;
          }

          .wizard-field {
            width: 100%;
            max-width: 460px;
          }

          .wizard-input,
          .wizard-search-input {
            width: 100%;
            border: 1px solid var(--border-input);
            border-radius: 14px;
            background: rgba(2, 6, 23, 0.55);
            color: var(--text-primary);
            padding: 14px 16px;
            font-size: 15px;
            transition: var(--transition-normal);
          }

          .wizard-input::placeholder,
          .wizard-search-input::placeholder {
            color: #8092ad;
          }

          .wizard-input:focus,
          .wizard-search-box:focus-within {
            border-color: rgba(96, 165, 250, 0.65);
            box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.15);
          }

          .wizard-counter {
            margin-top: 8px;
            text-align: right;
            font-size: 12px;
            color: var(--text-muted);
          }

          .wizard-search-box {
            display: flex;
            align-items: center;
            gap: 10px;
            border: 1px solid var(--border-input);
            border-radius: 14px;
            background: rgba(2, 6, 23, 0.55);
            color: var(--text-muted);
            padding: 0 14px;
            margin-top: 8px;
          }

          .wizard-search-input {
            border: none;
            background: transparent;
            padding-left: 0;
          }

          .wizard-search-hint {
            min-height: 18px;
            margin-top: 6px;
            font-size: 12px;
            color: var(--text-muted);
          }

          .wizard-chip-list {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            min-height: 48px;
          }

          .wizard-chip-empty {
            width: 100%;
            border: 1px dashed var(--border-color);
            border-radius: 12px;
            background: rgba(15, 23, 42, 0.45);
            color: var(--text-muted);
            font-size: 13px;
            text-align: center;
            padding: 14px;
          }

          .wizard-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border: 1px solid rgba(96, 165, 250, 0.4);
            border-radius: 999px;
            background: rgba(79, 124, 255, 0.15);
            color: #dbeafe;
            padding: 6px 10px 6px 6px;
            transition: var(--transition-fast);
          }

          .wizard-chip.new {
            animation: chipIn 220ms ease;
          }

          .wizard-chip:hover {
            background: rgba(79, 124, 255, 0.22);
          }

          .wizard-chip-dot {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(79, 124, 255, 0.6);
            color: #f8fafc;
            font-size: 11px;
            font-weight: 700;
          }

          .wizard-chip-text {
            font-size: 12px;
            font-weight: 700;
            max-width: 160px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .wizard-chip-remove {
            font-size: 15px;
            line-height: 1;
          }

          .wizard-user-list-wrap {
            margin-top: 10px;
            border: 1px solid var(--border-color);
            border-radius: 14px;
            background: rgba(15, 23, 42, 0.45);
            min-height: 220px;
          }

          .wizard-user-list,
          .wizard-user-list-empty {
            max-height: 248px;
            overflow-y: auto;
          }

          .wizard-user-list-empty {
            color: var(--text-muted);
            font-size: 13px;
            text-align: center;
            padding: 22px;
          }

          .wizard-user-row {
            width: 100%;
            border: none;
            border-bottom: 1px solid var(--border-light);
            background: transparent;
            color: var(--text-primary);
            padding: 12px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            text-align: left;
            transition: var(--transition-fast);
          }

          .wizard-user-row:last-child {
            border-bottom: none;
          }

          .wizard-user-row:hover {
            background: rgba(59, 130, 246, 0.14);
          }

          .wizard-user-row.selected {
            background: rgba(79, 124, 255, 0.18);
          }

          .wizard-user-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(145deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.88));
            color: #eef2ff;
            font-size: 13px;
            font-weight: 800;
            flex-shrink: 0;
          }

          .wizard-user-meta {
            min-width: 0;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .wizard-user-name {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .wizard-user-action {
            font-size: 12px;
            color: var(--text-muted);
          }

          .wizard-user-toggle {
            width: 26px;
            height: 26px;
            border-radius: 50%;
            border: 1px solid rgba(148, 163, 184, 0.4);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #cbd5e1;
            font-size: 14px;
            font-weight: 700;
            flex-shrink: 0;
          }

          .wizard-summary {
            margin-top: 8px;
            border: 1px solid var(--border-color);
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.5);
            padding: 16px;
          }

          .wizard-summary-main {
            display: flex;
            align-items: center;
            gap: 14px;
            padding-bottom: 14px;
            margin-bottom: 14px;
            border-bottom: 1px solid var(--border-light);
          }

          .wizard-summary-meta {
            min-width: 0;
          }

          .wizard-summary-name {
            color: var(--text-primary);
            font-size: 20px;
            font-weight: 780;
          }

          .wizard-summary-count {
            margin-top: 3px;
            color: var(--text-muted);
            font-size: 13px;
          }

          .wizard-summary-members {
            max-height: 220px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .wizard-summary-member {
            display: flex;
            align-items: center;
            gap: 8px;
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

          .wizard-error {
            margin-top: 18px;
            border-radius: 12px;
            border: 1px solid rgba(248, 113, 113, 0.35);
            background: rgba(244, 63, 94, 0.12);
            color: #fecaca;
            font-size: 13px;
            font-weight: 600;
            padding: 10px 12px;
          }

          .wizard-footer {
            margin-top: 22px;
            border-top: 1px solid var(--border-light);
            padding-top: 18px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
          }

          .wizard-footer-actions {
            display: inline-flex;
            gap: 10px;
          }

          .wizard-footer-btn {
            min-width: 170px;
            border-radius: 12px;
          }

          @keyframes modalIn {
            from {
              opacity: 0;
              transform: scale(0.96);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes stepSlideInRight {
            from {
              opacity: 0;
              transform: translateX(18px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes stepSlideInLeft {
            from {
              opacity: 0;
              transform: translateX(-18px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes chipIn {
            from {
              opacity: 0;
              transform: translateY(4px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @media (max-width: 768px) {
            .group-modal {
              width: min(680px, 92vw);
              padding: 28px 18px;
              max-height: 88vh;
            }

            .wizard-title {
              font-size: 28px;
            }

            .wizard-section-title {
              font-size: 24px;
            }

            .wizard-footer {
              flex-direction: column;
              align-items: stretch;
            }

            .wizard-footer-actions {
              width: 100%;
              flex-direction: column-reverse;
            }

            .wizard-footer-btn {
              width: 100%;
              min-width: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default CreateGroupModal;
