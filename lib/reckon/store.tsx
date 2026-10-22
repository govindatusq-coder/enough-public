'use client';
/**
 * Local persistence for the prototype. One JSON document in localStorage,
 * updated through the pure functions in model.ts. Swappable for Supabase
 * later without touching the UI.
 */
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {ReckonState} from './types.ts';
import {emptyState} from './model.ts';
import {deriveOsProposals} from './os.ts';

export const STORAGE_KEY = 'reckon:v1';

type Updater = (state: ReckonState) => ReckonState;

interface StoreValue {
  state: ReckonState;
  ready: boolean;
  update: (fn: Updater) => ReckonState;
  reset: () => void;
  status: {ai: boolean; model: string | null; instagramOembed: boolean; devTools: boolean; checked: boolean; error?: string};
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): ReckonState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as ReckonState;
    return parsed.version === 1 ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

export function ReckonStoreProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<ReckonState>(() => emptyState());
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<StoreValue['status']>({ai: false, model: null, instagramOembed: false, devTools: false, checked: false});
  const ref = useRef(state);

  useEffect(() => {
    const loaded = deriveOsProposals(load());
    ref.current = loaded;
    // One-time hydration from localStorage after mount, so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loaded); setReady(true);
    fetch('/api/reckon/status', {cache: 'no-store'}).then(async r => { if (!r.ok) throw new Error(`status endpoint answered ${r.status}`); return r.json(); }).then(s => setStatus({...s, checked: true})).catch(err => setStatus(s => ({...s, checked: true, error: err instanceof Error ? err.message : String(err)})));
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (err) { console.warn('Reckon could not save locally', err instanceof Error ? err.message : ''); }
  }, [state, ready]);

  const update = useCallback((fn: Updater) => {
    const next = deriveOsProposals(fn(ref.current));
    ref.current = next;
    setState(next);
    return next;
  }, []);

  const reset = useCallback(() => { const fresh = emptyState(); ref.current = fresh; setState(fresh); }, []);

  const value = useMemo(() => ({state, ready, update, reset, status}), [state, ready, update, reset, status]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useReckon(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useReckon must be used inside ReckonStoreProvider');
  return ctx;
}
