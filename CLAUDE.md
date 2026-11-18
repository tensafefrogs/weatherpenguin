# Weather Penguin

A hand-drawn penguin that shows what to wear. iOS app = a small native SwiftUI shell (`app/ios/`) around the
web UI in `web/app/`, which is also the demo on weatherpenguin.com (`web/`, GitHub Pages). README.md has the
layout, how to run it, and releasing. `docs/DESIGN.md` is how it should look and sound (colours, type, voice,
drawings, widgets and watch): read it before adding anything to a screen.

## Working on it

- Test before every commit: `cd web && npm test` (outfit and rain rules, translations, morning notification).
  Check it ends with `fail 0`; don't pipe it through `tail` and miss a failure above it.
- Look at changes on screen: `NODE_PATH=$(npm root -g) node tools/screenshot.cjs <out-dir> "app/?sample=rainLater"`
  (samples: rainLater, hot, cold, warm, rainNow; `&error=weatherFailed`; `#tomorrow`, `#settings`; `&lang=de`).
  `#settings` is the tool's own step (it clicks the gear); the page itself doesn't open Settings from the URL.
  Native-only parts (Morning penguin) are hidden in a browser: in a Playwright script of your own, add
  `page.addInitScript(() => { window.WPApp = { reminders: true } })`. Chromium is not Safari: ask for a phone
  screenshot when layout or touch matters (tap feedback, zoom and focus rings all differ).
- Screen shapes: iPhone, iPad (also Split View and Slide Over) and iPhone Duo, opened flat, held like a book
  (`?fold=v`) and propped up like a laptop (`?fold=h`); `web/app/layout.js` sets the classes. Anything new on screen
  must work in each: prefix the screenshot path with a device (`ipad:`, `ipad-land:`, `slideover:`, `phone-land:`,
  `duo:`, `duo-land:`, `duo-book:`, `duo-table:`).
- A push that changes `app/ios/` or `web/app/` runs a simulator build (the **iOS** workflow): check it passes.
  It uses Xcode 26, so it skips the iPhone Duo fold code; to check that compiles, run the iOS workflow by hand
  (Upload off, Xcode 27.1 on). Uploads build with Xcode 27.1 (`"xcode27": true` in release.json).
- The penguin drawings are hand-drawn originals. Never redraw, regenerate or AI-upscale them; crop and resize
  only (`tools/make_stickers.py` for the stickers).
- The repository is public: code under MIT, the name and all artwork © EEG LLC (README, "License"). Never commit
  keys, tokens, personal details or build output; secrets live only in Actions secrets and variables. The original
  source art and the pre-2.0 code are in the owner's private archive repository, not here.
- The page talks to the app through `web/app/bridge.js` (message list there); keep the page working in a plain
  browser, where there's no app.
- Outfit and rain rules are v1.3's (`web/app/rules.js`); settings use v1.3's UserDefaults keys
  (`app/ios/WeatherPenguin/Settings.swift`) so existing users keep theirs. Don't rename those keys. New users'
  starting temperatures are 1.3's moved for their climate (`ClimateDefaults.swift`, iOS 18+), never existing ones.
- The Apple Watch app is native (`app/ios/Watch`, `WatchWidgets`, `Shared`). `Shared/Outfit.swift` and
  `Shared/PenguinForecast.swift` are the Swift copy of `rules.js`: change both together. After changing the drawings
  or a translation the watch uses, run `python3 -I tools/make_watch_assets.py`. CI builds the Watch app on its own
  scheme; the **Watch screenshots** workflow shows it running.
- The Home Screen widgets (`app/ios/Widgets`, small and medium) use the same `Shared/` code. The **Widget screenshots**
  workflow lays them out at their real sizes (the `WidgetPreview` app, never shipped) and commits `docs/widgets-*.png`:
  run it after changing them and look at the pictures.
- Watch and widget layout can only be seen through those screenshot workflows. When a picture is wrong and the
  cause isn't obvious, don't guess twice: add a temporary on-screen readout (sizes, safe areas,
  `UIImage(named:) == nil`) for one run, read it, fix, remove it.

## Languages

- Text the user sees goes through `T("English text")` (`web/app/i18n.js`) and needs an entry in every table,
  `web/app/lang/<tag>.js`; the test checks every key and placeholder. `node web/app/keys.js` lists the keys.
  Static text in `index.html` uses `data-t` / `data-t-label`.
- WeatherKit's condition text arrives already translated by iOS; rain is decided from `conditionCode`, never
  from the English words.
- A new language: its table, the tag in `LANGS` (`i18n.js`), `app/ios/WeatherPenguin/<lproj>.lproj/InfoPlist.strings`,
  the tag in both `CFBundleLocalizations` lists (`app/ios/project.yml`), `app/ios/store/l10n/<locale>.json`, and the
  locale in the screenshots matrix in `.github/workflows/store.yml`. A new script may need the font
  (`web/app/fonts/Inter.woff2` is subset to Latin and Cyrillic; CJK uses the system font).
- Machine translations ship; a native speaker's read-through is welcome. Weather condition names should match
  Apple's Weather app.

## Releasing

To ship, edit `app/ios/release.json` and push to `main` (README.md, "Releasing"). `app/ios/store/status.md` shows
where the app stands. **Never submit for App Review or release to the App Store without the owner's go-ahead for
that version**, and say exactly what will happen. After changes to what's on screen, regenerate the store
screenshots (`node app/ios/store/screenshots.js`) in the same change and look at them. When the change is
noticeable, re-record the trailers and app preview (`node tools/trailer.js`, `--vertical`, `--preview`) and the
App Review video (the **Review video** workflow), and watch them.

## Apple, GitHub and this container: what tripped things up before

- Claude can't set Actions secrets or variables, GitHub Pages settings, or App Services checkboxes; say exactly what
  the owner should click. `gh` has no access here; use the GitHub MCP tools (run workflows, read job logs).
  App Store Connect work goes through workflows (`app/ios/store/*.py` with the key in Actions secrets).
- WeatherKit needs two checkboxes per App ID: Capabilities (the API and the App IDs workflow can do it) and
  **App Services** (only by hand). Missing App Services = `WDSJWTAuthenticatorServiceListener.Errors 2` on the
  error page. The old App ID prefix (`4Z6JPDD4A4`) is not a problem for WeatherKit.
- A new target or extension: register its App ID (add it to `app/ios/store/app_ids.py` and `check_key.py`), sign it
  with its entitlements in `app/ios/scripts/upload.sh` (ad hoc step and the entitlement check), and declare its
  entitlements under `entitlements: properties:` in `project.yml`, because xcodegen rewrites the .entitlements file
  from there (with only a path it writes an empty one and the build loses WeatherKit/iCloud). An app target with
  no icon needs `ASSETCATALOG_COMPILER_APPICON_NAME: ""`.
- watchOS asset catalogs keep only 1x and 2x: a 3x-only image is silently left out (mark it 2x). A watch
  `TabView(.verticalPage)` page reserves about a fifth of the screen top and bottom; fill it with `.ignoresSafeArea()`.
- Release failures: Apple's servers time out or return 500 now and then, often just after App ID changes. Re-run the
  failed job once; a second failure of the same kind means wait, not push. README "Making a release" lists the
  errors and what each means. TestFlight builds reach no one if the group has no testers (`status.md` shows counts).
- Every job failing within seconds, with no steps and no log (macOS first, then Linux): the account's Actions
  spending limit or a failed payment, not the code. Re-running won't help. The run page's annotations say so; the
  owner fixes it in Settings, Billing. (Public repos get standard runners free; if the repo is ever private again,
  macOS minutes count ten times: run the macOS workflows only when needed.)
- DNS checks without `dig`: `dns.google/resolve` with several `edns_client_subnet` values (one cache can be hours
  stale). This container's proxy can't reach a host that isn't on the environment's allowlist; ask before adding one.
- Waiting on a workflow: no foreground `sleep`; run a background loop that fetches `origin/main` until the
  workflow's commit appears (status, screenshots), or check the run with the GitHub tools. Update with
  `git fetch -q origin main && git rebase -q origin/main` (`git pull --rebase` here can fail with "Cannot rebase onto
  multiple branches").
- Web UI on iOS: `:active` needs a `touchstart` listener; double-tap zoom needs `touch-action: manipulation` (and the
  web view's zoom off); `showModal()` focuses the first button unless something has `autofocus`; a loading state must
  not keep drawing the last error.
- Translations: removing a string means removing it from every `lang/*.js` (the test fails on unused keys). Watch and
  widget strings come from those tables through `KEYS` in `tools/make_watch_assets.py`; add new ones there and rerun it.
- Scripted edits: when a Python one-liner rewrites a file, never `open(p, 'w')` and read `p` in the same expression
  (the write empties it first). Check `git diff --stat` before committing.

## Mistakes to avoid

- Emoji in What's New or What to Test: App Store Connect refuses them.
- Pushing release.json to "try something": every push to it runs a release.
- Storing anything identifying the user. Stats are anonymous GoatCounter counts only, through `track()` in
  `web/app/stats.js`: if you add, rename or remove an event, update `docs/STATS.md` and check `web/privacy.html`
  and the App Privacy answers in README.md still describe it. Never send anything that could identify someone
  (no place names, coordinates, IDs or free text).
