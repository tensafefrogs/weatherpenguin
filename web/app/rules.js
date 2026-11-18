// What the penguin wears. The same rules as v1.3 (the Swift app), so the
// penguin behaves the way existing users expect.
//
// All temperatures are °C. Weather comes from the native shell (WeatherKit)
// or from samples.js in the browser.

/** v1.3 defaults and UserDefaults keys. Values are the band edges in °C. */
export const DEFAULT_SETTINGS = Object.freeze({
  coldUpper: 7.2, // below this: cold (45°F)
  warmLower: 20.1, // from here: warm (68°F)
  hotLower: 32.3, // from here: hot (90°F)
  celsius: false,
});

/** What each drawing shows (for VoiceOver), in English; translated with T(). */
export const OUTFITS = Object.freeze({
  naked: 'A penguin wearing nothing at all',
  cold: 'A penguin in a red sweater, striped scarf and yellow hat',
  jacket: 'A penguin in a green jacket',
  jacket_rain: 'A penguin in a yellow raincoat and rain hat',
  warm: 'A penguin in a striped T-shirt with a heart',
  warm_rain: 'A penguin in a blue hooded poncho',
  hot: 'A penguin in a polka-dot bikini',
  hot_rain: 'A penguin in a polka-dot bikini, swim cap and goggles',
});

/** What the penguin says about each outfit (the morning notification), in English; translated with T(). */
export const ADVICE = Object.freeze({
  cold: 'Bundle up: sweater, scarf and hat.',
  jacket: 'Grab a jacket.',
  jacket_rain: 'Raincoat and rain hat today.',
  warm: 'T-shirt weather!',
  warm_rain: 'Warm, but bring a rain poncho.',
  hot: 'Hot! Bikini weather.',
  hot_rain: 'Hot and showery. Swim cap on.',
});

const RAIN_TYPES = new Set(['rain', 'mixed', 'sleet', 'hail']);

/** v1: the bands overlap at their edges; earlier bands win, as in v1. */
export function outfitFor(tempC, rain, s = DEFAULT_SETTINGS) {
  if (tempC == null) return 'naked';
  if (tempC < s.coldUpper) return 'cold'; // there is no cold-and-rainy drawing
  if (tempC <= s.warmLower) return rain ? 'jacket_rain' : 'jacket';
  if (tempC <= s.hotLower) return rain ? 'warm_rain' : 'warm';
  return rain ? 'hot_rain' : 'hot';
}

/** Today, v1: raining now, or ≥25% chance in the next hour, or ≥35% today. */
export function rainToday(w) {
  if (w.current?.precipitationIntensity >= 0.1 && w.current.temperature > 0) return true;
  const nextHour = w.hourly?.[0];
  if (nextHour && nextHour.precipitationChance >= 0.25 && RAIN_TYPES.has(nextHour.precipitationType)) return true;
  const today = w.daily?.[0];
  return !!today && today.precipitationChance >= 0.35 && RAIN_TYPES.has(today.precipitationType);
}

/** Tomorrow, v1: ≥35% chance. */
export function rainTomorrow(w) {
  const d = w.daily?.[1];
  return !!d && d.precipitationChance >= 0.35 && RAIN_TYPES.has(d.precipitationType);
}

/** The two pages: Today (current temperature) and Tomorrow (its high).
 *  condition is WeatherKit's text, already in the user's language; rainyCondition says whether
 *  it already mentions rain (from its code), so the page doesn't add "Rain likely." twice. */
export function pages(w, s = DEFAULT_SETTINGS) {
  const today = w.daily?.[0];
  const tomorrow = w.daily?.[1];
  const wetToday = rainToday(w);
  const wetTomorrow = rainTomorrow(w);
  return [
    {
      title: 'Today',
      temp: w.current?.temperature ?? null,
      high: today?.high ?? null,
      condition: w.current?.condition ?? today?.condition ?? '',
      rainyCondition: rainy(w.current?.conditionCode ?? today?.conditionCode),
      rain: wetToday,
      outfit: outfitFor(w.current?.temperature, wetToday, s),
    },
    {
      title: 'Tomorrow',
      temp: tomorrow?.high ?? null,
      high: null,
      low: tomorrow?.low ?? null,
      condition: tomorrow?.condition ?? '',
      rainyCondition: rainy(tomorrow?.conditionCode),
      rain: wetTomorrow,
      outfit: outfitFor(tomorrow?.high, wetTomorrow, s),
    },
  ];
}

/** WeatherKit condition codes (WeatherCondition raw values) that already say it's wet. */
function rainy(code) {
  return /rain|drizzle|shower|storm/i.test(code ?? '');
}

/** v1 display: whole °F, or °C to one decimal, in the user's number format. */
export function formatTemp(tempC, celsius, locale = 'en') {
  if (tempC == null) return '';
  if (!celsius) return String(Math.round((tempC * 9) / 5 + 32));
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }).format(tempC);
}

/** Moves one edge (°C) of the settings, keeping a gap from its neighbours (half a degree °C, or 1 °F), within v1's 0–37.77 °C. */
export function clampEdge(s, key, c) {
  const gap = s.celsius ? 0.5 : 5 / 9;
  const bounds = {
    coldUpper: [0, s.warmLower - gap],
    warmLower: [s.coldUpper + gap, s.hotLower - gap],
    hotLower: [s.warmLower + gap, 37.77],
  }[key];
  return { ...s, [key]: Math.min(bounds[1], Math.max(bounds[0], c)) };
}
