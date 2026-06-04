import { useState, useEffect, useCallback } from 'react';

/**
 * Per-view "show completed" toggle, backed by localStorage.
 *
 * Defaults reflect typical usage:
 * - Calendar: ON (historical view matters for date-anchored tasks)
 * - List / Board / MyWork / Projects: OFF (focus on actionable work)
 *
 * Users override per-view and the choice persists across reloads/tabs.
 */
export type ShowCompletedView = 'list' | 'board' | 'calendar' | 'mywork' | 'projects';

const DEFAULTS: Record<ShowCompletedView, boolean> = {
  list: false,
  board: false,
  mywork: false,
  projects: false,
  calendar: true,
};

function storageKey(viewName: ShowCompletedView) {
  return `cc-show-completed:${viewName}`;
}

export function useShowCompleted(viewName: ShowCompletedView): [boolean, (next: boolean) => void] {
  const [show, setShow] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(storageKey(viewName));
      if (stored === null) return DEFAULTS[viewName];
      return stored === 'true';
    } catch {
      return DEFAULTS[viewName];
    }
  });

  const setAndPersist = useCallback(
    (next: boolean) => {
      setShow(next);
      try {
        localStorage.setItem(storageKey(viewName), String(next));
      } catch {
        // localStorage unavailable — toggle still works in-session
      }
    },
    [viewName]
  );

  // Sync across tabs (e.g., toggling on List should reflect on List in another tab)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(viewName) && e.newValue !== null) {
        setShow(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [viewName]);

  return [show, setAndPersist];
}
