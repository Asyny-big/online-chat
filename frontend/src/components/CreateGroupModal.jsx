import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/config';
import { usePhoneUserLookup } from '@/shared/hooks/usePhoneUserLookup';
import { SearchIcon, UserIcon } from '@/shared/ui/Icons';

function CreateGroupModal({ token, onClose, onGroupCreated }) {
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const { phone, setPhone, status, user, error: lookupError } = usePhoneUserLookup({
    token,
    minLen: 9,
    debounceMs: 400
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isAlreadySelected = useMemo(
    () => Boolean(user?.id && selectedUsers.some((item) => item.id === user.id)),
    [selectedUsers, user?.id]
  );

  const canCreate = groupName.trim().length > 0 && selectedUsers.length > 0 && !isCreating;

  const hintText = useMemo(() => {
    if (!phone) return 'Введите номер телефона, чтобы найти пользователя';
    if (status === 'too_short') return 'Номер должен содержать минимум 9 цифр';
    if (status === 'loading') return 'Ищем пользователя...';
    if (status === 'not_found') return 'Пользователь с таким номером не найден';
    if (status === 'rate_limited') return lookupError || 'Слишком много запросов. Попробуйте позже';
    if (status === 'error') return lookupError || 'Ошибка поиска';
    if (status === 'found' && isAlreadySelected) return 'Этот пользователь уже добавлен в группу';
    return '';
  }, [phone, status, lookupError, isAlreadySelected]);

  const handleSelectUser = useCallback(() => {
    if (!user?.id || isAlreadySelected) {
      setPhone('');
      return;
    }

    setSelectedUsers((prev) => [...prev, user]);
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
  }, [groupName, selectedUsers, token, onGroupCreated]);

  const handlePhoneKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' && status === 'found' && user && !isAlreadySelected) {
        event.preventDefault();
        handleSelectUser();
      }
    },
    [handleSelectUser, isAlreadySelected, status, user]
  );

  return (
    <div className="group-modal-overlay" onClick={onClose}>
      <div className="group-modal" onClick={(event) => event.stopPropagation()}>
        <div className="group-modal-header">
          <div>
            <h2 className="group-modal-title">Создание группы</h2>
            <p className="group-modal-subtitle">Соберите участников и запустите новый чат</p>
          </div>
          <button type="button" onClick={onClose} className="group-close-btn" aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="group-progress-row">
          <div className={`group-step ${groupName.trim() ? 'done' : 'active'}`}>
            <span className="group-step-index">1</span>
            <span className="group-step-label">Название</span>
          </div>
          <div className={`group-step ${selectedUsers.length > 0 ? 'done' : 'active'}`}>
            <span className="group-step-index">2</span>
            <span className="group-step-label">Участники</span>
          </div>
        </div>

        <div className="group-modal-body">
          <section className="group-left-col">
            <div className="group-field-block">
              <label className="group-label" htmlFor="group-name-input">Название группы</label>
              <input
                id="group-name-input"
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Например: Команда проекта"
                maxLength={60}
                className="group-input"
              />
              <div className="group-inline-meta">{groupName.trim().length || 0}/60</div>
            </div>

            <div className="group-field-block">
              <label className="group-label" htmlFor="group-phone-input">Поиск участника по номеру</label>
              <div className="group-search-wrap">
                <SearchIcon size={16} />
                <input
                  id="group-phone-input"
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  placeholder="Введите номер телефона"
                  className="group-search-input"
                />
              </div>
              <div className="group-hint">{hintText}</div>
            </div>

            {status === 'found' && user ? (
              <div className="group-search-result">
                <div className="group-result-avatar">{String(user?.name || '?').charAt(0).toUpperCase()}</div>
                <div className="group-result-main">
                  <div className="group-result-name">{user?.name || 'Пользователь'}</div>
                  <div className="group-result-phone">{phone}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary group-add-btn"
                  onClick={handleSelectUser}
                  disabled={isAlreadySelected}
                >
                  {isAlreadySelected ? 'Уже в группе' : 'Добавить'}
                </button>
              </div>
            ) : null}

            {error ? <div className="group-error">{error}</div> : null}
          </section>

          <aside className="group-right-col">
            <div className="group-right-top">
              <div className="group-participants-title">Участники ({selectedUsers.length})</div>
              {selectedUsers.length > 0 ? (
                <button
                  type="button"
                  className="group-clear-btn"
                  onClick={() => setSelectedUsers([])}
                >
                  Очистить
                </button>
              ) : null}
            </div>

            {selectedUsers.length === 0 ? (
              <div className="group-empty-state">
                <div className="group-empty-icon">
                  <UserIcon size={20} />
                </div>
                <div className="group-empty-title">Пока пусто</div>
                <div className="group-empty-text">Добавьте участников через поле поиска слева</div>
              </div>
            ) : (
              <div className="group-members-list">
                {selectedUsers.map((item) => (
                  <div key={item.id} className="group-member-row">
                    <div className="group-member-avatar">{String(item?.name || '?').charAt(0).toUpperCase()}</div>
                    <div className="group-member-meta">
                      <div className="group-member-name">{item?.name || 'Пользователь'}</div>
                    </div>
                    <button
                      type="button"
                      className="group-remove-btn"
                      onClick={() => handleRemoveUser(item.id)}
                      aria-label="Удалить участника"
                    >
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>

        <div className="group-modal-footer">
          <button type="button" className="btn btn-ghost group-footer-btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary group-footer-btn"
            onClick={handleCreateGroup}
            disabled={!canCreate}
          >
            {isCreating ? 'Создаем...' : 'Создать группу'}
          </button>
        </div>

        <style>{`
          .group-modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.78);
            backdrop-filter: blur(8px);
            z-index: 11000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-16);
          }

          .group-modal {
            width: min(920px, 96vw);
            max-height: 88vh;
            display: flex;
            flex-direction: column;
            border-radius: var(--radius-modal);
            border: 1px solid var(--border-color);
            background:
              radial-gradient(circle at 12% 0%, rgba(59, 130, 246, 0.16), transparent 38%),
              radial-gradient(circle at 92% 3%, rgba(99, 102, 241, 0.16), transparent 32%),
              var(--bg-card);
            box-shadow: var(--shadow-xl);
            overflow: hidden;
          }

          .group-modal-header {
            padding: var(--space-20) var(--space-24) var(--space-14);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: var(--space-12);
          }

          .group-modal-title {
            margin: 0;
            font-size: 28px;
            font-weight: 820;
            color: var(--text-primary);
            letter-spacing: -0.01em;
          }

          .group-modal-subtitle {
            margin-top: var(--space-6);
            color: var(--text-muted);
            font-size: 14px;
          }

          .group-close-btn {
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

          .group-close-btn:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
            transform: translateY(-1px);
          }

          .group-progress-row {
            display: flex;
            gap: var(--space-10);
            padding: var(--space-14) var(--space-24) var(--space-12);
            border-bottom: 1px solid var(--border-light);
          }

          .group-step {
            display: inline-flex;
            align-items: center;
            gap: var(--space-8);
            padding: var(--space-8) var(--space-12);
            border-radius: var(--radius-pill);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            background: rgba(15, 23, 42, 0.5);
          }

          .group-step.active {
            color: var(--text-secondary);
          }

          .group-step.done {
            color: #dbeafe;
            border-color: rgba(96, 165, 250, 0.38);
            background: rgba(59, 130, 246, 0.15);
          }

          .group-step-index {
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 800;
            background: rgba(148, 163, 184, 0.2);
          }

          .group-step.done .group-step-index {
            background: rgba(59, 130, 246, 0.45);
            color: #eff6ff;
          }

          .group-step-label {
            font-size: 13px;
            font-weight: 700;
          }

          .group-modal-body {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            min-height: 0;
            flex: 1;
          }

          .group-left-col,
          .group-right-col {
            min-height: 0;
            overflow: auto;
            padding: var(--space-18) var(--space-24);
          }

          .group-left-col {
            border-right: 1px solid var(--border-light);
          }

          .group-field-block + .group-field-block {
            margin-top: var(--space-16);
          }

          .group-label {
            display: block;
            margin-bottom: var(--space-8);
            color: var(--text-secondary);
            font-size: 12px;
            letter-spacing: 0.07em;
            text-transform: uppercase;
            font-weight: 800;
          }

          .group-input,
          .group-search-input {
            width: 100%;
            border-radius: 14px;
            border: 1px solid var(--border-input);
            background: rgba(2, 6, 23, 0.52);
            color: var(--text-primary);
            padding: 13px 14px;
            transition: var(--transition-normal);
          }

          .group-search-wrap {
            display: flex;
            align-items: center;
            gap: var(--space-8);
            border-radius: 14px;
            border: 1px solid var(--border-input);
            background: rgba(2, 6, 23, 0.52);
            color: var(--text-muted);
            padding: 0 12px;
          }

          .group-search-input {
            border: none;
            background: transparent;
            padding-left: 0;
          }

          .group-input:focus,
          .group-search-wrap:focus-within {
            border-color: rgba(99, 102, 241, 0.56);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.14);
          }

          .group-inline-meta {
            margin-top: var(--space-6);
            color: var(--text-muted);
            font-size: 12px;
            text-align: right;
          }

          .group-hint {
            margin-top: var(--space-6);
            min-height: 18px;
            color: var(--text-muted);
            font-size: 12px;
          }

          .group-search-result {
            margin-top: var(--space-14);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            background: rgba(15, 23, 42, 0.66);
            display: flex;
            align-items: center;
            gap: var(--space-12);
            padding: var(--space-10);
          }

          .group-result-avatar,
          .group-member-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.9));
            color: #eef2ff;
            font-size: 16px;
            font-weight: 800;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .group-result-main,
          .group-member-meta {
            min-width: 0;
            flex: 1;
          }

          .group-result-name,
          .group-member-name {
            color: var(--text-primary);
            font-weight: 720;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .group-result-phone {
            color: var(--text-muted);
            font-size: 12px;
            margin-top: 2px;
          }

          .group-add-btn {
            min-width: 110px;
            border-radius: 12px;
            padding-inline: 12px;
          }

          .group-error {
            margin-top: var(--space-14);
            border: 1px solid rgba(248, 113, 113, 0.35);
            border-radius: 12px;
            background: rgba(244, 63, 94, 0.12);
            color: #fecaca;
            font-size: 13px;
            font-weight: 600;
            padding: var(--space-10) var(--space-12);
          }

          .group-right-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--space-10);
            margin-bottom: var(--space-12);
          }

          .group-participants-title {
            color: var(--text-primary);
            font-size: 15px;
            font-weight: 760;
          }

          .group-clear-btn {
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 700;
            border: 1px solid var(--border-color);
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.45);
            padding: 7px 10px;
            transition: var(--transition-normal);
          }

          .group-clear-btn:hover {
            color: var(--text-primary);
            background: var(--bg-hover);
          }

          .group-empty-state {
            border: 1px dashed var(--border-color);
            border-radius: 14px;
            padding: var(--space-20) var(--space-14);
            text-align: center;
            color: var(--text-muted);
          }

          .group-empty-icon {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            margin: 0 auto var(--space-10);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(15, 23, 42, 0.58);
            border: 1px solid var(--border-color);
          }

          .group-empty-title {
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 700;
          }

          .group-empty-text {
            margin-top: var(--space-6);
            font-size: 12px;
          }

          .group-members-list {
            display: flex;
            flex-direction: column;
            gap: var(--space-8);
          }

          .group-member-row {
            display: flex;
            align-items: center;
            gap: var(--space-10);
            padding: var(--space-8);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            background: rgba(2, 6, 23, 0.35);
          }

          .group-remove-btn {
            color: #fca5a5;
            font-size: 12px;
            font-weight: 700;
            border: 1px solid rgba(248, 113, 113, 0.3);
            border-radius: 9px;
            background: rgba(15, 23, 42, 0.62);
            padding: 6px 10px;
            transition: var(--transition-normal);
          }

          .group-remove-btn:hover {
            background: rgba(239, 68, 68, 0.16);
            color: #fecaca;
          }

          .group-modal-footer {
            border-top: 1px solid var(--border-color);
            padding: var(--space-14) var(--space-24);
            display: flex;
            justify-content: flex-end;
            gap: var(--space-10);
            background: rgba(10, 15, 27, 0.75);
          }

          .group-footer-btn {
            min-width: 148px;
            border-radius: 12px;
            height: 42px;
          }

          @media (max-width: 900px) {
            .group-modal {
              width: min(700px, 96vw);
            }

            .group-modal-body {
              grid-template-columns: 1fr;
            }

            .group-left-col {
              border-right: none;
              border-bottom: 1px solid var(--border-light);
            }
          }

          @media (max-width: 640px) {
            .group-modal-overlay {
              padding: var(--space-8);
            }

            .group-modal {
              width: 100%;
              max-height: 95vh;
            }

            .group-modal-title {
              font-size: 22px;
            }

            .group-modal-header,
            .group-progress-row,
            .group-left-col,
            .group-right-col,
            .group-modal-footer {
              padding-left: var(--space-14);
              padding-right: var(--space-14);
            }

            .group-modal-footer {
              flex-direction: column-reverse;
            }

            .group-footer-btn {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

export default CreateGroupModal;
