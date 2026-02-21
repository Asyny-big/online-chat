import React, { useCallback, useEffect, useMemo } from 'react';
import { useTasks, useTransactions, useWallet } from '@/domains/hrum/store/EconomyStore';
import { HrumIcon } from '@/domains/hrum/components/HrumIcon';
import { useHrumToast } from '@/components/HrumToast';

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function statusUi(status) {
  const s = String(status || '');
  if (s === 'claimed') return { label: 'Награда получена', fg: '#ddd6fe', bg: 'rgba(168,85,247,0.12)', bd: 'rgba(168,85,247,0.28)' };
  if (s === 'completed') return { label: 'Выполнено', fg: '#bbf7d0', bg: 'rgba(34,197,94,0.10)', bd: 'rgba(34,197,94,0.22)' };
  if (s === 'in_progress') return { label: 'В процессе', fg: '#fde68a', bg: 'rgba(234,179,8,0.10)', bd: 'rgba(234,179,8,0.25)' };
  return { label: 'Доступно', fg: '#bfdbfe', bg: 'rgba(59,130,246,0.10)', bd: 'rgba(59,130,246,0.22)' };
}

function TaskSkeleton() {
  return (
    <div style={styles.taskCard}>
      <div style={styles.skelLineWide} />
      <div style={{ ...styles.skelLine, width: '80%' }} />
      <div style={{ ...styles.skelLine, width: '55%' }} />
      <div style={styles.skelBar} />
      <div style={{ ...styles.skelLine, width: 120 }} />
    </div>
  );
}

export default function TasksPanel({ mode = 'full', onOpenAll }) {
  const wallet = useWallet();
  const tasks = useTasks();
  const transactions = useTransactions();
  const { showEarn, showInfo, showError } = useHrumToast();

  useEffect(() => {
    if (tasks.items.length === 0 && !tasks.loading && !tasks.error) tasks.refresh();
  }, [tasks]);

  const visible = useMemo(() => {
    if (mode === 'preview') return tasks.items.slice(0, 2);
    return tasks.items;
  }, [tasks.items, mode]);

  const claim = useCallback(
    async (taskId) => {
      try {
        const res = await tasks.claim(taskId);
        if (!res) return;
        if (res?.claimed && res?.amountHrum) showEarn({ amountHrum: res.amountHrum });
        else if (res?.reason === 'already_claimed') showInfo('Уже получено');
        else if (res?.claimed === false) showInfo('Награда не начислена');
        await Promise.all([tasks.refresh(), transactions.refresh(), wallet.refresh()]);
      } catch (e) {
        if (String(e?.message) === 'task_not_completed') showInfo('Задание ещё не выполнено');
        else if (String(e?.message) === 'cooldown_active' || e?.status === 429) showInfo('Пока недоступно — попробуйте позже');
        else showError('Ошибка получения награды');
      }
    },
    [tasks, transactions, wallet, showEarn, showError, showInfo]
  );

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.titleRow}>
          <div style={styles.iconWrap}>✓</div>
          <div>
            <div style={styles.kicker}>Quests</div>
            <div style={styles.title}>Задания</div>
          </div>
        </div>
        <div style={styles.headerActions}>
          {mode === 'preview' ? (
            <button type="button" onClick={onOpenAll} style={styles.ghostBtn}>
              Все задания
            </button>
          ) : (
            <button type="button" onClick={tasks.refresh} style={styles.ghostBtn} disabled={tasks.loading}>
              Обновить
            </button>
          )}
        </div>
      </div>

      {tasks.loading && tasks.items.length === 0 ? (
        <div style={styles.tasksGrid}>
          {Array.from({ length: mode === 'preview' ? 2 : 6 }).map((_, i) => (
            <TaskSkeleton key={i} />
          ))}
        </div>
      ) : tasks.error ? (
        <div style={styles.errorBox}>
          <div style={styles.errorTitle}>Не удалось загрузить задания</div>
          <button type="button" onClick={tasks.refresh} style={styles.primaryBtn}>
            Повторить
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div style={styles.emptyBox}>Пока нет заданий</div>
      ) : (
        <div style={styles.tasksGrid}>
          {visible.map((t) => {
            const id = String(t?.id || '');
            const title = t?.title || id || '—';
            const desc = t?.description || '';
            const rewardHrum = String(t?.rewardHrum ?? '—');
            const current = Number(t?.progressCurrent) || 0;
            const total = Number(t?.progressTotal) || 1;
            const pct = clamp01(total > 0 ? current / total : 0);
            const status = statusUi(t?.status);
            const canClaim = !!t?.canClaim;
            const isClaiming = tasks.claimingTaskId === id;
            const claimDisabled = !canClaim || isClaiming;

            return (
              <div key={id} style={styles.taskCard}>
                <div style={styles.taskTop}>
                  <div style={styles.taskTitle}>{title}</div>
                  <div style={{ ...styles.statusPill, color: status.fg, background: status.bg, borderColor: status.bd }}>
                    {status.label}
                  </div>
                </div>
                {desc ? <div style={styles.taskDesc}>{desc}</div> : null}

                <div style={styles.rewardRow}>
                  <HrumIcon size={16} />
                  <div style={styles.rewardText}>
                    Награда: <span style={styles.rewardValue}>{rewardHrum}</span>
                  </div>
                </div>

                <div style={styles.progressRow}>
                  <div style={styles.progressMeta}>
                    Прогресс: {Math.min(current, total)}/{total}
                  </div>
                  <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${pct * 100}%` }} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => claim(id)}
                  style={{ ...styles.primaryBtn, ...(claimDisabled ? styles.btnDisabled : null) }}
                  disabled={claimDisabled}
                  title={claimDisabled ? 'Сначала выполните задание' : 'Забрать награду'}
                >
                  {isClaiming ? 'Получаем…' : canClaim ? 'Забрать награду' : 'Недоступно'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {mode === 'preview' ? (
        <div style={styles.hint}>Статусы и прогресс приходят с backend. Никаких локальных “completion” флагов.</div>
      ) : (
        <div style={styles.hint}>
          Баланс: <span style={styles.hintStrong}>{String(wallet.balanceHrum ?? '0')}</span> <span style={styles.hintMuted}>Хрумов</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    borderRadius: 22,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(15,23,42,0.55)',
    boxShadow: '0 14px 40px rgba(0,0,0,0.38)',
    backdropFilter: 'blur(12px)',
    padding: 18
  },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  titleRow: { display: 'flex', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.16), rgba(99,102,241,0.16))',
    color: '#e2e8f0',
    fontWeight: 950
  },
  kicker: { color: '#94a3b8', fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { color: '#e2e8f0', fontWeight: 950, fontSize: 18, letterSpacing: 0.2 },
  headerActions: { display: 'flex', gap: 10 },
  ghostBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.16)',
    background: 'rgba(2,6,23,0.35)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 900
  },

  tasksGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 },
  taskCard: {
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,6,23,0.28)',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  taskTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  taskTitle: { color: '#e2e8f0', fontWeight: 950, fontSize: 14, lineHeight: 1.2 },
  statusPill: { padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.16)', fontWeight: 900, fontSize: 12 },
  taskDesc: { color: '#94a3b8', fontWeight: 750, fontSize: 12, lineHeight: 1.35 },
  rewardRow: { display: 'flex', alignItems: 'center', gap: 8 },
  rewardText: { color: '#cbd5e1', fontWeight: 900, fontSize: 12 },
  rewardValue: { color: '#e2e8f0', fontWeight: 950 },

  progressRow: { display: 'flex', flexDirection: 'column', gap: 8 },
  progressMeta: { color: '#94a3b8', fontWeight: 900, fontSize: 12 },
  progressBar: {
    height: 10,
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.12)',
    background: 'rgba(2,6,23,0.35)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(168,85,247,0.95), rgba(99,102,241,0.95))',
    transition: 'width 0.22s ease'
  },

  primaryBtn: {
    height: 40,
    padding: '0 12px',
    borderRadius: 12,
    border: '1px solid rgba(168,85,247,0.35)',
    background: 'linear-gradient(135deg, rgba(168,85,247,0.95), rgba(99,102,241,0.95))',
    color: '#fff',
    fontWeight: 950,
    cursor: 'pointer'
  },
  btnDisabled: { opacity: 0.55, cursor: 'not-allowed', filter: 'grayscale(0.2)' },

  errorBox: {
    borderRadius: 18,
    border: '1px solid rgba(239,68,68,0.25)',
    background: 'rgba(239,68,68,0.08)',
    padding: 14,
    color: '#fecaca',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  errorTitle: { fontWeight: 950 },
  emptyBox: {
    borderRadius: 18,
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,6,23,0.18)',
    padding: 14,
    color: '#94a3b8',
    fontWeight: 900,
    fontSize: 12
  },

  hint: { marginTop: 12, color: '#94a3b8', fontWeight: 800, fontSize: 12, lineHeight: 1.35 },
  hintStrong: { color: '#e2e8f0', fontWeight: 950 },
  hintMuted: { color: '#94a3b8', fontWeight: 900 },

  skelLine: {
    height: 12,
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
    backgroundSize: '200% 100%',
    animation: 'ppShimmer 1.15s ease-in-out infinite'
  },
  skelLineWide: {
    height: 12,
    width: '70%',
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(148,163,184,0.12), rgba(148,163,184,0.2), rgba(148,163,184,0.12))',
    backgroundSize: '200% 100%',
    animation: 'ppShimmer 1.15s ease-in-out infinite'
  },
  skelBar: {
    height: 10,
    borderRadius: 999,
    background: 'rgba(148,163,184,0.14)'
  }
};
