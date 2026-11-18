"""Registers the app's App IDs in the developer portal and turns on what they need, with the App Store Connect
API key (Admin role). Safe to run again: it only adds what's missing, and prints what it found.
Run by the **App IDs** workflow (Actions tab).

  the app             BUNDLE_ID                                WeatherKit, iCloud (key-value storage)
  iMessage stickers   BUNDLE_ID.Weather-Penguin-Sticker-Pack   nothing
  Home Screen widgets BUNDLE_ID.widgets                        WeatherKit, iCloud
  Watch app           BUNDLE_ID.watchkitapp                    WeatherKit, iCloud
  complications       BUNDLE_ID.watchkitapp.widgets            WeatherKit, iCloud
"""
import sys
from asc import ApiError, BUNDLE_ID, request

IDS = [
    (BUNDLE_ID, 'Weather Penguin', ['WEATHERKIT', 'ICLOUD']),
    (BUNDLE_ID + '.Weather-Penguin-Sticker-Pack', 'Weather Penguin Stickers', []),
    (BUNDLE_ID + '.widgets', 'Weather Penguin Widgets', ['WEATHERKIT', 'ICLOUD']),
    (BUNDLE_ID + '.watchkitapp', 'Weather Penguin Watch', ['WEATHERKIT', 'ICLOUD']),
    (BUNDLE_ID + '.watchkitapp.widgets', 'Weather Penguin Complications', ['WEATHERKIT', 'ICLOUD']),
]
# iCloud with the current (Xcode 6 and later) setup; the app uses only key-value storage, so no containers
SETTINGS = {'ICLOUD': [{'key': 'ICLOUD_VERSION', 'options': [{'key': 'XCODE_6', 'enabled': True}]}]}

problems = []
byhand = []   # WeatherKit can only be turned on in the browser
for ident, name, wanted in IDS:
    found = request('GET', f'/v1/bundleIds?filter[identifier]={ident}&include=bundleIdCapabilities&limit=10')
    b = next((x for x in found['data'] if x['attributes']['identifier'] == ident), None)
    if b:
        print(f'{ident}: already registered ({b["attributes"]["name"]})')
    else:
        try:
            b = request('POST', '/v1/bundleIds', {'data': {'type': 'bundleIds', 'attributes': {
                'identifier': ident, 'name': name, 'platform': 'IOS'}}})['data']
            print(f'{ident}: registered as "{name}"')
            found = {'included': []}
        except ApiError as e:
            problems.append(f'{ident}: could not register it ({e.code}): {e.body[:300]}')
            continue
    have = {c['attributes'].get('capabilityType') for c in found.get('included', [])}
    for cap in wanted:
        if cap in have:
            print(f'  {cap}: already on')
            continue
        if cap == 'WEATHERKIT':   # the API lists it but won't turn it on (409 "not a valid value")
            byhand.append(ident)
            print(f'  WEATHERKIT: off; turn it on by hand (below)')
            continue
        attrs = {'capabilityType': cap}
        if cap in SETTINGS: attrs['settings'] = SETTINGS[cap]
        try:
            request('POST', '/v1/bundleIdCapabilities', {'data': {'type': 'bundleIdCapabilities', 'attributes': attrs,
                    'relationships': {'bundleId': {'data': {'type': 'bundleIds', 'id': b['id']}}}}})
            print(f'  {cap}: turned on')
        except ApiError as e:
            if e.code == 409 and 'already' in e.body.lower():
                print(f'  {cap}: already on')
            else:
                problems.append(f'{ident}: could not turn on {cap} ({e.code}): {e.body[:300]}')

for ident in byhand:
    print(f'::warning::Turn on WeatherKit for {ident} at developer.apple.com → Identifiers → {ident}: '
          'tick WeatherKit under both Capabilities and App Services, then Save.')
if problems:
    for p in problems: print('::error::' + p)
    sys.exit('Some of it needs doing by hand at developer.apple.com → Identifiers (README.md, "Releasing").')
print('All the App IDs are registered' + (' (WeatherKit by hand, above).' if byhand else ' with what they need.') + ' Check WeatherKit is also on under App Services '
      '(developer.apple.com → Identifiers → each ID → App Services); it can take about 30 minutes to start working.')
