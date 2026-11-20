# Weather Penguin

A hand-drawn penguin who tells you what to wear today: the iOS app (with its Apple Watch app, widgets and
iMessage stickers) and the website, weatherpenguin.com. Free on the App Store, no ads, no accounts.

The code is open source under the MIT License. The name Weather Penguin, the penguin drawings, the icon and the
other artwork are not: see [License](#license).

| Path | What |
|---|---|
| `web/app/` | The app's screens as a small web page (iPhone, iPad and iPhone Duo layouts: `layout.js`): HTML, CSS and plain JavaScript modules, no build step. Bundled into the iOS app, and also the demo on the website. |
| `web/` | weatherpenguin.com: home, support, privacy and terms pages (GitHub Pages). |
| `app/ios/` | Native iOS shell (SwiftUI). Shows `web/app` in a web view, and provides location, Apple WeatherKit weather, settings (synced with iCloud), the morning notification and the iMessage stickers. `scripts/` and `store/`: release tooling. |
| `app/ios/Watch/`, `WatchWidgets/`, `Shared/` | The Apple Watch app and its watch face complications (native SwiftUI; a watch can't show the web UI). `Shared/` has the Swift copy of the outfit rules, the forecast, and the penguins and strings made by `tools/make_watch_assets.py` from `web/app`. |
| `tools/` | `screenshot.cjs`: screenshots pages of `web/` at iPhone size. `make_stickers.py`: rebuilds the iMessage stickers from the drawings. |

The penguin drawings in `web/app/images/` are the original files, unchanged. Fonts are open-licensed and bundled: Inter (`web/app/fonts/`) and Sue Ellen Francisco (`web/fonts/`), both SIL OFL.

How it should look and sound: [docs/DESIGN.md](docs/DESIGN.md).

## How it fits together

The web UI asks the native shell for weather through a small message bridge
(documented in `web/app/bridge.js`). The shell gets the location with Core
Location and the forecast from WeatherKit's Swift API, which needs no server or
API key. In a normal browser there's no shell, so the page shows sample weather
(`?sample=hot|cold|warm|rainLater|rainNow`, `?error=locationDenied`).

The outfit and rain rules are v1.3's (`web/app/rules.js`), and settings are
stored under v1.3's UserDefaults keys, so existing users keep their custom
temperatures and °C/°F choice.

## Work on it

```sh
cd web && npm test                       # outfit/rain rule tests (Node 22)
python3 -m http.server -d web 8000       # then open http://localhost:8000/app/?sample=rainLater
NODE_PATH=$(npm root -g) node tools/screenshot.cjs out/ "app/?sample=hot" "app/?sample=cold#settings" index.html
```

iOS (on a Mac with Xcode 26):

```sh
brew install xcodegen
cd app/ios && xcodegen generate && open WeatherPenguin.xcodeproj
```

The `.xcodeproj` is generated from `app/ios/project.yml` and isn't checked in.

CI (`.github/workflows/`) runs the web tests and builds the iOS app for the
simulator on every change to those folders.

## Releasing

Releases follow tensafefrogs/king-walk's tooling: a release is a commit to `app/ios/release.json`, and
GitHub builds, signs, uploads, hands the build to TestFlight and (only when the file says so) submits it.
No Mac needed.

### One-time setup

In this order (each step needs the one before):

1. **API key:** App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys →
   generate a key with the **Admin** role (so the build can make its own signing certificate and profiles).
   Download the `.p8` (only once); note the Key ID and the Issuer ID.
2. **GitHub** → this repo → Settings → Secrets and variables → Actions (the owner sets these; agents can't):

   | Secret | Value |
   | --- | --- |
   | `ASC_KEY_ID` | the key's Key ID |
   | `ASC_ISSUER_ID` | the Issuer ID shown above the keys list |
   | `ASC_KEY_P8` | the whole `.p8` file, including the BEGIN and END lines |

   | Variable | Value |
   | --- | --- |
   | `BUNDLE_ID` | `com.weatherpenguin.WeatherPenguin` |
   | `APPLE_TEAM_ID` | `K37CSPL839` (a secret works too) |
   | `GOATCOUNTER_URL` | `https://weatherpenguin.goatcounter.com/count` (optional; no stats without it) |

3. **App IDs:** Actions → **App IDs** → Run workflow (`app/ios/store/app_ids.py`). It registers whichever of these
   are missing and turns on iCloud and the WeatherKit *capability*:

   | App ID | What | Needs |
   | --- | --- | --- |
   | `com.weatherpenguin.WeatherPenguin` | the app (1.3's, old `4Z6JPDD4A4` prefix) | WeatherKit, iCloud |
   | `….Weather-Penguin-Sticker-Pack` | iMessage stickers | nothing |
   | `….widgets` | Home Screen widgets | WeatherKit, iCloud |
   | `….watchkitapp` | Watch app | WeatherKit, iCloud |
   | `….watchkitapp.widgets` | watch complications | WeatherKit, iCloud |

   Then **by hand**, for every ID that needs WeatherKit: developer.apple.com → Identifiers → the ID → **App Services**
   tab → tick WeatherKit → Save. Apple's API refuses to turn WeatherKit on (409) and can't see the App Services
   checkbox at all, and without it the app fails with `WeatherDaemon.WDSJWTAuthenticatorServiceListener.Errors 2`
   (shown under "Couldn't get the weather"). Allow ~30 minutes after ticking it; no new build is needed.
4. **TestFlight:** App Store Connect → the app → TestFlight → add an internal group called exactly **Internal**
   (release.json gives builds to it). A new group has no testers: run Actions → **TestFlight tester** to add the
   account holder (only them), or add people by hand. Internal testers must be App Store Connect users; anyone else
   needs an external group (with Apple's beta review). `status.md` shows each group's tester count.
5. **Check:** Actions → App Store release → Run workflow with "status_only" ticked. It only reads: the key, the app
   record, each App ID's capabilities and the signing certificates, then commits `status.md`.
6. **By hand in App Store Connect** (Apple's API doesn't cover these): App Privacy (below), price (Free) and
   availability (keep **iPhone and iPad Apps on Apple Silicon Macs** and **Apple Vision Pro** ticked: the iPad app runs
   on both as it is), and the App Review contact details. The listing's privacy and support URLs are on
   weatherpenguin.com, so the site must be live on HTTPS before submitting for review.

   **App Privacy answers:** data used to track you: none; data linked to you: none; data not linked to you, both
   for Analytics only: Usage Data → Product Interaction (GoatCounter event counts) and Location → Coarse Location
   (GoatCounter works out the country from the IP address and doesn't keep it). WeatherKit and iCloud are Apple's
   services and aren't declared by the app. If GoatCounter is never set up, the answer is "Data Not Collected".

Until the secrets are set, the release workflow does nothing but say what's missing.

### Making a release

`app/ios/release.json`:

```json
{
  "version": "2.0",
  "build": true,
  "testflight": {"groups": ["Internal"], "whats_new": "What testers should try"},
  "app_store": {"submit": true, "release": "manual", "whats_new": "What's new (one text, or per language)"},
  "release_now": false,
  "note": "change this to re-run with the same settings"
}
```

- `build`: build `main` and upload it as `version`; `false` reuses the newest processed build of that version.
- `testflight`: give the build to these groups with "What to Test" (`null` skips TestFlight).
- `app_store`: attach the build to the version, upload the listing, and with `submit` send it to App Review.
  `release`: `manual` or `after_approval`. `null` skips the App Store. **Don't submit or release without the
  owner's go-ahead for that version.**
- `release_now`: release a version that's approved and waiting for a manual release.

Push it to `main` and the **App Store release** workflow runs it, then writes `app/ios/store/status.md`
(versions, App Review state, builds, TestFlight groups) and commits it; it refreshes that once a day.
`app/ios/beta.json` plus Actions → App Store release → Run workflow ("beta") makes a TestFlight-only build of
the next version without touching what release.json is doing. Build numbers are the UTC date and time.

The listing (`app/ios/store/listing.json`, `l10n/<locale>.json`) and screenshots
(`node app/ios/store/screenshots.js [--lang <locale>]`) upload by themselves when they change on `main`
(the **App Store listing** workflow); other languages' screenshots are made in that workflow. Each one has a
caption above the screen from `app/ios/store/captions.json`. iPhone screenshot 5 is the widgets: run the
**Store widget screenshots** workflow after changing the widgets (it commits `screenshots/widgets/<locale>.png`),
then run screenshots.js again. What's New in `release.json` can be one text or one per App Store locale.

Videos, made by `node tools/trailer.js` from the app with sample weather, over quiet music made by `tools/music.py`
(Playwright, ffmpeg and numpy; about a minute each):
the trailers for the website and posts, `web/press/weather-penguin-trailer.mp4` (1920x1080) and `--vertical`
(1080x1920), each with a poster; and `--preview`, the App Store app preview `app/ios/store/previews/iphone-1.mp4`
(886x1920, 15 to 30 s, no URL or price), which `creative.py` places on the iPhone and iPhone Duo pages
(listing.json `"creative"`). The App Review video (`app/ios/store/review-video.mp4`, attached for guideline 2.1) is
the real app on simulators: the **Review video** workflow. Re-record them when what's on screen changes, and watch
them before committing.

Lessons king-walk learned the hard way (its `ios/README.md` has the details): no emoji in What's New or What to
Test; a push to release.json always runs a release; cancelling a run doesn't undo a submission already made;
only one version can be in review at a time.

When a release run fails, read the build job's log before doing anything else:

- `The request timed out` / `status code: 500` / `Error Downloading App Information` while locating signing assets or
  exporting: Apple's servers, not the code. Re-run the failed job once; if it fails the same way, wait (the App IDs
  workflow failing with a 500 too confirms Apple is having trouble) rather than pushing changes to "fix" it. It
  happened right after App ID settings changed in the browser.
- `Account credentials have expired` at the upload, while the key worked minutes earlier: Xcode's own sign-in to
  App Store Connect failed. `upload.sh` then sends the same signed .ipa with `altool` and the key; if that fails
  too, it's Apple, so wait.
- `No profiles for '…' were found` on its own (no timeout next to it): that App ID is missing or lacks a capability
  the entitlements ask for; run the App IDs workflow.
- `The signed app is missing: …`: the export dropped an entitlement; the named ID lacks that capability.
- Upload warning ITMS-90076 "Potential Loss of Keychain Access" for the sticker pack: expected and harmless (its new
  App ID has the team prefix, 1.3's had `4Z6JPDD4A4`; stickers have no code and no keychain).
- The build uploads but testers don't see it: the group has no testers (`status.md` says so), or the build expired
  (TestFlight expires older builds of a version when a newer one arrives).

## Apple Watch

The Watch app shows Today and Tomorrow (swipe up or turn the Digital Crown) and the complications show today's
penguin and temperature on the watch face. Both get their own location and WeatherKit forecast, and read the
temperature bands and °C/°F from the iCloud key-value store the iPhone app writes, so there are no settings on
the watch. After changing the drawings or translations, run `python3 -I tools/make_watch_assets.py`. The
**Watch screenshots** workflow (run by hand) builds the Watch app, runs it in the simulator with the sample
forecast, and commits the English App Store screenshots to `app/ios/store/screenshots/watch-*.png` (the
`APP_WATCH_ULTRA` set in `listing.json`); with "All App Store languages" ticked it does every language, into
`screenshots/watch/<locale>/`, which the listing workflow uploads to each language's page. Run it again after
changing what the watch shows.

## Home Screen widgets

`app/ios/Widgets`: **Weather Penguin** (small and medium: today's penguin, the temperature and what to wear) and
**Today & Tomorrow** (medium), and the Lock Screen's round, rectangular and one-line spots (the first widget). Like the watch complications they get their own forecast about once an hour with the
app's location permission, take the temperature bands and °C/°F from iCloud, and refresh when the app gets a
forecast or the settings change. The App ID is `com.weatherpenguin.WeatherPenguin.widgets` (WeatherKit under both
Capabilities and App Services, and iCloud; the App IDs workflow registers it). The **Widget screenshots** workflow
shows them (`docs/widgets-*.png`).

## Siri and Shortcuts

`app/ios/WeatherPenguin/WhatToWear.swift`: "What should I wear in Weather Penguin" (or "Ask Weather Penguin what to
wear") answers with today's advice and shows the penguin, without opening the app. It's also in the Shortcuts app,
Spotlight and the Action button's list. Phrases and titles are translated in each `WeatherPenguin/<lproj>/`
(`AppShortcuts.strings`, `Intents.strings`); the advice and weather words come from `Shared/`.

## Stats

Anonymous usage counts go to GoatCounter when `GOATCOUNTER_URL` is set (web/app/stats.js). `docs/STATS.md` lists
every event and how to read it.

`python3 -I tools/weekly_report.py` prints a week's usage (from GoatCounter's API, with a read-only token in
`GOATCOUNTER_TOKEN`), the App Store ratings per storefront and the week's written reviews (from Apple's public
feeds, no key). Downloads aren't in it: they need an App Store Connect key with the Sales and Reports role. The
report is for the owner; don't commit its output (reviews are people's words).

## Website

`.github/workflows/pages.yml` publishes `web/` to GitHub Pages on every push to `main` that changes it (and when
run by hand).

The home page comes in every App Store language (`/`, `/de/`, `/fr/`, `/ja/`, …), made by `python3 -I tools/make_site.py`
from the App Store text (`app/ios/store/listing.json` and `l10n/*.json`) plus a few labels in the script. Run it after
changing that text; it also writes `web/sitemap.xml` (each page with its other languages, for Google Search Console:
submit `https://weatherpenguin.com/sitemap.xml`) and `web/robots.txt`. Each App Store language links to its own page
(`marketing_url` in `l10n/<locale>.json`).

### Pointing weatherpenguin.com at GitHub Pages

The domain is registered with **Squarespace Domains** (it was Google Domains), which also hosts its DNS
(`ns-cloud-e*.googledomains.com`). It currently points at the old DreamHost server.

1. **GitHub, publish the site:** this repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
   Then Actions → Pages → Run workflow. The site appears at the address Settings → Pages shows.
2. **GitHub, verify the domain** (recommended, stops anyone else claiming it): your profile Settings → Pages →
   Add a domain → `weatherpenguin.com`. GitHub shows a TXT record to add in step 3: its **name** (host) is
   `_github-pages-challenge-tensafefrogs` and its **value** is the code GitHub shows (easy to swap by mistake),
   then click Verify.
3. **Squarespace** → Domains → `weatherpenguin.com` → DNS → DNS Settings:
   - Delete the records pointing at DreamHost (`173.236.249.172`: the `@` A record and any `www` record), and the
     "Squarespace Defaults" preset if it's there.
   - Add custom records:

     | Host | Type | Data |
     | --- | --- | --- |
     | `@` | A | `185.199.108.153` |
     | `@` | A | `185.199.109.153` |
     | `@` | A | `185.199.110.153` |
     | `@` | A | `185.199.111.153` |
     | `@` | AAAA | `2606:50c0:8000::153` |
     | `@` | AAAA | `2606:50c0:8001::153` |
     | `@` | AAAA | `2606:50c0:8002::153` |
     | `@` | AAAA | `2606:50c0:8003::153` |
     | `www` | CNAME | `tensafefrogs.github.io` |
     | `_github-pages-challenge-tensafefrogs` | TXT | the code from step 2 (Squarespace adds `.weatherpenguin.com`) |

4. **GitHub, set the custom domain:** this repo → Settings → Pages → Custom domain: `weatherpenguin.com` → Save
   (it's set). GitHub sends `www.weatherpenguin.com` to it. Once the DNS check passes (minutes, up to a day while
   the old records expire), tick **Enforce HTTPS**.

Check it: `dig +short weatherpenguin.com` shows the four `185.199.x.153` addresses and `dig +short www.weatherpenguin.com`
shows `tensafefrogs.github.io`. The App Store listing's privacy and support links need this live before review.

Without `dig` (an agent's container): `curl -s "https://dns.google/resolve?name=weatherpenguin.com&type=A&edns_client_subnet=1.2.3.0/24"`.
Ask with a few different `edns_client_subnet` values: one cache can still hold the old record for up to its TTL
(4 hours for the DreamHost one), and GitHub's "Domain does not resolve to the GitHub Pages server" check can see
that stale copy. If GitHub complains while the records are right, wait out the TTL, then remove and re-add the
custom domain in Settings → Pages to restart the check and the certificate. Until the certificate exists,
`https://weatherpenguin.com` fails with a certificate-name error and GitHub redirects to `http://`.

## License

The code (Swift, JavaScript, HTML, CSS, Python, workflows and the rest) is under the MIT License: see `LICENSE`.

The name Weather Penguin, the penguin drawings, the app icon, the stickers, the umbrella penguin and the other
artwork are © EEG LLC, all rights reserved, and are not covered by the MIT License. That includes the images in
`web/app/images/`, `web/img/`, the app's asset catalogs (`app/ios/**/*.xcassets`, `app/ios/Shared/`), the store
screenshots, trailers and app preview (`app/ios/store/`, `web/press/`, `docs/`), and anything made from them. You're
welcome to build and run the code for yourself, but please don't publish an app or site that uses the name or the
drawings. If you build your own app from this code, give it your own name and art.

The App Store badge (`web/img/app-store-badge.svg`) is Apple's, used under Apple's marketing guidelines.

The fonts are under the SIL Open Font License: Inter (`web/app/fonts/Inter-OFL.txt`) and Sue Ellen Francisco
(`web/fonts/SueEllenFrancisco-OFL.txt`).

