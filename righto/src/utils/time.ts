// Time helpers shared by the reminder pickers and the notification scheduler.
// Display form is "h:mm am/pm"; the 24-hour form "HH:mm" is what the design's <input type="time"> used.

/** "14:05" → "2:05 pm" */
export const to12 = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'am' : 'pm');
};

/** "2:05 pm" → "14:05" */
export const to24 = (s: string) => {
  const m = /(\d+):(\d+)\s*(am|pm)/i.exec(s || '');
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  return String(h).padStart(2, '0') + ':' + m[2];
};

/** "2:05 pm" → today's Date at that time (for the picker's value). */
export const timeToDate = (s: string) => {
  const v = to24(s) || '08:00';
  const [h, m] = v.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

/** Date → "2:05 pm" */
export const dateToTime = (d: Date) => to12(d.getHours() + ':' + d.getMinutes());
