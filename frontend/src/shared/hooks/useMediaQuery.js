import { useEffect, useState } from 'react';

export function useMediaQuery(query, { defaultValue = false } = {}) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return defaultValue;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(!!e.matches);

    setMatches(!!mql.matches);
    if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange);
    else mql.addListener(onChange);

    return () => {
      if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}


