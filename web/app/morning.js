// The morning notification: off unless turned on in Settings. The app schedules it from the
// newest forecast each time it gets one, so it says what the penguin would wear that day.
// Nothing goes through a server, so if the app isn't opened the schedule ends after tomorrow
// rather than sending stale advice.
import { LANG, T } from './i18n.js';
import { ADVICE, formatTemp, pages } from './rules.js';

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** [{date: "yyyy-MM-dd", time: "HH:mm", title, body, outfit}] (outfit: the drawing to attach): today's (if its time is still ahead) and tomorrow's. */
export function morningItems(weather, settings, now = new Date()) {
  if (!settings.morning || !weather) return [];
  const [hh, mm] = settings.morning.split(':').map(Number);
  const [today, tomorrow] = pages(weather, settings);
  const items = [];
  const add = (p, day, high) => {
    const body = [
      p.condition && T('{condition}.', { condition: p.condition }),
      high != null && T('High of {t}.', { t: formatTemp(high, settings.celsius, LANG) }),
      p.rain && !p.rainyCondition && T('Rain likely.'),
    ].filter(Boolean).join(' ');
    items.push({ date: isoDate(day), time: settings.morning, title: T(ADVICE[p.outfit]), body, outfit: p.outfit });
  };
  const at = new Date(now);
  at.setHours(hh, mm, 0, 0);
  if (at > now) add(today, now, today.high);
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  add(tomorrow, next, tomorrow.temp);
  return items;
}
