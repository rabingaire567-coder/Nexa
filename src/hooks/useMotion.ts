import { useEffect, useState } from 'react';

/** Reads the user's motion preference plus the in-app override. */
export function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches || document.documentElement.classList.contains('reduce-motion'));
    sync();
    mq.addEventListener('change', sync);
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', sync);
      obs.disconnect();
    };
  }, []);

  return reduced;
}
