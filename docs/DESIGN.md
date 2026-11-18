# Weather Penguin design guidelines

What the app should look and sound like, so new screens, widgets and store pages match. Lines marked
**(owner)** are decisions the owner made; change those only with their go-ahead. The rest describe how things
are done now and can change when there's a reason.

## What it is

One question, answered at a glance: *what should I wear today?* A hand-drawn penguin dressed for the weather,
the temperature, and one line of advice. Tomorrow is one swipe away. That's the whole app.

- Keep it close to v1.3 (2016): the same penguins, pale blue, thin type, one screen per day. Modernize the
  plumbing, not the character. **(owner)**
- Free, no ads, no accounts, no sign-in. **(owner)** Nothing that identifies the person is stored or sent (see
  `docs/STATS.md`).
- When adding something, ask whether it helps answer "what do I wear?". Extra weather data (wind, UV, hourly
  charts) belongs in Apple Weather, not here.

## The drawings

- The penguins are hand-drawn originals and that matters. Never redraw, regenerate, trace, restyle or AI-upscale
  them. Crop and resize only. **(owner)**
- Eight outfits: nothing (no forecast yet), cold (sweater, scarf, hat), jacket, raincoat, T-shirt, poncho, bikini,
  bikini with swim cap. There is no cold-and-rainy drawing, so cold wins.
- New pictures (icons, illustrations) should come from the owner's hand-drawn art, not be made to look like it.
  If something new is needed and there's no drawing for it, use plain type or a system symbol and ask for a drawing.
- The penguin is the largest thing on the screen, centred or standing at the bottom edge, never cropped. Leave
  pale blue around it.
- Rain is the v1 raindrop tile, drawn behind the penguin and fading out before the text. On the phone it falls
  slowly; Reduce Motion stops it. Nothing else animates.

## Starting settings

- °C or °F: what the person chose in iOS (Settings › General › Language & Region › Temperature), else their region's.
- Clothing temperatures: 1.3's (45, 68, 90 °F), moved for the local climate the first time the app knows where it is
  and only if they've never been set: about 0.31° per degree of the place's yearly average away from San Francisco's
  (`ClimateDefaults.swift`). Reset to defaults goes back to those.
- Morning penguin: off. It notifies, so people turn it on themselves.

## Colour

| Name | Value | Use |
| --- | --- | --- |
| Sky | `#d8e2ff` | every background in the app, widgets and watch; the launch screen |
| Ink | `#000000` | the big number, titles, advice |
| Soft | `#3c4150` | secondary text: High/Low, the condition, hints |
| Link | `#1f5fbf` | text buttons and links (4.7:1 on Sky; the website uses it too) |
| Control blue | `#0073f0` | focus rings only (3.5:1: fine for shapes, too light for text) |

- No dark mode: the app is always light, on Sky (`UIUserInterfaceStyle: Light`). The penguins are drawn for a
  light background.
- No gradients, shadows or cards in the app. Flat Sky, black lines, the drawings' own colours.
- Widgets keep their colour on a tinted Home Screen (the penguin is drawn full colour).

The website (`web/site.css`) has its own, slightly different palette: a sky blue `#d7eef5`, a sun yellow
`#ffff96` and the handwritten Sue Ellen Francisco for headings. It's the marketing page; the app doesn't use it.

## Type

- App: Inter (SIL OFL, bundled), weight 200 for almost everything. The big temperature is the thinnest and
  largest thing; labels are light; advice is regular. Native views (watch, widgets) use the system font at
  `.thin`/`.light` to match.
- Sizes on a phone: temperature 72 pt at weight 100 (52 on short screens, 110 on iPad), day title 22, High/Low
  and condition 22, error titles 30, settings text 17 to 20, small print 12 to 16.
- Sentence case everywhere. No all-caps, no bold except the Done button.
- Numbers: whole °F; °C to one decimal in the person's number format (`formatTemp` in `rules.js`). The phone and watch
  show the bare number, as v1 did ("59", "High of 63"); widgets, the Lock Screen, Siri and Settings add the `°`. The
  unit letter only in Settings.

## Voice

The penguin talks like a friend glancing out the window: short, plain, a little playful. **(owner: "penguin
voice")**

- Advice is one sentence, a few words, starting with the action: "Grab a jacket.", "Raincoat and rain hat today."
  An exclamation mark is allowed when the weather earns it ("T-shirt weather!").
- Errors say what happened and what to do, without blame: "Couldn't get the weather. Please try again in a
  moment." Technical detail (Apple's error code) goes small and grey underneath, for bug reports.
- No jargon (precipitation probability, dew point), no weather-app clichés, no emoji in the app or store text.
- Condition names come from Apple's Weather wording, in the person's language.
- Every string is translated (17 languages); keep English short so translations fit.

## Layout and controls

- One idea per screen. Today and Tomorrow are full-screen pages you swipe between; Settings is a sheet.
- Settings applies and saves each change as it's made (the pages behind it change too); its only button is Done,
  and closing it any way keeps the changes. No Cancel.
- Controls are few and quiet: a gear in the corner, text buttons, outlined pill buttons (1 px black border,
  rounded) for the one main action on a screen.
- Two-way choices (°F / °C) are a toggle: one outlined pill, the chosen half filled black, sliding across.
- Settings is a list of sections split by hairlines: the clothes slider first (what people come for), then
  Temperature, then Morning penguin, then the website and privacy links, small and centred. A section's title is
  18 pt light on the left, a one-line explanation under it in Soft, its control on the right. Every control
  (toggle, menu, time) is the same 40 pt pill.
- Where iOS has a control for the job, use it, so it behaves the way people expect: system pickers for times and
  lists (a `<select>`, `<input type=time>`), system notifications.
- The custom part is the temperature slider: one track with three handles (where the jacket, T-shirt and bikini
  start), each penguin standing over its stretch of the track and the temperatures under the handles. Drag a
  handle and the penguins move with it.
- Every screen shape: iPhone portrait and landscape, iPad (also Split View and Slide Over), iPhone Duo flat, held
  like a book and propped up like a laptop. On wide screens Today and Tomorrow sit side by side; on a fold, never
  put text across the hinge.
- Tap targets at least 44 pt. Tapping gives feedback (pressed state). No zooming the app's pages.

## Small surfaces

- **Widgets (Home Screen):** Sky background, the penguin standing at the bottom edge, the big thin number top
  left. Small: number and High/Low only. Medium: add the condition and the advice line, with "Today  Tomorrow" at
  the top (tap Tomorrow to see tomorrow's penguin there for a few hours), or Today and Tomorrow side by side. Rain shows as the raindrop tile at the top. No forecast yet: the plain penguin, no numbers.
- **Lock Screen:** the round spot shows the penguin and the number, the rectangle adds the advice, the line above the
  clock is words only ("59° Raincoat and rain hat today."). iOS tints them to the wallpaper.
- **Siri, Shortcuts, Spotlight, Action button:** "What should I wear?" answers with the advice, the number and the
  condition, and shows the penguin on Sky with them. Same voice as the app.
- **Morning notification:** the advice as the title, the day's weather as the body, the day's drawing attached.
- **Apple Watch:** one day per page (turn the crown for Tomorrow), the same order as the phone: title, penguin,
  number with High/Low, condition. Complications: the penguin first; the number when there's room.
- **iMessage stickers:** the eight penguins, cropped, nothing added.

## Apple Weather attribution

Apple requires its Weather mark and a link to its other data sources wherever WeatherKit data is shown. The weather
page shows only the small light mark at the bottom, and tapping it opens Apple's data-sources page; Settings shows
the mark and "Other data sources" together above the website links. Don't remove the mark from the weather page:
Apple's wording is "prominently", and attribution only on a secondary screen has been rejected in review.

## Accessibility

- Every penguin has a spoken description of its outfit ("A penguin in a yellow raincoat and rain hat").
- Text is real text (never baked into an image) so it scales and translates. The app follows the person's iOS
  text size by zooming the page (up to 1.5×); on narrow widths each setting's control goes under its title.
- Text stays at least 4.5:1 against Sky: Ink 16:1, Soft 7.9:1, Link 4.7:1. Check a new colour before using it.
- Reduce Motion stops the falling rain.

## Store pages and screenshots

- Screenshots are real screens from the app with sample weather (`app/ios/store/screenshots.js`, the Watch and
  Widget screenshot workflows), not mock-ups. Regenerate them when what's on screen changes.
- Each phone, iPad and Duo screenshot has a short caption above the screen (`app/ios/store/captions.json`, every
  App Store language): on Link blue (`#1f5fbf`) so the Sky screen stands out, white Inter 300, sentence case, a
  hairline round the screen, no gradients, shadows or device frames. Watch screenshots have no caption. The widgets screenshot (iPhone 5) comes from
  the Store widget screenshots workflow; its wallpaper is the one gradient, because it's a Home Screen.
- Trailers and the app preview (`tools/trailer.js`): the same blue and white captions, the app in a phone-shaped
  window, the website's umbrella penguin and hand lettering on the title and end cards, crossfades, and quiet
  music made for them (`tools/music.py`: soft mallets over a slow pad, well below normal loudness).
- Store text follows the voice above. No emoji (App Store Connect refuses them in What's New anyway).
