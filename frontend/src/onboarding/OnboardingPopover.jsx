import React, { useLayoutEffect, useRef, useState } from 'react';

const VIEWPORT_PADDING = 12;
const DESKTOP_GAP = 18;
const MOBILE_BREAKPOINT = 768;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCardPosition({ rect, placement, cardWidth, cardHeight }) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = viewportWidth <= MOBILE_BREAKPOINT ? 12 : DESKTOP_GAP;
  const centeredLeft = (viewportWidth - cardWidth) / 2;
  const centeredTop = (viewportHeight - cardHeight) / 2;

  if (!rect || placement === 'center') {
    return {
      top: clamp(centeredTop, VIEWPORT_PADDING, viewportHeight - cardHeight - VIEWPORT_PADDING),
      left: clamp(centeredLeft, VIEWPORT_PADDING, viewportWidth - cardWidth - VIEWPORT_PADDING),
      placement: 'center'
    };
  }

  const candidates = [
    placement,
    placement === 'left' ? 'right' : null,
    placement === 'right' ? 'left' : null,
    placement === 'top' ? 'bottom' : null,
    placement === 'bottom' ? 'top' : null,
    'bottom',
    'center'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'center') {
      return {
        top: clamp(centeredTop, VIEWPORT_PADDING, viewportHeight - cardHeight - VIEWPORT_PADDING),
        left: clamp(centeredLeft, VIEWPORT_PADDING, viewportWidth - cardWidth - VIEWPORT_PADDING),
        placement: 'center'
      };
    }

    let top = centeredTop;
    let left = centeredLeft;

    if (candidate === 'top') {
      top = rect.top - cardHeight - gap;
      left = rect.left + (rect.width - cardWidth) / 2;
    } else if (candidate === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + (rect.width - cardWidth) / 2;
    } else if (candidate === 'left') {
      top = rect.top + (rect.height - cardHeight) / 2;
      left = rect.left - cardWidth - gap;
    } else if (candidate === 'right') {
      top = rect.top + (rect.height - cardHeight) / 2;
      left = rect.right + gap;
    }

    const fitsVertically = top >= VIEWPORT_PADDING && (top + cardHeight) <= (viewportHeight - VIEWPORT_PADDING);
    const fitsHorizontally = left >= VIEWPORT_PADDING && (left + cardWidth) <= (viewportWidth - VIEWPORT_PADDING);

    if (fitsVertically && fitsHorizontally) {
      return { top, left, placement: candidate };
    }
  }

  return {
    top: clamp(centeredTop, VIEWPORT_PADDING, viewportHeight - cardHeight - VIEWPORT_PADDING),
    left: clamp(centeredLeft, VIEWPORT_PADDING, viewportWidth - cardWidth - VIEWPORT_PADDING),
    placement: 'center'
  };
}

export default function OnboardingPopover({
  activeStep,
  index,
  total,
  targetRect,
  targetMissing,
  isSearching,
  routePending,
  onNext,
  onBack,
  onSkip
}) {
  const cardRef = useRef(null);
  const [cardPosition, setCardPosition] = useState({ top: 24, left: 24, placement: 'center' });

  useLayoutEffect(() => {
    if (!cardRef.current || !activeStep) return undefined;

    const updatePosition = () => {
      if (!cardRef.current) return;

      const nextPosition = getCardPosition({
        rect: targetRect,
        placement: targetMissing ? 'center' : (activeStep.placement || 'bottom'),
        cardWidth: cardRef.current.offsetWidth,
        cardHeight: cardRef.current.offsetHeight
      });

      setCardPosition(nextPosition);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);

    return () => window.removeEventListener('resize', updatePosition);
  }, [activeStep, targetRect, targetMissing, routePending, isSearching]);

  if (!activeStep) return null;

  const progressPercent = ((index + 1) / total) * 100;
  const statusText = routePending
    ? 'Открываем нужный раздел…'
    : isSearching
      ? 'Ищем элемент интерфейса…'
      : targetMissing
        ? (activeStep.missingDescription || 'Элемент не найден. Тур можно продолжить.')
        : '';

  return (
    <aside
      ref={cardRef}
      className="onboarding-card"
      data-placement={cardPosition.placement}
      style={{ top: `${cardPosition.top}px`, left: `${cardPosition.left}px` }}
      aria-live="polite"
    >
      <div className="onboarding-progress">
        <div className="onboarding-progress-copy">
          <span className="onboarding-progress-label">GovChat Tour</span>
          <span className="onboarding-progress-value">Шаг {index + 1} из {total}</span>
        </div>
        <div className="onboarding-progress-track" aria-hidden="true">
          <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <h2 className="onboarding-title">{activeStep.title}</h2>
      <p className="onboarding-description">{activeStep.description}</p>

      {statusText ? <div className="onboarding-status">{statusText}</div> : null}

      <div className="onboarding-actions">
        <div className="onboarding-actions-left">
          <button type="button" className="onboarding-btn onboarding-btn-secondary" onClick={onSkip}>
            Пропустить
          </button>
          <button
            type="button"
            className="onboarding-btn onboarding-btn-secondary"
            onClick={onBack}
            disabled={index === 0}
          >
            Назад
          </button>
        </div>

        <div className="onboarding-actions-right">
          <button type="button" className="onboarding-btn onboarding-btn-primary" onClick={onNext}>
            {index === total - 1 ? 'Завершить' : 'Далее'}
          </button>
        </div>
      </div>
    </aside>
  );
}
