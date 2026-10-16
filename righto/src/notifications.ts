// Local reminders via expo-notifications. Nothing leaves the device; copy is private by default (PRIVACY.md §4).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { type Task, notifCopy, parseTime, nextOccurrence, expoWeekday, reminderTime } from './logic';

export const CATEGORY = { routine: 'righto.routine', new: 'righto.new', nudge: 'righto.nudge' } as const;
export const ACTION = { done: 'done', missed: 'missed', start: 'start', now: 'now', options: 'options' } as const;
const CHANNEL = 'reminders';

let ready: Promise<void> | null = null;

export function setupNotifications() {
  if (ready) return ready;
  ready = (async () => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL, {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
          lightColor: '#0F2746',
        });
      }
      await Notifications.setNotificationCategoryAsync(CATEGORY.routine, [
        { identifier: ACTION.done, buttonTitle: 'Done', options: { opensAppToForeground: false } },
        { identifier: ACTION.missed, buttonTitle: 'Not today', options: { opensAppToForeground: false } },
        { identifier: ACTION.start, buttonTitle: 'Start', options: { opensAppToForeground: true } },
      ]);
      await Notifications.setNotificationCategoryAsync(CATEGORY.new, [
        { identifier: ACTION.now, buttonTitle: 'Do it now', options: { opensAppToForeground: true } },
        { identifier: ACTION.options, buttonTitle: 'See options', options: { opensAppToForeground: true } },
      ]);
    } catch (e) {
      console.warn('[righto] notification setup failed', e);
    }
  })();
  return ready;
}

export async function requestPermission() {
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

async function allowed() {
  try { return (await Notifications.getPermissionsAsync()).granted; } catch { return false; }
}

export async function cancelFor(task: Task) {
  await Promise.all((task.notifIds || []).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

const content = (kind: 'new' | 'commitment' | 'goal' | 'nudge', t: Task, detail: boolean, category?: string): Notifications.NotificationContentInput => ({
  ...notifCopy(kind, t, detail),
  data: { taskId: t.id, kind },
  categoryIdentifier: category,
  sound: 'default',
});

/** Commitment: at the routine time, every day if daily, otherwise the next occurrence only. Returns new notification ids. */
export async function scheduleCommitment(task: Task, detail: boolean): Promise<string[]> {
  await setupNotifications();
  await cancelFor(task);
  if (!task.plan || !(await allowed())) return [];
  const time = reminderTime(task.plan);
  const { hour, minute } = parseTime(time);
  const trigger: Notifications.NotificationTriggerInput = task.daily
    ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL }
    : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextOccurrence(time, new Date()), channelId: CHANNEL };
  try {
    const id = await Notifications.scheduleNotificationAsync({ content: content('commitment', task, detail, CATEGORY.routine), trigger });
    return [id];
  } catch (e) {
    console.warn('[righto] could not schedule commitment', e);
    return [];
  }
}

/** Goal: weekly on each chosen day at the chosen time. */
export async function scheduleGoal(task: Task, detail: boolean): Promise<string[]> {
  await setupNotifications();
  await cancelFor(task);
  if (!task.goal || !(await allowed())) return [];
  const { hour, minute } = parseTime(task.goal.rem.time);
  const ids: string[] = [];
  for (let i = 0; i < 7; i++) {
    if (!task.goal.rem.days[i]) continue;
    try {
      ids.push(await Notifications.scheduleNotificationAsync({
        content: content('goal', task, detail, CATEGORY.routine),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(i), hour, minute, channelId: CHANNEL },
      }));
    } catch (e) {
      console.warn('[righto] could not schedule goal day', i, e);
    }
  }
  return ids;
}

/** "Nothing for now" → a single gentle nudge in 3 days. */
export async function scheduleNudge(task: Task, detail: boolean): Promise<string[]> {
  await setupNotifications();
  await cancelFor(task);
  if (!(await allowed())) return [];
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: content('nudge', task, detail, CATEGORY.nudge),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 * 24 * 60 * 60, channelId: CHANNEL },
    });
    return [id];
  } catch {
    return [];
  }
}

/** Psychologist sent new homework → immediate local alert on this device (mock for the remote push in Phase 4). */
export async function notifyNewTask(task: Task, detail: boolean) {
  await setupNotifications();
  if (!(await allowed())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: content('new', task, detail, CATEGORY.new),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, channelId: CHANNEL },
    });
  } catch { /* ignore */ }
}

export async function cancelAll() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}
