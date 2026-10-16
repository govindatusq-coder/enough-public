import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { encryptedStorage } from './storage';
import { type Task, type CheckIn, type Outcome, type Preference, type RoutineTimes, DEFAULT_ROUTINE_TIMES, seedTasks, seedHistory, dayKey, dayLabel } from './logic';

export const STORE_NAME = 'righto.v1';
export const CONSENT_VERSION = '2026-10-15';
export type Role = 'client' | 'psych';
export type LockAfter = 0 | 1 | 5;

export type State = {
  role: Role;
  onboarded: boolean;
  consentAt: string | null;
  consentVersion: string | null;
  linked: boolean;
  shareDefault: boolean;
  notifDetail: boolean;
  notifsAllowed: boolean;
  appLock: boolean;
  lockAfter: LockAfter;
  homePrompt: boolean; // psychologist's "Ask ‘What feels doable?’ on Home" switch (default on)
  routineTimes: RoutineTimes; // the client's own times for the three routines
  tasks: Task[];
  history: CheckIn[];
  nextSession: { when: string; iso: string };
  todayDate: string;
  set: (p: Partial<State>) => void;
  patchTask: (id: string, p: Partial<Task>) => void;
  addTask: (t: Task) => void;
  record: (taskId: string, outcome: Outcome, helped: string, next: string, shared: boolean) => void;
  rollDay: () => void;
  resetDemo: () => void;
  wipe: () => void;
};

const base = () => ({
  role: 'client' as Role,
  onboarded: false,
  consentAt: null,
  consentVersion: null,
  linked: false,
  shareDefault: true,
  notifDetail: false,
  notifsAllowed: false,
  appLock: true,
  lockAfter: 5 as LockAfter,
  homePrompt: true,
  routineTimes: { ...DEFAULT_ROUTINE_TIMES },
  tasks: seedTasks(),
  history: seedHistory(),
  nextSession: { when: 'Monday 20 Oct', iso: '2026-10-20T10:00:00' },
  todayDate: dayKey(new Date()),
});

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...base(),
      set: (p) => set(p),
      patchTask: (id, p) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
      addTask: (t) => set((s) => ({ tasks: [t, ...s.tasks] })),
      record: (taskId, outcome, helped, next, shared) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === taskId);
          if (!t) return {};
          const now = new Date();
          const entry: CheckIn = { id: 'c' + now.getTime(), taskId, title: t.title, date: now.toISOString(), label: dayLabel(now), outcome, helped: helped.trim(), next: next.trim(), shared };
          return {
            history: [entry, ...s.history],
            tasks: s.tasks.map((x) => (x.id === taskId ? { ...x, today: outcome, status: x.status === 'new' || x.status === 'later' || x.status === 'finished' ? 'tried' : x.status } : x)),
          };
        }),
      rollDay: () =>
        set((s) => {
          const today = dayKey(new Date());
          if (s.todayDate === today) return {};
          return { todayDate: today, tasks: s.tasks.map((t) => ({ ...t, today: null })) };
        }),
      resetDemo: () => set((s) => ({ ...base(), role: s.role, onboarded: s.onboarded, consentAt: s.consentAt, consentVersion: s.consentVersion, linked: s.linked, appLock: s.appLock, lockAfter: s.lockAfter, notifDetail: s.notifDetail, notifsAllowed: s.notifsAllowed, shareDefault: s.shareDefault, routineTimes: s.routineTimes })),
      wipe: () => set({ ...base() }),
    }),
    {
      name: STORE_NAME,
      version: 1,
      storage: createJSONStorage(() => encryptedStorage),
      partialize: (s) => {
        const { set: _s, patchTask: _p, addTask: _a, record: _r, rollDay: _d, resetDemo: _x, wipe: _w, ...rest } = s;
        return rest;
      },
    },
  ),
);

export const useTask = (id: string | undefined) => useStore((s) => s.tasks.find((t) => t.id === id));

// Device-only, never persisted: the "What feels doable right now?" preference (INTENDED_PURPOSE.md rule 3).
type Ephemeral = { pref: Preference | null; skipped: string[]; setPref: (p: Preference | null) => void; skip: (id: string, allIds: string[]) => void };
export const useEphemeral = create<Ephemeral>()((set) => ({
  pref: null,
  skipped: [],
  setPref: (pref) => set({ pref }),
  skip: (id, allIds) => set((s) => { const sk = [...s.skipped, id]; return { skipped: allIds.every((x) => sk.includes(x)) ? [] : sk }; }),
}));
