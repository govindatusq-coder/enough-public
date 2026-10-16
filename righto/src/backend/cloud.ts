// Cloud mode: accounts, invite links, and keeping the local store in step with the Supabase project.
// When the backend is not configured (or nobody is signed in) the app runs on its local sample data as before.
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { api, backendConfigured, supabase } from './supabase';
import { useStore } from '../store';
import { type Task, type CheckIn, type Outcome, type GoalAnswers, PSYCH, CLIENT, dayLabel, dayKey, plusDays, mkTask, lc, uniq } from '../logic';
import { notifyNewTask } from '../notifications';

export type Role = 'client' | 'psych';
export type Profile = { user_id: string; role: Role; display_name: string; consent_version: string | null; consent_at: string | null; settings: Record<string, unknown> };
export type PsychLink = { link_id: string; psych_id: string; display_name: string; title: string; practice: string; ahpra: string; linked_at: string; home_prompt: boolean };

type CloudState = {
  ready: boolean;            // auth state known
  mfaRequired: boolean;      // righto_settings.require_psych_mfa (true until read)
  session: Session | null;
  profile: Profile | null;
  aal: 'aal1' | 'aal2' | null;
  hasFactor: boolean;        // a verified TOTP factor exists
  link: PsychLink | null;    // client side: the psychologist they are linked with
  pendingProfile: { role: Role; display_name: string; practice?: string; ahpra?: string } | null; // kept until the first sign-in when email confirmation is on
  set: (p: Partial<CloudState>) => void;
};

export const useCloud = create<CloudState>()((set) => ({ ready: false, mfaRequired: true, session: null, profile: null, aal: null, hasFactor: false, link: null, pendingProfile: null, set: (p) => set(p) }));

export const cloudMode = () => backendConfigured();
/** True when the app should read and write the project rather than the local sample data. */
export const cloudActive = () => cloudMode() && !!useCloud.getState().session && !!useCloud.getState().profile;
export const isPsych = () => useCloud.getState().profile?.role === 'psych';
export const cloudEmail = () => useCloud.getState().session?.user.email ?? '';
export const needsMfa = () => { const c = useCloud.getState(); return c.profile?.role === 'psych' && c.mfaRequired && c.aal !== 'aal2'; };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || 'R';
const shortName = (name: string) => { const parts = name.trim().split(/\s+/); return /^dr\b/i.test(parts[0] ?? '') && parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1] : parts[0] ?? name; };

/** Point the shared copy ("Dr Chen", "Sam") at the real people. */
function applyNames(profile: Profile | null, link: PsychLink | null) {
  if (profile?.role === 'client') {
    Object.assign(CLIENT, { name: profile.display_name, first: profile.display_name.split(/\s+/)[0], initials: initials(profile.display_name) });
  }
  const psych = profile?.role === 'psych' ? { name: profile.display_name, practice: '', ahpra: '' } : link ? { name: link.display_name, practice: link.practice, ahpra: link.ahpra } : null;
  if (psych) Object.assign(PSYCH, { name: psych.name, short: shortName(psych.name), initials: initials(psych.name), practice: psych.practice, ahpra: psych.ahpra });
}

// ---- auth --------------------------------------------------------------------------------------

let booted = false;
/** Call once at startup: restores the session, loads the profile, keeps the store in step. */
export async function bootstrapCloud() {
  if (!cloudMode() || booted) return;
  booted = true;
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  await onSession(data.session);
  sb.auth.onAuthStateChange((_e, session) => { onSession(session).catch(() => undefined); });
}

async function onSession(session: Session | null) {
  const c = useCloud.getState();
  if (!session) { c.set({ session: null, profile: null, aal: null, hasFactor: false, link: null, ready: true }); return; }
  c.set({ session });
  try { await loadProfile(); } catch (e) { console.warn('[righto] profile', (e as Error).message); } finally { useCloud.getState().set({ ready: true }); }
}

export async function loadProfile() {
  const sb = supabase();
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return null;
  let { data: profile } = await sb.from('righto_profiles').select('*').eq('user_id', s.session.user.id).maybeSingle();
  const pending = useCloud.getState().pendingProfile;
  if (!profile && pending) {
    const consent = useStore.getState();
    await sb.from('righto_profiles').insert({ user_id: s.session.user.id, role: pending.role, display_name: pending.display_name, consent_version: consent.consentVersion, consent_at: consent.consentAt });
    if (pending.role === 'psych') await sb.from('righto_psychologists').insert({ user_id: s.session.user.id, practice: pending.practice ?? '', ahpra: pending.ahpra ?? '', consent_attested_at: new Date().toISOString() });
    ({ data: profile } = await sb.from('righto_profiles').select('*').eq('user_id', s.session.user.id).maybeSingle());
    useCloud.getState().set({ pendingProfile: null });
  }
  const p = (profile ?? null) as Profile | null;
  useCloud.getState().set({ profile: p });
  if (p) {
    const st = useStore.getState();
    // Signed in: the local sample homework (ids t1, t2, …) makes way for the account's real rows.
    st.set({ role: p.role, ...(st.tasks.some((t) => /^t\d+$/.test(t.id)) ? { tasks: [], history: [] } : {}) });
    await refreshMfa();
    if (p.role === 'client') await refreshLink();
    applyNames(p, useCloud.getState().link);
    if (p.role === 'client') await pullClient();
  }
  return p;
}

export async function refreshMfa() {
  try {
    const sb = supabase();
    const { data: lvl } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await sb.auth.mfa.listFactors();
    const { data: req } = await sb.rpc('righto_setting', { p_key: 'require_psych_mfa' });
    useCloud.getState().set({ aal: (lvl?.currentLevel as 'aal1' | 'aal2' | null) ?? null, hasFactor: (factors?.totp ?? []).some((f) => f.status === 'verified'), mfaRequired: req !== false });
  } catch { /* keep previous */ }
}

export async function signUp(p: { email: string; password: string; role: Role; display_name: string; practice?: string; ahpra?: string }) {
  const sb = supabase();
  useCloud.getState().set({ pendingProfile: { role: p.role, display_name: p.display_name, practice: p.practice, ahpra: p.ahpra } });
  const { data, error } = await sb.auth.signUp({ email: p.email.trim(), password: p.password, options: { data: { display_name: p.display_name, role: p.role } } });
  if (error) throw error;
  if (!data.session) return 'confirm' as const; // email confirmation is on: profile is created at the first sign-in
  await loadProfile();
  return 'ready' as const;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return loadProfile();
}

export async function signOut() {
  try { await supabase().auth.signOut(); } catch { /* ignore */ }
  useCloud.getState().set({ session: null, profile: null, aal: null, hasFactor: false, link: null });
  useStore.getState().wipe();
}

// ---- MFA (psychologists) ------------------------------------------------------------------------

export async function mfaEnroll() {
  const sb = supabase();
  const { data: factors } = await sb.auth.mfa.listFactors();
  for (const f of factors?.totp ?? []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Righto' });
  if (error) throw error;
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
}

export async function mfaVerify(factorId: string, code: string) {
  const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') });
  if (error) throw error;
  await refreshMfa();
}

export async function mfaVerifiedFactorId() {
  const { data } = await supabase().auth.mfa.listFactors();
  return (data?.totp ?? []).find((f) => f.status === 'verified')?.id ?? null;
}

// ---- client side ---------------------------------------------------------------------------------

export async function refreshLink() {
  try {
    const link = (await api.myPsychologist()) as PsychLink | null;
    useCloud.getState().set({ link });
    useStore.getState().set({ linked: !!link, homePrompt: link ? link.home_prompt : true });
    applyNames(useCloud.getState().profile, link);
    return link;
  } catch { return null; }
}

type TaskRow = {
  id: string; title: string; detail: string; why: string; mins: number; needs: string; tags: string[]; suggestion: Task['suggestion']; suggest: Task['suggest'];
  where_opts: string[]; how_opts: string[]; prep_opts: string[]; sent_at: string; status: Task['status']; kind: Task['kind']; daily: boolean;
  plan: Task['plan']; goal: Task['goal']; later_until: string | null; today_outcome: Outcome | null; today_date: string | null; shared: boolean;
};
type CheckInRow = { id: string; task_id: string; outcome: Outcome; helped: string; next: string; shared: boolean; created_at: string };

const sentLabel = (iso: string) => (dayKey(new Date(iso)) === dayKey(new Date()) ? 'Today' : dayLabel(new Date(iso)));

export function rowToTask(r: TaskRow, prev?: Task): Task {
  return mkTask({
    id: r.id, title: r.title, detail: r.detail, why: r.why, mins: r.mins, needs: r.needs, tags: (r.tags ?? []) as Task['tags'], suggestion: r.suggestion ?? null, suggest: r.suggest ?? 'coffee',
    whereOpts: r.where_opts ?? [], howOpts: r.how_opts ?? [], prepOpts: r.prep_opts ?? [], sent: sentLabel(r.sent_at), status: r.status, kind: r.kind ?? null, daily: !!r.daily,
    plan: r.plan ?? null, goal: r.goal ?? null, laterUntil: r.later_until ? dayLabel(new Date(r.later_until + 'T12:00:00')) : undefined,
    today: r.today_date === dayKey(new Date()) ? r.today_outcome : null, shared: r.shared, notifIds: prev?.notifIds ?? [],
  });
}

/** Fetch the signed-in client's tasks and check-ins into the local store. New homework triggers the private local alert. */
export async function pullClient() {
  if (!cloudActive() || isPsych()) return;
  const sb = supabase();
  const [{ data: tasks, error: e1 }, { data: checkins, error: e2 }, { data: sessions }] = await Promise.all([
    sb.from('righto_tasks').select('*').order('sent_at', { ascending: false }),
    sb.from('righto_checkins').select('*').order('created_at', { ascending: false }),
    sb.from('righto_sessions').select('starts_at').gt('starts_at', new Date().toISOString()).order('starts_at').limit(1),
  ]);
  if (e1 || e2 || !tasks || !checkins) return;
  const st = useStore.getState();
  const nextIso = (sessions as { starts_at: string }[] | null)?.[0]?.starts_at;
  if (nextIso) st.set({ nextSession: { when: dayLabel(new Date(nextIso)), iso: nextIso } });
  const prevById = new Map(st.tasks.map((t) => [t.id, t]));
  const mapped = (tasks as TaskRow[]).map((r) => rowToTask(r, prevById.get(r.id)));
  const titles = new Map(mapped.map((t) => [t.id, t.title]));
  const history: CheckIn[] = (checkins as CheckInRow[]).map((c) => ({ id: c.id, taskId: c.task_id, title: titles.get(c.task_id) ?? '', date: c.created_at, label: dayLabel(new Date(c.created_at)), outcome: c.outcome, helped: c.helped, next: c.next, shared: c.shared }));
  st.set({ tasks: mapped, history });
  for (const t of mapped) if (t.status === 'new' && !prevById.has(t.id) && st.tasks.length) notifyNewTask(t, st.notifDetail).catch(() => undefined);
}

/** Mirror a local task change to the project. Fire-and-forget; the local store stays the source for the UI. */
export function pushTaskPatch(id: string, patch: Partial<Task>) {
  if (!cloudActive() || isPsych()) return;
  const row: Record<string, unknown> = {};
  if ('status' in patch) row.status = patch.status;
  if ('kind' in patch) row.kind = patch.kind ?? null;
  if ('daily' in patch) row.daily = !!patch.daily;
  if ('plan' in patch) row.plan = patch.plan ?? null;
  if ('goal' in patch) row.goal = patch.goal ?? null;
  if ('shared' in patch) row.shared = !!patch.shared;
  if ('today' in patch) { row.today_outcome = patch.today ?? null; row.today_date = patch.today ? dayKey(new Date()) : null; }
  if (patch.status === 'later') row.later_until = dayKey(plusDays(new Date(), 3));
  if (!Object.keys(row).length) return;
  supabase().from('righto_tasks').update(row).eq('id', id).then(({ error }) => { if (error) console.warn('[righto] task sync', error.message); });
}

export function pushCheckIn(c: CheckIn) {
  if (!cloudActive() || isPsych()) return;
  const uid = useCloud.getState().session?.user.id;
  supabase().from('righto_checkins').insert({ task_id: c.taskId, client_id: uid, outcome: c.outcome, helped: c.helped, next: c.next, shared: c.shared })
    .then(({ error }) => { if (error) console.warn('[righto] check-in sync', error.message); else pullClient().catch(() => undefined); });
}

export async function updateConsent() {
  if (!cloudActive()) return;
  const s = useStore.getState();
  await supabase().from('righto_profiles').update({ consent_version: s.consentVersion, consent_at: s.consentAt }).eq('user_id', useCloud.getState().session!.user.id);
}

// ---- psychologist side ---------------------------------------------------------------------------

export type RecordView = {
  client: { id: string; display_name: string; home_prompt: boolean; link_id: string; linked_at: string };
  tasks: Task[];
  checkins: CheckIn[];
  sessions: { id: string; starts_at: string; mode: string }[];
};

export async function clientRecord(clientId: string): Promise<RecordView> {
  const raw = (await api.clientRecord(clientId)) as { client: RecordView['client']; tasks: TaskRow[]; checkins: CheckInRow[]; sessions: RecordView['sessions'] };
  const tasks = raw.tasks.map((r) => rowToTask({ ...r, today_outcome: null, today_date: null }));
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const checkins: CheckIn[] = raw.checkins.map((c) => ({ id: c.id, taskId: c.task_id, title: titles.get(c.task_id) ?? '', date: c.created_at, label: dayLabel(new Date(c.created_at)), outcome: c.outcome, helped: c.helped, next: c.next, shared: true }));
  return { client: raw.client, tasks, checkins, sessions: raw.sessions };
}

export async function setHomePrompt(clientId: string, on: boolean) {
  const { error } = await supabase().rpc('righto_set_home_prompt', { p_client: clientId, p_on: on });
  if (error) throw error;
}

export async function assignTask(clientId: string, a: { title: string; detail: string; why: string; mins: number; needs: string; tags: Task['tags']; start: 'client' | 'commitment' | 'goal'; routine: Task['suggest']; where: string; how: string; goal: GoalAnswers }) {
  const uid = useCloud.getState().session!.user.id;
  let suggestion: Task['suggestion'] = null;
  if (a.start === 'commitment' && a.where.trim() && a.how.trim()) suggestion = { kind: 'commitment', plan: { routine: a.routine, where: a.where.trim(), how: a.how.trim(), prep: '' } };
  if (a.start === 'goal' && Object.values(a.goal).some((v) => v.trim())) suggestion = { kind: 'goal', goal: { ...a.goal } };
  const lt = lc(a.title.trim());
  const { error } = await supabase().from('righto_tasks').insert({
    client_id: clientId, psych_id: uid, title: a.title.trim(), detail: a.detail.trim() || a.title.trim(), why: a.why.trim(), mins: a.mins, needs: a.needs.trim() || 'Nothing', tags: a.tags,
    suggestion, suggest: a.routine, where_opts: uniq([a.where.trim(), 'at home', 'at work', 'outside']), how_opts: uniq([a.how.trim(), lt]), prep_opts: ['set a phone reminder', 'put a note where I’ll see it'],
  });
  if (error) throw error;
}
