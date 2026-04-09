import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ImageIcon, MessageIcon, SearchIcon, UserIcon } from '@/shared/ui/Icons';
import FAQItem from './FAQItem';
import { FAQ_CATEGORIES, FAQ_QUESTIONS, FAQ_SUPPORT_HINTS } from '@/domains/profile/data/faqQuestions';

const CATEGORY_ICONS = {
  all: MessageIcon,
  messages: MessageIcon,
  account: UserIcon,
  files: ImageIcon,
  search: SearchIcon
};

function SupportIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.4 20.4c.8.4 1.7.6 2.6.6 4 0 7.2-3.2 7.2-7.2S16 6.6 12 6.6 4.8 9.8 4.8 13.8c0 1.1.2 2.1.7 3.1L4 21l5.4-.6Z" />
      <path d="M9.8 12.2a2.2 2.2 0 0 1 4.4 0c0 1.5-2.2 1.8-2.2 3.4" />
      <path d="M12 18.2h.01" />
    </svg>
  );
}

export default function FAQPage({ onOpenSupportChat }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openIds, setOpenIds] = useState(() => new Set(['create-chat']));
  const deferredQuery = useDeferredValue(searchQuery);

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const categoryCounts = useMemo(
    () =>
      FAQ_CATEGORIES.reduce((accumulator, category) => {
        accumulator[category.id] = category.id === 'all'
          ? FAQ_QUESTIONS.length
          : FAQ_QUESTIONS.filter((question) => question.category === category.id).length;
        return accumulator;
      }, {}),
    []
  );

  const filteredQuestions = useMemo(
    () =>
      FAQ_QUESTIONS.filter((question) => {
        const matchesCategory = activeCategory === 'all' || question.category === activeCategory;
        const matchesQuery = !normalizedQuery || question.searchIndex.includes(normalizedQuery);
        return matchesCategory && matchesQuery;
      }),
    [activeCategory, normalizedQuery]
  );

  useEffect(() => {
    if (!normalizedQuery || filteredQuestions.length === 0) return;
    setOpenIds((current) => {
      if (filteredQuestions.some((question) => current.has(question.id))) return current;
      return new Set([filteredQuestions[0].id]);
    });
  }, [filteredQuestions, normalizedQuery]);

  const handleToggle = (questionId) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const activeCategoryMeta = FAQ_CATEGORIES.find((category) => category.id === activeCategory) || FAQ_CATEGORIES[0];

  return (
    <section className="faq-page" aria-label="FAQ GovChat">
      <div className="faq-hero-card">
        <div>
          <div className="faq-badge">
            <SupportIcon size={16} />
            <span>Помощь / FAQ</span>
          </div>
          <h2 className="faq-hero-title">Быстрые ответы по GovChat</h2>
          <p className="faq-hero-text">
            Поиск, категории, раскрывающиеся ответы и прямой переход в чат поддержки в одном месте.
          </p>
        </div>

        <div className="faq-stats" aria-label="Статистика FAQ">
          <div className="faq-stat-card">
            <strong>{FAQ_QUESTIONS.length}</strong>
            <span>вопросов</span>
          </div>
          <div className="faq-stat-card">
            <strong>{FAQ_CATEGORIES.length - 1}</strong>
            <span>категории</span>
          </div>
          <div className="faq-stat-card">
            <strong>24/7</strong>
            <span>поддержка</span>
          </div>
        </div>
      </div>

      <div className="faq-search-card">
        <label className="faq-search-field">
          <SearchIcon size={18} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по вопросам и ключевым словам"
            aria-label="Поиск по FAQ"
          />
        </label>
        <div className="faq-search-meta">
          <span>Категория: <strong>{activeCategoryMeta.label}</strong></span>
          <span>Найдено: <strong>{filteredQuestions.length}</strong></span>
        </div>
      </div>

      <div className="faq-layout">
        <aside className="faq-sidebar">
          <div className="faq-card">
            <div className="faq-card-title">
              <SupportIcon size={18} />
              <h3>Категории</h3>
            </div>
            <div className="faq-category-list" role="tablist" aria-label="Категории FAQ">
              {FAQ_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.id] || MessageIcon;
                const active = category.id === activeCategory;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`faq-category-button ${active ? 'is-active' : ''}`}
                    onClick={() => setActiveCategory(category.id)}
                    role="tab"
                    aria-selected={active}
                  >
                    <span className="faq-category-icon"><Icon size={16} /></span>
                    <span className="faq-category-copy">
                      <span className="faq-category-label">{category.label}</span>
                      <span className="faq-category-description">{category.description}</span>
                    </span>
                    <span className="faq-category-count">{categoryCounts[category.id] || 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="faq-card faq-support-card">
            <div className="faq-card-title">
              <SupportIcon size={18} />
              <h3>Задать вопрос</h3>
            </div>
            <p className="faq-support-text">
              Если ответа не хватило, откройте системный чат поддержки GovChat.
            </p>
            <ul className="faq-support-hints">
              {FAQ_SUPPORT_HINTS.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
            <button type="button" className="btn btn-primary faq-support-btn" onClick={onOpenSupportChat}>
              <SupportIcon size={16} />
              <span>Открыть чат поддержки</span>
            </button>
          </div>
        </aside>

        <div className="faq-main">
          {filteredQuestions.length > 0 ? (
            <div className="faq-list">
              {filteredQuestions.map((question) => {
                const category = FAQ_CATEGORIES.find((item) => item.id === question.category);
                return (
                  <FAQItem
                    key={question.id}
                    item={question}
                    expanded={openIds.has(question.id)}
                    onToggle={handleToggle}
                    categoryLabel={category?.label || 'FAQ'}
                  />
                );
              })}
            </div>
          ) : (
            <div className="faq-empty-state">
              <div className="faq-empty-icon">
                <SearchIcon size={20} />
              </div>
              <h3>Ничего не найдено</h3>
              <p>Попробуйте другой запрос или сразу откройте чат поддержки.</p>
              <button type="button" className="btn btn-secondary" onClick={onOpenSupportChat}>
                Не помогло? Написать в поддержку
              </button>
            </div>
          )}

          <div className="faq-inline-support">
            <div>
              <span className="faq-inline-label">Не помогло?</span>
              <h3>Перейдите в чат поддержки</h3>
              <p>Опишите проблему простыми словами и приложите текст ошибки, если он есть.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={onOpenSupportChat}>
              <SupportIcon size={16} />
              <span>Написать в поддержку</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .faq-page { display: grid; gap: var(--space-16); }
        .faq-hero-card,
        .faq-search-card,
        .faq-card,
        .faq-item,
        .faq-inline-support,
        .faq-empty-state {
          border: 1px solid var(--border-color);
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(11, 18, 32, 0.94), rgba(15, 23, 42, 0.84)), var(--bg-card);
          box-shadow: var(--shadow-lg);
        }
        .faq-hero-card {
          display: flex;
          justify-content: space-between;
          gap: var(--space-20);
          padding: clamp(20px, 3vw, 28px);
          background:
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.22), transparent 30%),
            linear-gradient(180deg, rgba(11, 18, 32, 0.96), rgba(15, 23, 42, 0.88)),
            var(--bg-card);
        }
        .faq-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(79, 124, 255, 0.14);
          border: 1px solid rgba(96, 165, 250, 0.24);
          color: #dbeafe;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .faq-hero-title {
          margin: var(--space-12) 0 var(--space-8);
          color: var(--text-primary);
          font-size: clamp(28px, 4vw, 36px);
          letter-spacing: -0.03em;
          line-height: 1.05;
        }
        .faq-hero-text,
        .faq-support-text,
        .faq-inline-support p,
        .faq-empty-state p { margin: 0; color: var(--text-secondary); font-size: 14px; }
        .faq-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(88px, 1fr));
          gap: var(--space-10);
          min-width: min(340px, 100%);
        }
        .faq-stat-card {
          display: grid;
          gap: 4px;
          padding: 16px;
          border-radius: 18px;
          background: rgba(8, 15, 27, 0.54);
          border: 1px solid rgba(148, 163, 184, 0.14);
          transition: transform var(--transition-normal), border-color var(--transition-normal);
        }
        .faq-stat-card:hover { transform: translateY(-2px); border-color: rgba(96, 165, 250, 0.26); }
        .faq-stat-card strong { color: var(--text-primary); font-size: 24px; font-weight: 800; }
        .faq-stat-card span { color: var(--text-muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .faq-search-card { display: grid; gap: var(--space-12); padding: var(--space-16); }
        .faq-search-field {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 0 16px;
          border-radius: 18px;
          background: rgba(6, 11, 21, 0.84);
          border: 1px solid rgba(148, 163, 184, 0.14);
          color: var(--text-muted);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .faq-search-field:focus-within { border-color: rgba(96, 165, 250, 0.46); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12); }
        .faq-search-field input { width: 100%; min-width: 0; color: var(--text-primary); font-size: 15px; }
        .faq-search-field input::placeholder { color: var(--text-muted); }
        .faq-search-meta { display: flex; justify-content: space-between; gap: var(--space-12); flex-wrap: wrap; color: var(--text-muted); font-size: 13px; font-weight: 600; }
        .faq-layout { display: grid; grid-template-columns: minmax(240px, 280px) minmax(0, 1fr); gap: var(--space-16); align-items: start; }
        .faq-sidebar { display: grid; gap: var(--space-12); position: sticky; top: calc(var(--space-16) + 8px); }
        .faq-card { display: grid; gap: var(--space-14); padding: var(--space-16); }
        .faq-card-title { display: flex; align-items: center; gap: 10px; color: var(--text-primary); }
        .faq-card-title h3,
        .faq-inline-support h3,
        .faq-empty-state h3 { margin: 0; font-size: 18px; font-weight: 780; color: var(--text-primary); }
        .faq-category-list,
        .faq-list { display: grid; gap: 10px; }
        .faq-category-button {
          width: 100%;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          text-align: left;
          background: rgba(8, 15, 27, 0.54);
          border: 1px solid rgba(148, 163, 184, 0.12);
          color: var(--text-secondary);
          transition: transform var(--transition-normal), border-color var(--transition-normal), background-color var(--transition-normal);
        }
        .faq-category-button:hover { transform: translateY(-1px); border-color: rgba(96, 165, 250, 0.24); }
        .faq-category-button.is-active {
          background: linear-gradient(145deg, rgba(25, 55, 115, 0.9), rgba(20, 31, 54, 0.96));
          border-color: rgba(96, 165, 250, 0.34);
          color: #eff6ff;
        }
        .faq-category-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(79, 124, 255, 0.14);
          color: #bfdbfe;
        }
        .faq-category-copy { min-width: 0; display: grid; gap: 2px; }
        .faq-category-label { font-size: 14px; font-weight: 760; }
        .faq-category-description { color: var(--text-muted); font-size: 12px; }
        .faq-category-count {
          min-width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.12);
          font-size: 12px;
          font-weight: 800;
        }
        .faq-support-card { background: radial-gradient(circle at top right, rgba(79, 124, 255, 0.18), transparent 30%), linear-gradient(180deg, rgba(11, 18, 32, 0.96), rgba(13, 20, 34, 0.9)), var(--bg-card); }
        .faq-support-hints { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
        .faq-support-hints li { position: relative; padding-left: 16px; color: var(--text-secondary); font-size: 13px; }
        .faq-support-hints li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #60a5fa;
          box-shadow: 0 0 0 5px rgba(96, 165, 250, 0.12);
        }
        .faq-support-btn { width: 100%; }
        .faq-main { display: grid; gap: var(--space-14); }
        .faq-item {
          overflow: hidden;
          transition: transform var(--transition-normal), border-color var(--transition-normal), box-shadow var(--transition-normal);
        }
        .faq-item:hover { transform: translateY(-2px); border-color: rgba(96, 165, 250, 0.28); box-shadow: 0 18px 34px rgba(2, 6, 23, 0.32); }
        .faq-item.is-open { border-color: rgba(96, 165, 250, 0.34); }
        .faq-trigger {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          padding: 18px 20px;
          text-align: left;
        }
        .faq-meta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
        .faq-category-pill,
        .faq-keyword-pill {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }
        .faq-category-pill { background: rgba(79, 124, 255, 0.16); border: 1px solid rgba(96, 165, 250, 0.24); color: #bfdbfe; }
        .faq-keyword-pill { background: rgba(148, 163, 184, 0.1); border: 1px solid rgba(148, 163, 184, 0.12); color: var(--text-muted); }
        .faq-question-title { margin: 0; color: var(--text-primary); font-size: 19px; font-weight: 780; letter-spacing: -0.01em; }
        .faq-question-summary { margin: 8px 0 0; color: var(--text-secondary); font-size: 14px; }
        .faq-chevron {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: rgba(148, 163, 184, 0.08);
          border: 1px solid rgba(148, 163, 184, 0.12);
          color: var(--text-muted);
          transition: transform var(--transition-normal), color var(--transition-normal);
        }
        .faq-item.is-open .faq-chevron { transform: rotate(180deg); color: #dbeafe; }
        .faq-answer-shell { display: grid; grid-template-rows: 0fr; transition: grid-template-rows var(--transition-normal); }
        .faq-item.is-open .faq-answer-shell { grid-template-rows: 1fr; }
        .faq-answer-panel { min-height: 0; overflow: hidden; padding: 0 20px; }
        .faq-item.is-open .faq-answer-panel { padding-bottom: 20px; }
        .faq-answer-text { margin: 0; color: var(--text-secondary); font-size: 14px; }
        .faq-answer-list { margin: 14px 0 0; padding-left: 18px; display: grid; gap: 10px; color: var(--text-secondary); font-size: 14px; }
        .faq-answer-list--ordered li::marker { color: #93c5fd; font-weight: 800; }
        .faq-inline-support,
        .faq-empty-state { display: grid; gap: 12px; padding: 20px; }
        .faq-inline-support {
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: var(--space-16);
        }
        .faq-inline-label { color: #93c5fd; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
        .faq-empty-icon {
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: rgba(79, 124, 255, 0.16);
          color: #bfdbfe;
        }
        @media (max-width: 960px) {
          .faq-layout { grid-template-columns: 1fr; }
          .faq-sidebar { position: static; }
        }
        @media (max-width: 768px) {
          .faq-hero-card,
          .faq-inline-support { grid-template-columns: 1fr; display: grid; }
          .faq-stats { min-width: 0; }
          .faq-category-list { grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); overflow-x: auto; }
          .faq-trigger { padding: 16px; }
          .faq-answer-panel { padding: 0 16px; }
          .faq-item.is-open .faq-answer-panel { padding-bottom: 16px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .faq-stat-card,
          .faq-category-button,
          .faq-item,
          .faq-chevron,
          .faq-answer-shell { transition: none; }
        }
      `}</style>
    </section>
  );
}
