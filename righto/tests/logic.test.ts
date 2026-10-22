import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sentence, goalLine, daysLine, parseTime, nextOccurrence, expoWeekday, orderedTasks, pickByPreference, journalStats, notifCopy, statusTag,
  seedTasks, seedHistory, defaultPlan, defaultGoal, weekdays, allDays, daysUntil, dayLabel, mkTask,
} from '../src/logic.ts';

test('commitment sentence and goal line', () => {
  assert.equal(sentence({ routine: 'lunch', how: 'walk for 10 minutes', where: 'around the block near work', prep: '' }), 'After I finish lunch, I will walk for 10 minutes, around the block near work.');
  assert.equal(goalLine({ s: 'Five slow breaths, sitting on my bed.', m: '', a: '', r: '', t: 'Every night until our next session' }), 'Five slow breaths, sitting on my bed. Every night until our next session.');
});

test('days line', () => {
  assert.equal(daysLine(allDays()), 'every day');
  assert.equal(daysLine(weekdays()), 'weekdays');
  assert.equal(daysLine([true, false, true, false, true, false, false]), 'Mon, Wed, Fri');
  assert.equal(daysLine([false, false, false, false, false, false, false]), 'no days picked');
});

test('time parsing and scheduling helpers', () => {
  assert.deepEqual(parseTime('7:30 am'), { hour: 7, minute: 30 });
  assert.deepEqual(parseTime('12:30 pm'), { hour: 12, minute: 30 });
  assert.deepEqual(parseTime('9:30 pm'), { hour: 21, minute: 30 });
  const from = new Date(2026, 9, 16, 13, 0, 0);
  const next = nextOccurrence('12:30 pm', from);
  assert.equal(next.getDate(), 17);
  assert.equal(next.getHours(), 12);
  const soon = nextOccurrence('6:00 pm', from);
  assert.equal(soon.getDate(), 16);
  assert.equal(expoWeekday(0), 2); // Monday
  assert.equal(expoWeekday(6), 1); // Sunday
  assert.equal(expoWeekday(5), 7); // Saturday
  assert.equal(daysUntil('2026-10-20T10:00:00', new Date(2026, 9, 16, 9)), 4);
  assert.equal(dayLabel(new Date(2026, 9, 11)), 'Sun 11 Oct');
});

test('home ordering: current-routine commitment first, then new homework', () => {
  const tasks = seedTasks();
  const ordered = orderedTasks(tasks, [], 'lunch');
  assert.equal(ordered[0].id, 't1'); // lunch walk
  assert.equal(ordered[1].id, 't2'); // new homework
  assert.ok(!ordered.some((t) => t.status === 'later'));
  const afterSkip = orderedTasks(tasks, ['t1'], 'lunch');
  assert.equal(afterSkip[0].id, 't2');
});

test('"what feels doable" is a plain sort over clinician tasks', () => {
  const tasks = seedTasks();
  const next = orderedTasks(tasks, [], 'lunch')[0];
  assert.equal(pickByPreference(tasks, 'tiny', next)?.mins, 2);
  assert.equal(pickByPreference(tasks, 'quiet', next)?.id, 't0'); // clinician-tagged quiet
  assert.equal(pickByPreference(tasks, 'time', next)?.id, 't1');
  assert.equal(pickByPreference(tasks, 'next', next)?.id, 't1');
  assert.equal(pickByPreference([], 'tiny', undefined), undefined);
});

test('journal counts are records, not interpretation', () => {
  const st = journalStats(seedHistory(), seedTasks());
  assert.equal(st.doneCount, 3);
  assert.equal(st.taskTotal, 4 + 4); // 4 check-ins + 4 pending tasks
  assert.deepEqual(st.legend.map((l) => l.n), [2, 1, 1, 4]);
  assert.equal(st.segs.length, 8);
});

test('default plan and goal honour the clinician suggestion', () => {
  const [t2, t1, t0] = seedTasks();
  assert.equal(defaultPlan(t2).routine, 'wind');
  assert.equal(defaultPlan(t2).prep, 'pin a note to my home screen');
  assert.equal(defaultPlan(t1).how, 'walk for 10 minutes');
  assert.equal(defaultGoal(t0).rem.time, '8:30 pm');
  assert.deepEqual(defaultGoal(t1).rem.days, weekdays());
});

test('lock-screen copy is private by default', () => {
  const [t2, t1] = seedTasks();
  const priv = notifCopy('commitment', t1, false);
  assert.equal(priv.title, 'Rightyo');
  assert.equal(priv.body, 'Time for your lunch break routine.');
  assert.ok(!priv.body.includes('walk'));
  assert.equal(notifCopy('new', t2, false).body, 'You have something new from your psychologist.');
  assert.ok(!JSON.stringify(notifCopy('nudge', t2, false)).includes('Chen'));
  assert.ok(notifCopy('commitment', t1, true).body.includes('Walk for 10 minutes'));
});

test('status tags for the psychologist view', () => {
  const [t2, t1, t0, t3] = seedTasks();
  assert.equal(statusTag(t2).label, 'Not started');
  assert.equal(statusTag(t1).label, 'Daily · Lunch break');
  assert.equal(statusTag(t0).label, 'Goal · 8:30 pm');
  assert.equal(statusTag(t3).label, 'Later · Thu 16 Oct');
  assert.equal(statusTag(mkTask({ id: 'x', title: 'X', status: 'tried' })).label, 'Done once');
});

test('own routine: the client’s anchor and time stand in for a routine', async () => {
  const { routineFor, routineLabel, reminderTime, sentence, notifCopy, statusTag, mkTask } = await import('../src/logic.ts');
  const own = { routine: 'own' as const, anchor: 'after I feed the dog', how: 'stretch for two minutes', where: 'in the kitchen', prep: '', time: '6:45 am' };
  assert.equal(sentence(own), 'After I feed the dog, I will stretch for two minutes, in the kitchen.');
  assert.equal(reminderTime(own), '6:45 am');
  assert.equal(reminderTime({ ...own, time: null }), '8:00 am');
  assert.equal(routineFor({ ...own, anchor: '' }).anchor, 'At the time I chose');
  assert.equal(routineLabel(routineFor(own)), 'Own routine');
  const t = mkTask({ id: 'o', title: 'Stretch', status: 'planned', kind: 'commitment', plan: own });
  assert.equal(statusTag(t).label, 'Commitment · Own routine');
  assert.equal(notifCopy('commitment', t, false).body, 'Time for your own routine.');
  assert.equal(notifCopy('commitment', t, true).body, 'After I feed the dog? Stretch for two minutes, in the kitchen.');
});

test('reminder time: own time wins over the routine time', async () => {
  const { reminderTime, formatTime, seedTasks } = await import('../src/logic.ts');
  const { to12, to24, dateToTime, timeToDate } = await import('../src/utils/time.ts');
  assert.equal(reminderTime({ routine: 'lunch', how: '', where: '', prep: '' }), '12:30 pm');
  assert.equal(reminderTime({ routine: 'lunch', how: '', where: '', prep: '', time: '1:15 pm' }), '1:15 pm');
  assert.equal(reminderTime(null), '7:30 am');
  assert.equal(to12('14:05'), '2:05 pm');
  assert.equal(to12('00:30'), '12:30 am');
  assert.equal(to24('2:05 pm'), '14:05');
  assert.equal(to24('12:30 am'), '00:30');
  assert.equal(to24('nonsense'), '');
  assert.equal(dateToTime(timeToDate('9:45 pm')), '9:45 pm');
  assert.equal(formatTime(new Date(2026, 9, 16, 15, 5)), '3:05 pm');
  assert.ok(seedTasks().some((t) => t.status === 'finished' && t.title === 'Notice three things you can hear'));
});

test('goal questions offer three task-based answers each', async () => {
  const { goalOptions, seedTasks } = await import('../src/logic.ts');
  const [t2, t1, t0] = seedTasks();
  const o = goalOptions(t1, 'Tue 20 Oct');
  for (const k of ['s', 'm', 'a', 'r', 't'] as const) {
    assert.equal(o[k].length, 3, k);
    assert.equal(new Set(o[k]).size, 3, k + ' unique');
  }
  assert.ok(o.s[0].startsWith('Walk for 10 minutes, around the block near work'));
  assert.ok(o.a[0].includes('10 minutes'));
  assert.ok(o.a[1].includes('comfortable shoes'));
  assert.ok(o.t[0].includes('Tue 20 Oct'));
  assert.equal(goalOptions(t0, 'Tue 20 Oct').s[0], 'Five slow breaths, sitting on my bed'); // clinician suggestion first... when present
  assert.ok(goalOptions(t2, 'Tue 20 Oct').a[1].startsWith('I already have your phone'));
});
