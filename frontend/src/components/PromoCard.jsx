import React from 'react';

const PromoCard = ({
  eyebrow = 'Промо',
  title = 'Место для партнёров',
  description = 'Здесь скоро появятся аккуратные предложения и полезные объявления.',
  iconLabel = 'AD'
}) => (
  <section className="promo-card" aria-label={title}>
    <div className="promo-card__header">
      <div className="promo-card__icon" aria-hidden="true">{iconLabel}</div>
      <span className="promo-card__eyebrow">{eyebrow}</span>
    </div>

    <div className="promo-card__body">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>

    <style>{`
      .promo-card {
        position: relative;
        overflow: hidden;
        padding: var(--space-14);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        background:
          linear-gradient(145deg, rgba(79, 124, 255, 0.14), transparent 58%),
          rgba(15, 23, 42, 0.7);
        box-shadow: var(--shadow-sm);
        transition: var(--transition-normal);
      }

      .promo-card:hover {
        border-color: rgba(148, 163, 184, 0.34);
        background:
          linear-gradient(145deg, rgba(79, 124, 255, 0.2), transparent 60%),
          rgba(15, 23, 42, 0.82);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }

      .promo-card__header {
        display: flex;
        align-items: center;
        gap: var(--space-10);
        margin-bottom: var(--space-12);
      }

      .promo-card__icon {
        width: 34px;
        height: 34px;
        border-radius: var(--radius-md);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #f8fbff;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        background: linear-gradient(145deg, var(--accent), #5b6ef6);
        border: 1px solid rgba(99, 102, 241, 0.42);
        box-shadow: 0 10px 22px rgba(79, 124, 255, 0.2);
      }

      .promo-card__eyebrow {
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .promo-card__body {
        display: grid;
        gap: var(--space-6);
      }

      .promo-card__body h3 {
        color: var(--text-primary);
        font-size: 15px;
        font-weight: 800;
        line-height: 1.25;
      }

      .promo-card__body p {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.5;
      }
    `}</style>
  </section>
);

export default PromoCard;
