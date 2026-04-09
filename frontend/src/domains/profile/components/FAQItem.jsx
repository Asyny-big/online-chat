import React from 'react';
import { ChevronDownIcon } from '@/shared/ui/Icons';

function FAQItem({ item, expanded, onToggle, categoryLabel }) {
  const panelId = `faq-panel-${item.id}`;
  const buttonId = `faq-button-${item.id}`;

  return (
    <article className={`faq-item ${expanded ? 'is-open' : ''}`}>
      <button
        id={buttonId}
        type="button"
        className="faq-trigger"
        onClick={() => onToggle(item.id)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <div className="faq-trigger-copy">
          <div className="faq-meta-row">
            <span className="faq-category-pill">{categoryLabel}</span>
            {item.keywords?.slice(0, 2).map((keyword) => (
              <span key={`${item.id}-${keyword}`} className="faq-keyword-pill">
                {keyword}
              </span>
            ))}
          </div>
          <h3 className="faq-question-title">{item.title}</h3>
          <p className="faq-question-summary">{item.summary}</p>
        </div>

        <span className="faq-chevron" aria-hidden="true">
          <ChevronDownIcon size={18} />
        </span>
      </button>

      <div className="faq-answer-shell" aria-hidden={!expanded}>
        <div id={panelId} role="region" aria-labelledby={buttonId} className="faq-answer-panel">
          <p className="faq-answer-text">{item.answer}</p>

          {item.steps?.length ? (
            <ol className="faq-answer-list faq-answer-list--ordered">
              {item.steps.map((step) => (
                <li key={`${item.id}-step-${step}`}>{step}</li>
              ))}
            </ol>
          ) : null}

          {item.tips?.length ? (
            <ul className="faq-answer-list">
              {item.tips.map((tip) => (
                <li key={`${item.id}-tip-${tip}`}>{tip}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default React.memo(FAQItem);
