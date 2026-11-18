// Made-up weather in the shape the native shell sends (see bridge.js).
// Used by the website demo, previews and tests: index.html?sample=hot

const SAMPLES = {
  //          now °C, condition code, mm/h, next-hour rain, today [low, high, rain%], tomorrow [low, high, rain%, condition code]
  rainLater: [15, 'mostlyCloudy', 0, 0.1, [11, 17, 0.6], [7, 12, 0.1, 'partlyCloudy']],
  hot: [33, 'clear', 0, 0, [26, 36, 0], [27, 37, 0.5, 'thunderstorms']],
  cold: [1, 'clear', 0, 0, [-3, 4, 0], [-1, 6, 0.2, 'flurries']],
  warm: [24, 'partlyCloudy', 0, 0, [18, 27, 0.05], [17, 24, 0.1, 'mostlySunny']],
  rainNow: [22, 'rain', 1.4, 0.9, [19, 26, 0.8], [20, 30, 0.1, 'clear']],
};

/** WeatherKit's English text for the sample codes; the demo translates it with T(). */
export const CONDITION_TEXT = {
  clear: 'Clear', mostlyCloudy: 'Mostly Cloudy', partlyCloudy: 'Partly Cloudy', mostlySunny: 'Mostly Sunny',
  thunderstorms: 'Thunderstorms', flurries: 'Flurries', rain: 'Rain',
};

export const SAMPLE_NAMES = Object.keys(SAMPLES);

export function sampleWeather(name = 'warm', now = new Date(), translate = (s) => s) {
  const [temp, code, intensity, nextHourRain, today, tomorrow] = SAMPLES[name] ?? SAMPLES.warm;
  const condition = translate(CONDITION_TEXT[code]);
  const day = (offset) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toISOString();
  return {
    place: 'San Francisco',
    asOf: now.toISOString(),
    current: { temperature: temp, condition, conditionCode: code, precipitationIntensity: intensity },
    hourly: [
      {
        date: now.toISOString(),
        temperature: temp,
        precipitationChance: nextHourRain,
        precipitationType: nextHourRain > 0.2 ? 'rain' : 'clear',
      },
    ],
    daily: [
      { date: day(0), low: today[0], high: today[1], precipitationChance: today[2], precipitationType: today[2] > 0.2 ? 'rain' : 'clear', condition, conditionCode: code },
      { date: day(1), low: tomorrow[0], high: tomorrow[1], precipitationChance: tomorrow[2], precipitationType: tomorrow[2] > 0.2 ? 'rain' : 'clear', condition: translate(CONDITION_TEXT[tomorrow[3]]), conditionCode: tomorrow[3] },
    ],
    attribution: null,
  };
}
