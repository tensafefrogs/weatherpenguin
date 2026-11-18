// Talks to the native iOS shell (app/ios). In a plain browser there is no
// shell, so the page runs in demo mode with sample weather.
//
// Web → native:  window.webkit.messageHandlers.wp.postMessage({ type, ... })
//   ready            the page is listening; send settings and weather
//   refresh          fetch location and weather again
//   saveSettings     { settings } to store in UserDefaults (v1.3 keys) and iCloud
//   reminders        { time: "HH:mm" | null, items } the morning notifications to schedule (morning.js); null: none
//   openAppSettings  open iOS Settings for this app (location denied)
//   openURL          { url } in Safari (https only)
//
// Native → web:  window.WP.onSettings(s), .onLoading(), .onWeather(w), .onError(e), .onReminders(allowed),
//   .onFold(rect | null) (the iPhone Duo fold, layout.js), .demo(sample, tour) (debug builds only, the App Review video)
//   e.code: locationDenied | locationOff | locationFailed | offline | weatherFailed
// window.WPApp (set by the app before the page loads): what the app offers, { reminders: true }.

const handler = window.webkit?.messageHandlers?.wp;

export const isNative = Boolean(handler);

export function post(message) {
  handler?.postMessage(message);
}
