// Pure data model + rules for Righto. No React Native imports so it can be unit-tested with Node.
// Copy, selection rules and seed data follow reference/Righto App v3.dc.html.

export type Outcome = 'done' | 'partial' | 'missed';
export type Status = 'new' | 'planned' | 'tried' | 'later' | 'finished';
export type RoutineId = 'coffee' | 'lunch' | 'wind';
export type Tag = 'quick' | 'quiet';
export type Kind = 'commitment' | 'goal';
export type Preference = 'tiny' | 'quiet' | 'next' | 'time' | 'skip';

export type Plan = { routine: RoutineId; how: string; where: string; prep: string; time?: string | null }; // time: own reminder time, null = routine time
export type GoalAnswers = { s: string; m: string; a: string; r: string; t: string };
export type Reminder = { time: string; days: boolean[] };
export type Goal = GoalAnswers & { rem: Reminder };
export type Suggestion = { kind: 'commitment'; plan: Plan } | { kind: 'goal'; goal: GoalAnswers };

export type Task = {
  id: string;
  title: string;
  detail: string;
  why: string;
  needs: string;
  mins: number;
  sent: string;
  status: Status;
  kind: Kind | null;
  daily: boolean;
  today: Outcome | null;
  plan: Plan | null;
  goal: Goal | null;
  suggestion: Suggestion | null;
  suggest: RoutineId;
  tags: Tag[];
  laterUntil?: string;
  whereOpts: string[];
  howOpts: string[];
  prepOpts: string[];
  notifIds: string[];
  shared: boolean;
};

export type CheckIn = {
  id: string;
  taskId: string;
  title: string;
  date: string; // ISO
  label: string; // e.g. "Sat 11 Oct"
  outcome: Outcome;
  helped: string;
  next: string;
  shared: boolean;
};

export type Routine = { id: RoutineId; name: string; anchor: string; time: string };

export const ROUTINES: Routine[] = [
  { id: 'coffee', name: 'Morning coffee', anchor: 'While my coffee brews', time: '7:30 am' },
  { id: 'lunch', name: 'Lunch break', anchor: 'After I finish lunch', time: '12:30 pm' },
  { id: 'wind', name: 'Evening wind-down', anchor: 'After I brush my teeth', time: '9:30 pm' },
];

export const NOPREP = 'Nothing needed';
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const TIMES = ['7:30 am', '12:30 pm', '6:00 pm', '8:30 pm'];
export const MINS = [2, 5, 10, 20];
export const PSYCH = { name: 'Dr Maya Chen', short: 'Dr Chen', title: 'Psychologist', practice: 'Harbour Psychology, Sydney', ahpra: 'PSY0001234567', initials: 'MC' };
export const CLIENT = { name: 'Sam Patel', first: 'Sam', initials: 'SP' };

export const GOALQ: { k: keyof GoalAnswers; q: string; pq: string; ph: string }[] = [
  { k: 's', q: 'What exactly will you do, and where?', pq: 'What exactly will they do, and where?', ph: 'e.g. Walk around the block near work' },
  { k: 'm', q: 'How will you know you’ve done it?', pq: 'How will they know it’s done?', ph: 'e.g. 10 minutes on my phone timer' },
  { k: 'a', q: 'What makes it doable for you right now?', pq: 'What makes it doable right now?', ph: 'e.g. I already take a lunch break' },
  { k: 'r', q: 'Why does it matter to you?', pq: 'Why does it matter to them?', ph: 'e.g. It helps my afternoon slump' },
  { k: 't', q: 'When will you do it, and until when?', pq: 'When, and until when?', ph: 'e.g. Mon, Wed and Fri until our next session' },
];

export const OUT: Record<Outcome, { label: string; bg: string; fg: string }> = {
  done: { label: 'Done', bg: '#e3eaf0', fg: '#0F2746' },
  partial: { label: 'Partly', bg: '#F6E7D6', fg: '#7a5a36' },
  missed: { label: 'Not today', bg: '#ffffff80', fg: '#4B5B70' },
};

export const allDays = () => [true, true, true, true, true, true, true];
export const weekdays = () => [true, true, true, true, true, false, false];
export const emptyGoal = (): GoalAnswers => ({ s: '', m: '', a: '', r: '', t: '' });

export const dLabel = (n: number) => (n === 1 ? '1 day' : n + ' days');
export const daysLine = (d: boolean[]) => {
  const n = d.filter(Boolean).length;
  if (n === 7) return 'every day';
  if (n === 5 && !d[5] && !d[6]) return 'weekdays';
  if (!n) return 'no days picked';
  return DAYS.filter((_, i) => d[i]).map((x) => x.slice(0, 3)).join(', ');
};
export const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
export const lc = (s: string) => (s ? s.replace(/^./, (c) => c.toLowerCase()) : s);
export const trim = (s: string | undefined) => (s || '').replace(/[.\s]+$/, '');
export const fmt = (n: number) => Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0');

export const routineOf = (id: RoutineId | string | undefined): Routine => ROUTINES.find((x) => x.id === id) || ROUTINES[0];
/** When a commitment's reminder fires: the client's own time if they chose one, otherwise the routine time. */
export const reminderTime = (p: Plan | null | undefined) => (p?.time ? p.time : routineOf(p?.routine).time);
/** Date → "3:05 pm" */
export const formatTime = (d: Date) => {
  const h = d.getHours();
  return (h % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm');
};
export const sentence = (p: Plan | null | undefined) => (p ? routineOf(p.routine).anchor + ', I will ' + p.how + ', ' + p.where + '.' : '');
export const goalLine = (g: GoalAnswers | null | undefined) => (g ? trim(g.s) + '. ' + trim(g.t) + '.' : '');
export const lineOf = (t: Task) => (t.kind === 'goal' ? goalLine(t.goal) : sentence(t.plan));
export const suggestionLine = (s: Suggestion | null) => (s ? (s.kind === 'goal' ? goalLine(s.goal) : sentence(s.plan)) : '');

export const defaultPlan = (t: Task): Plan => {
  if (t.plan) return { ...t.plan, time: t.plan.time ?? null };
  const sp = t.suggestion && t.suggestion.kind === 'commitment' ? t.suggestion.plan : null;
  return sp ? { ...sp, prep: sp.prep || t.prepOpts[0] || NOPREP, time: null } : { routine: t.suggest || 'coffee', how: t.howOpts[0] || '', where: t.whereOpts[0] || '', prep: t.prepOpts[0] || NOPREP, time: null };
};
export const defaultGoal = (t: Task): Goal => {
  if (t.goal) return { ...t.goal, rem: { ...t.goal.rem, days: [...t.goal.rem.days] } };
  const sg = t.suggestion && t.suggestion.kind === 'goal' ? t.suggestion.goal : emptyGoal();
  return { ...sg, rem: { time: '8:30 pm', days: weekdays() } };
};

/** Three ready-made answers per goal question, built from the clinician's task (never generated advice).
 *  The client can always write their own instead. */
export const goalOptions = (t: Task, sessionLabel: string): Record<keyof GoalAnswers, string[]> => {
  const sg: GoalAnswers | null = t.goal ? t.goal : t.suggestion && t.suggestion.kind === 'goal' ? t.suggestion.goal : null; // the client's own answers, else the clinician's suggestion, come first
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
  const combos: string[] = [];
  for (const how of t.howOpts) for (const where of t.whereOpts) combos.push(cap(how) + ', ' + where);
  const pick = (first: string | undefined, rest: string[]) => uniq([first || '', ...rest]).slice(0, 3);
  return {
    s: pick(sg?.s, combos.length ? combos : [cap(lc(t.title))]),
    m: pick(sg?.m, ['I’ve set a timer for ' + t.mins + ' minutes and finished', 'I’ve done it once, start to end', 'I’ve written down that I did it']),
    a: pick(sg?.a, ['It only takes about ' + t.mins + ' minutes', t.needs && t.needs !== 'Nothing' ? 'I already have ' + lc(t.needs) : 'I don’t need anything for it', 'I can fit it around something I already do']),
    r: pick(sg?.r, ['We talked about it in session and it made sense', 'I want to see whether it makes a difference', 'I want to feel more in charge of my day']),
    t: pick(sg?.t, ['Every day until my next session on ' + sessionLabel, 'Weekdays until my next session on ' + sessionLabel, 'Three times this week']),
  };
};

// ---- Dates -------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const dayLabel = (d: Date) => DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
export const longDayLabel = (d: Date) => DAYS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
export const dateStamp = (d: Date) => d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
export const monthName = (d: Date) => MONTHS_LONG[d.getMonth()];
export const dayKey = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const plusDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysUntil = (iso: string, now: Date) => {
  const a = new Date(dayKey(now) + 'T00:00:00').getTime();
  const b = new Date(dayKey(new Date(iso)) + 'T00:00:00').getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
};
export const greeting = (hour: number) => (hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,');
export const currentRoutine = (hour: number): RoutineId => (hour < 11 ? 'coffee' : hour < 17 ? 'lunch' : 'wind');

/** "7:30 am" → { hour: 7, minute: 30 } (24h) */
export const parseTime = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(t.trim());
  if (!m) return { hour: 9, minute: 0 };
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') hour += 12;
  return { hour, minute: Number(m[2]) };
};
/** Next time this clock time occurs, strictly after `from`. */
export const nextOccurrence = (time: string, from: Date) => {
  const { hour, minute } = parseTime(time);
  const d = new Date(from);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d;
};
/** Our day index (0 = Monday) → expo-notifications weekday (1 = Sunday … 7 = Saturday). */
export const expoWeekday = (mondayIndex: number) => ((mondayIndex + 1) % 7) + 1;

// ---- Selection rules (Home) ---------------------------------------------------------------------

export const isActive = (t: Task) => t.status === 'new' || t.status === 'planned' || t.status === 'tried';
export const isLive = (t: Task) => isActive(t) && !t.today;
/** Tasks Home can suggest: anything active and not yet done today; if everything is done today, fall back to
 *  the active tasks so the four tiles always lead somewhere. Only set-aside and finished tasks are left out. */
export const liveTasks = (tasks: Task[]) => {
  const live = tasks.filter(isLive);
  return live.length ? live : tasks.filter(isActive);
};
export const pendingTasks = (tasks: Task[]) => tasks.filter((x) => x.status === 'later' || (isActive(x) && !x.today));

/** Current-routine commitments first, then new homework, then everything else. */
export const orderedTasks = (tasks: Task[], skipped: string[], cur: RoutineId) => {
  const live = liveTasks(tasks);
  const rank = (x: Task) => (x.status === 'planned' ? (x.kind === 'commitment' && x.plan?.routine === cur ? 0 : 2) : 1);
  let pool = live.filter((x) => !skipped.includes(x.id));
  if (!pool.length) pool = live;
  return [...pool].sort((a, b) => rank(a) - rank(b));
};

/** "What feels doable right now?" is a sort over clinician-written tasks, never advice.
 *  tiny → shortest; quiet → a task the clinician tagged quiet (else shortest); time → longest; next/skip → the ordered next step. */
export const pickByPreference = (tasks: Task[], pref: Preference, next: Task | undefined) => {
  const live = liveTasks(tasks);
  if (!live.length) return undefined;
  const byMins = [...live].sort((a, b) => a.mins - b.mins)[0];
  const quiet = live.find((x) => x.tags.includes('quiet'));
  const byLong = [...live].sort((a, b) => b.mins - a.mins)[0];
  if (pref === 'quiet') return quiet || byMins;
  if (pref === 'tiny') return byMins;
  if (pref === 'time') return byLong;
  return next;
};

export const PREF_KICKER: Record<Preference, string> = {
  tiny: 'Your quickest task',
  quiet: 'A quiet one Dr Chen picked',
  next: 'Your next small step',
  time: 'You’ve got time for this',
  skip: 'Your next small step',
};

export const subOf = (x: Task) => {
  const base = x.status === 'new' ? 'New from Dr Chen · about ' + x.mins + ' min'
    : !x.kind ? 'From Dr Chen · about ' + x.mins + ' min'
      : x.kind === 'goal' ? 'Your goal · ' + trim(x.goal?.s)
        : routineOf(x.plan?.routine).anchor + ', ' + (x.plan?.where || '');
  return x.today ? 'Done today · ' + base : base;
};

// ---- Journal / review -----------------------------------------------------------------------------

export type Look = { bs: 'solid' | 'dashed'; bg: string | 'half' | 'transparent'; op: number };
export const LOOK: Record<Outcome | 'todo', Look> = {
  done: { bs: 'solid', bg: '#0F2746', op: 1 },
  partial: { bs: 'solid', bg: 'half', op: 1 },
  missed: { bs: 'solid', bg: '#0f274626', op: 0.45 },
  todo: { bs: 'dashed', bg: 'transparent', op: 1 },
};

export const learningOf = (c: CheckIn) => c.helped || c.next || 'No notes added';

export const journalStats = (history: CheckIn[], tasks: Task[]) => {
  const pending = pendingTasks(tasks);
  const doneCount = history.filter((h) => h.outcome !== 'missed').length;
  const taskTotal = history.length + pending.length;
  const segs = [...history].reverse().map((h) => ({ key: h.id, label: h.title + ' · ' + OUT[h.outcome].label, ...LOOK[h.outcome] }))
    .concat(pending.map((x) => ({ key: 'todo-' + x.id, label: x.title + ' · to do', ...LOOK.todo })));
  const cnt = (k: Outcome) => history.filter((h) => h.outcome === k).length;
  const legend = ([['done', 'Done', cnt('done')], ['partial', 'Partly', cnt('partial')], ['missed', 'Not today', cnt('missed')], ['todo', 'To do', pending.length]] as [Outcome | 'todo', string, number][])
    .map(([k, label, n]) => ({ k, label, n, ...LOOK[k] }));
  return { doneCount, taskTotal, segs, legend, pending };
};

export const perTaskRows = (history: CheckIn[], tasks: Task[]) =>
  tasks.filter((x) => history.some((h) => h.taskId === x.id) || x.status === 'planned').map((x) => {
    const hs = [...history].filter((h) => h.taskId === x.id).reverse();
    return {
      id: x.id,
      title: x.title,
      ratio: hs.filter((h) => h.outcome !== 'missed').length + '/' + hs.length,
      dots: hs.length ? hs.map((h) => ({ key: h.id, label: h.label + ' · ' + OUT[h.outcome].label, ...LOOK[h.outcome] })) : [{ key: 'none', label: 'No check-ins yet', ...LOOK.todo }],
    };
  });

export const statusTag = (x: Task) =>
  x.status === 'new' ? { label: 'Not started', bg: '#F6E7D6', fg: '#7a5a36' }
    : x.status === 'later' ? { label: 'Later · ' + (x.laterUntil || ''), bg: '#F6E7D6', fg: '#7a5a36' }
      : x.status === 'planned'
        ? (x.kind === 'goal' ? { label: 'Goal · ' + (x.goal?.rem.time || ''), bg: '#e3eaf0', fg: '#0F2746' } : { label: (x.daily ? 'Daily · ' : 'Commitment · ') + routineOf(x.plan?.routine).name, bg: '#e3eaf0', fg: '#0F2746' })
        : { label: x.status === 'tried' ? 'Done once' : 'Paused', bg: '#ffffff80', fg: '#4B5B70' };

// ---- Notification copy (PRIVACY.md §4). Private by default; detail only when the client opts in. ----

export const notifCopy = (kind: 'new' | 'commitment' | 'goal' | 'nudge', t: Task, detail: boolean) => {
  if (!detail) {
    return {
      title: 'Righto',
      body: kind === 'new' ? 'You have something new from your psychologist.'
        : kind === 'commitment' ? 'Time for your ' + routineOf(t.plan?.routine).name.toLowerCase() + ' routine.'
          : kind === 'goal' ? 'A gentle reminder for today.'
            : 'Ready to have another look?',
    };
  }
  return {
    title: kind === 'new' ? 'New homework from ' + PSYCH.short : kind === 'nudge' ? 'Righto' : 'Righto · ' + t.title,
    body: kind === 'new' ? t.title
      : kind === 'commitment' ? (routineOf(t.plan?.routine).anchor + '? ' + (t.plan ? t.plan.how.replace(/^./, (c) => c.toUpperCase()) + ', ' + t.plan.where + '.' : t.title))
        : kind === 'goal' ? trim(t.goal?.s) + '.'
          : 'Ready to have another look at “' + t.title + '”?',
  };
};

// ---- Seed data (mock, matches the v3 reference) --------------------------------------------------

export const mkTask = (p: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  detail: p.title, why: '', needs: 'Nothing', mins: 10, sent: 'Today', status: 'new', kind: null, daily: false, today: null, plan: null, goal: null,
  suggestion: null, suggest: 'coffee', tags: [], whereOpts: ['at home', 'at work', 'outside'], howOpts: [lc(p.title)], prepOpts: ['set a phone reminder', 'put a note where I’ll see it'],
  notifIds: [], shared: true, ...p,
});

export const seedTasks = (): Task[] => [
  mkTask({ id: 't2', title: 'Write down one worry and when it shows up', detail: 'When a worry comes up, write one line: the worry, the time, and where you were. Keep it short.',
    why: 'Worries can feel constant. Writing them down shows when and where they actually appear, which helps us spot patterns and plan around them.', needs: 'Your phone’s notes app', mins: 2, sent: 'Today', status: 'new', suggest: 'wind',
    suggestion: { kind: 'commitment', plan: { routine: 'wind', how: 'write down today’s main worry and when it showed up', where: 'in my notes app', prep: 'pin a note to my home screen' } },
    whereOpts: ['in my notes app', 'in a small notebook'], howOpts: ['write down today’s main worry and when it showed up', 'write one line about my day'], prepOpts: ['pin a note to my home screen', 'keep a notebook by the sink'] }),
  mkTask({ id: 't1', title: 'Take a 10-minute walk after lunch', detail: 'Walk at an easy pace for 10 minutes. Notice how your body and mood feel before and after.',
    why: 'You mentioned your mood dips most in the early afternoon. A short walk adds light, movement and a change of scene right when the slump usually hits.', needs: 'Comfortable shoes', mins: 10, sent: 'Mon 6 Oct', status: 'planned', kind: 'commitment', daily: true, suggest: 'lunch',
    plan: { routine: 'lunch', how: 'walk for 10 minutes', where: 'around the block near work', prep: 'keep my trainers under my desk' },
    whereOpts: ['around the block near work', 'to the park and back', 'up and down the office stairs'], howOpts: ['walk for 10 minutes', 'walk for 5 minutes', 'walk while listening to a podcast'], prepOpts: ['keep my trainers under my desk', 'set a 10-minute timer', 'ask a colleague to join'] }),
  mkTask({ id: 't0', tags: ['quiet'], title: 'Five slow breaths before bed', detail: 'Sit on your bed. Breathe in for four and out for six, five times.',
    why: 'A longer out-breath helps your body settle, which can make it easier to fall asleep.', needs: 'Nothing', mins: 2, sent: 'Mon 29 Sep', status: 'planned', kind: 'goal', daily: true, suggest: 'wind',
    goal: { s: 'Five slow breaths, sitting on my bed', m: 'I’ve counted all five', a: 'It takes under two minutes', r: 'I want to fall asleep more easily', t: 'Every night until our next session', rem: { time: '8:30 pm', days: allDays() } },
    whereOpts: ['sitting on my bed'], howOpts: ['take five slow breaths'], prepOpts: ['leave my phone charging in the kitchen'] }),
  mkTask({ id: 't3', title: 'Plan one small pleasant activity', detail: 'Pick something you used to enjoy and do it for a short while.',
    why: 'When mood is low we tend to do less, which lowers mood further. Small enjoyable activities help break that cycle.', needs: 'Nothing', mins: 20, sent: 'Thu 9 Oct', status: 'later', laterUntil: 'Thu 16 Oct', suggest: 'coffee',
    whereOpts: ['at home', 'outside'], howOpts: ['do something I used to enjoy for 20 minutes'], prepOpts: ['pick the activity the night before', 'put it in my calendar'] }),
  mkTask({ id: 't5', tags: ['quick'], title: 'Notice three things you can hear', detail: 'Pause, close your eyes if you like, and name three sounds around you.',
    why: 'Shifting attention to your senses can help you step out of a busy mind for a moment.', needs: 'Nothing', mins: 2, sent: 'Mon 29 Sep', status: 'finished', suggest: 'coffee',
    whereOpts: ['wherever I am'], howOpts: ['name three sounds around me'], prepOpts: [] }),
];

export const seedHistory = (): CheckIn[] => [
  { id: 'h4', taskId: 't0', title: 'Five slow breaths before bed', date: '2026-10-11T21:40:00', label: 'Sat 11 Oct', outcome: 'done', helped: 'Doing it in bed rather than on the couch made it stick.', next: '', shared: true },
  { id: 'h3', taskId: 't1', title: 'Take a 10-minute walk after lunch', date: '2026-10-10T13:05:00', label: 'Fri 10 Oct', outcome: 'done', helped: 'The 3 pm slump was much easier.', next: '', shared: true },
  { id: 'h2', taskId: 't0', title: 'Five slow breaths before bed', date: '2026-10-09T22:10:00', label: 'Thu 9 Oct', outcome: 'partial', helped: 'Did two breaths. Notifications pulled me out.', next: '', shared: true },
  { id: 'h1', taskId: 't1', title: 'Take a 10-minute walk after lunch', date: '2026-10-08T13:00:00', label: 'Wed 8 Oct', outcome: 'missed', helped: 'It rained. An indoor option would help.', next: '', shared: true },
];

export const OTHER_CLIENTS = [
  { name: 'Jordan Lee', ini: 'JL', line: '1 routine · checked in Fri', done: 2, of: 5 },
  { name: 'Ari Nguyen', ini: 'AN', line: 'New homework sent today', done: 0, of: 0 },
];
