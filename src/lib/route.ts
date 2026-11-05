import { useEffect, useState } from 'react';

/** Tiny hash router: "#/plan/2026-11-21" → ["plan", "2026-11-21"] */
export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return r;
}

export const href = (...parts: string[]) => '#/' + parts.map(encodeURIComponent).join('/');
