# Stats

Anonymous counts in GoatCounter (`web/app/stats.js`, and `app/ios/Shared/Stats.swift` for the native parts from 2.0.1),
only when the `GOATCOUNTER_URL` Actions variable is set.
No cookies, nothing that identifies anyone, nothing linked across visits. The app's events are under
`weatherpenguin-ios/`, the website's under `weatherpenguin/` (the website also counts page views; the app doesn't).
The GoatCounter site is weatherpenguin.goatcounter.com, Weather Penguin's own.
Events marked *once* are counted at most once per launch (app) or visit (website).

| Event | When | Read it as |
| --- | --- | --- |
| `start` | the first launch on a device (or first visit in a browser) | new users |
| `platform/ios`, `platform/web` | each launch (once) | launches, by where |
| `lang/<tag>` | each launch (once) | which language the app shows (`web/app/i18n.js` tags) |
| `outfit/<outfit>` | the first forecast of a launch (once) | what the penguin wore today: `cold`, `jacket`, `jacket_rain`, `warm`, `warm_rain`, `hot`, `hot_rain` |
| `units/c`, `units/f` | the first forecast of a launch (once) | °C or °F in use |
| `view/tomorrow` | swiping to Tomorrow (once) | how many look ahead |
| `layout/phone`, `layout/two-up`, `layout/duo-book`, `layout/duo-laptop` | the screen shape at launch (once) | iPhone, iPad or wide, iPhone Duo held like a book or propped up |
| `error/<code>` | an error screen (once) | `locationDenied`, `locationFailed`, `offline`, `weatherFailed` |
| `settings/temperatures` | closing Settings after moving a slider | people tuning the outfit temperatures |
| `units/changed-to-c`, `units/changed-to-f` | closing Settings after switching units | |
| `morning/on`, `morning/off` | closing Settings after turning Morning penguin on or off | |

From the native code (2.0.1 on; `Shared/Stats.swift`, the same kind of event, a name only):

| Event | When | Read it as |
| --- | --- | --- |
| `widget/<family>`, `widget/none` | each app launch (once per kind): which Weather Penguin widgets are on this phone, asked by the app (the widgets send nothing) | `small`, `medium`, `medium-two-day`, `lock-circular`, `lock-rectangular`, `lock-inline`; `none` when there are none |
| `watch/open` | the Apple Watch app opening (once per launch) | watch users |
| `siri/what-to-wear` | each time Siri, Shortcuts or Spotlight asks "What should I wear?" | voice and Shortcuts use |
| `morning/opened` | each tap on a morning notification (delivered but untapped ones aren't counted) | whether the notification gets used |

Not counted: the watch face complications and the iMessage stickers (iOS gives neither a way to report).

GoatCounter adds the country (from the IP address, which it doesn't store), the browser or OS, and the screen size.

Not counted, ever: places, coordinates, weather values, times, or anything typed.
