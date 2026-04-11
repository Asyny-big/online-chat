import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import OnboardingStep from './OnboardingStep';
import { GOVCHAT_ONBOARDING_STEPS, GOVCHAT_ONBOARDING_VERSION } from './onboardingSteps';
import './onboarding.css';

const OnboardingContext = createContext(null);

const STORAGE_KEY = 'govchat:onboarding';
const TARGET_RETRY_LIMIT = 24;
const TARGET_RETRY_DELAY_MS = 180;

function readPersistedState() {
  if (typeof window === 'undefined') {
    return {
      completed: false,
      dismissed: false,
      currentStepId: null,
      version: GOVCHAT_ONBOARDING_VERSION
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.version !== GOVCHAT_ONBOARDING_VERSION) {
      return {
        completed: false,
        dismissed: false,
        currentStepId: null,
        version: GOVCHAT_ONBOARDING_VERSION
      };
    }

    return {
      completed: Boolean(parsed.completed),
      dismissed: Boolean(parsed.dismissed),
      currentStepId: typeof parsed.currentStepId === 'string' ? parsed.currentStepId : null,
      version: GOVCHAT_ONBOARDING_VERSION
    };
  } catch (_) {
    return {
      completed: false,
      dismissed: false,
      currentStepId: null,
      version: GOVCHAT_ONBOARDING_VERSION
    };
  }
}

function writePersistedState(nextState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: GOVCHAT_ONBOARDING_VERSION,
        completed: Boolean(nextState.completed),
        dismissed: Boolean(nextState.dismissed),
        currentStepId: typeof nextState.currentStepId === 'string' ? nextState.currentStepId : null
      })
    );
  } catch (_) {
    // Ignore storage failures to keep onboarding non-blocking.
  }
}

function computeSpotlightRect(node, padding = 14) {
  const rect = node.getBoundingClientRect();
  return {
    top: Math.max(8, rect.top - padding),
    left: Math.max(8, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    right: rect.right + padding,
    bottom: rect.bottom + padding
  };
}

function isElementVisible(node) {
  if (!(node instanceof HTMLElement)) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function scrollTargetIntoView(node) {
  const rect = node.getBoundingClientRect();
  const isVisible =
    rect.top >= 48
    && rect.left >= 0
    && rect.bottom <= (window.innerHeight - 48)
    && rect.right <= window.innerWidth;

  if (isVisible) return;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  node.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'center',
    inline: 'center'
  });
}

export function OnboardingProvider({
  children,
  steps = GOVCHAT_ONBOARDING_STEPS,
  route,
  navigate,
  enabled = true
}) {
  const [persistedState, setPersistedState] = useState(readPersistedState);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetState, setTargetState] = useState({
    node: null,
    rect: null,
    missing: false,
    searching: false,
    routePending: false
  });

  const autoStartRef = useRef(false);
  const activeStep = steps[activeIndex] || null;

  const persistPatch = useCallback((patch) => {
    setPersistedState((prev) => {
      const next = { ...prev, ...patch };
      writePersistedState(next);
      return next;
    });
  }, []);

  const setStepById = useCallback((stepId) => {
    const nextIndex = Math.max(
      0,
      steps.findIndex((step) => step.id === stepId)
    );
    setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
  }, [steps]);

  const start = useCallback((options = {}) => {
    const stepId = typeof options.stepId === 'string' ? options.stepId : persistedState.currentStepId;
    if (stepId) {
      setStepById(stepId);
    } else {
      setActiveIndex(0);
    }

    setIsOpen(true);
  }, [persistedState.currentStepId, setStepById]);

  const finish = useCallback(() => {
    persistPatch({ completed: true, dismissed: false, currentStepId: null });
    setIsOpen(false);
  }, [persistPatch]);

  const skip = useCallback(() => {
    persistPatch({ dismissed: true, currentStepId: null });
    setIsOpen(false);
  }, [persistPatch]);

  const next = useCallback(() => {
    setActiveIndex((prev) => {
      if (prev >= steps.length - 1) {
        finish();
        return prev;
      }
      return prev + 1;
    });
  }, [finish, steps.length]);

  const back = useCallback(() => {
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const reset = useCallback(() => {
    persistPatch({ completed: false, dismissed: false, currentStepId: null });
    setActiveIndex(0);
    setIsOpen(true);
  }, [persistPatch]);

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      autoStartRef.current = false;
      return;
    }

    if (autoStartRef.current) return;
    if (persistedState.completed || persistedState.dismissed) return;

    autoStartRef.current = true;
    const timerId = window.setTimeout(() => {
      start();
    }, 550);

    return () => window.clearTimeout(timerId);
  }, [enabled, persistedState.completed, persistedState.dismissed, start]);

  useEffect(() => {
    if (!isOpen || !activeStep) return;
    persistPatch({ currentStepId: activeStep.id });
  }, [activeStep, isOpen, persistPatch]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skip();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        back();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [back, isOpen, next, skip]);

  useEffect(() => {
    if (!isOpen || !activeStep) {
      setTargetState({
        node: null,
        rect: null,
        missing: false,
        searching: false,
        routePending: false
      });
      return undefined;
    }

    if (activeStep.route && route !== activeStep.route) {
      setTargetState({
        node: null,
        rect: null,
        missing: false,
        searching: false,
        routePending: true
      });
      navigate?.(activeStep.route);
      return undefined;
    }

    if (!activeStep.selector) {
      setTargetState({
        node: null,
        rect: null,
        missing: false,
        searching: false,
        routePending: false
      });
      return undefined;
    }

    let cancelled = false;
    let retryCount = 0;
    let retryTimer = null;

    const resolveTarget = () => {
      if (cancelled) return;

      const node = document.querySelector(activeStep.selector);
      if (node && isElementVisible(node)) {
        scrollTargetIntoView(node);

        window.requestAnimationFrame(() => {
          if (cancelled) return;
          setTargetState({
            node,
            rect: computeSpotlightRect(node, activeStep.spotlightPadding ?? 14),
            missing: false,
            searching: false,
            routePending: false
          });
        });
        return;
      }

      if (retryCount >= TARGET_RETRY_LIMIT) {
        setTargetState({
          node: null,
          rect: null,
          missing: true,
          searching: false,
          routePending: false
        });
        return;
      }

      retryCount += 1;
      setTargetState({
        node: null,
        rect: null,
        missing: false,
        searching: true,
        routePending: false
      });
      retryTimer = window.setTimeout(resolveTarget, TARGET_RETRY_DELAY_MS);
    };

    resolveTarget();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [activeStep, isOpen, navigate, route]);

  useEffect(() => {
    if (!isOpen || !targetState.node || !activeStep || targetState.missing) return undefined;

    const updateRect = () => {
      if (!targetState.node || !isElementVisible(targetState.node)) {
        return;
      }

      setTargetState((prev) => ({
        ...prev,
        rect: computeSpotlightRect(targetState.node, activeStep.spotlightPadding ?? 14)
      }));
    };

    const resizeObserver = new ResizeObserver(updateRect);
    resizeObserver.observe(targetState.node);

    window.addEventListener('resize', updateRect);
    document.addEventListener('scroll', updateRect, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateRect);
      document.removeEventListener('scroll', updateRect, true);
    };
  }, [activeStep, isOpen, targetState.missing, targetState.node]);

  const contextValue = useMemo(() => ({
    isOpen,
    steps,
    activeStep,
    activeIndex,
    start,
    reset,
    finish,
    skip,
    next,
    back
  }), [activeIndex, activeStep, back, finish, isOpen, next, reset, skip, start, steps]);

  const layer = isOpen && typeof document !== 'undefined'
    ? createPortal(
      <OnboardingStep
        activeStep={activeStep}
        index={activeIndex}
        total={steps.length}
        targetRect={targetState.rect}
        targetMissing={targetState.missing}
        isSearching={targetState.searching}
        routePending={targetState.routePending}
        onNext={next}
        onBack={back}
        onSkip={skip}
      />,
      document.body
    )
    : null;

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {layer}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);

  if (!value) {
    return {
      isOpen: false,
      steps: [],
      activeStep: null,
      activeIndex: 0,
      start: () => {},
      reset: () => {},
      finish: () => {},
      skip: () => {},
      next: () => {},
      back: () => {}
    };
  }

  return value;
}
