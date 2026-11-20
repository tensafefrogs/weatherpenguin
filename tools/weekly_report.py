#!/usr/bin/env python3
"""The weekly report: how Weather Penguin is used (GoatCounter) and what people say (App Store ratings and reviews).

usage: python3 -I tools/weekly_report.py [--days 7]

- Usage: GoatCounter's API for weatherpenguin.goatcounter.com, this week and the week before. Needs a read-only API
  token: GOATCOUNTER_TOKEN, or (in the agent's cloud environment) the network proxy adds it by itself.
- Ratings and reviews: Apple's public lookup and reviews feeds, per storefront (no key needed). Written reviews
  are public on the App Store, but they're people's words: the report is for the owner, never committed.
- Downloads aren't here: they need an App Store Connect key with the Sales and Reports role (README, Releasing).
Prints Markdown.
"""
import datetime, json, os, sys, urllib.parse, urllib.request

APP_ID = '713690248'
GOATCOUNTER = 'https://weatherpenguin.goatcounter.com/api/v0'
# the storefronts of the app's languages, and the biggest English ones
STOREFRONTS = ['us', 'gb', 'ca', 'au', 'de', 'fr', 'es', 'mx', 'it', 'br', 'pt', 'nl', 'se', 'dk', 'no', 'fi', 'pl',
               'ru', 'jp', 'kr', 'cn', 'tw', 'hk', 'ch', 'at', 'be', 'ie', 'nz']


def fetch(url, headers=None):
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'weatherpenguin-report', **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def goatcounter(path, **params):
    token = os.environ.get('GOATCOUNTER_TOKEN', '').strip()
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    return fetch(f'{GOATCOUNTER}{path}?{urllib.parse.urlencode(params)}', headers)


def counts(start, end):
    """{path: visitors} for every page and event in [start, end)."""
    out, after = {}, None
    while True:
        params = {'start': start.isoformat(), 'end': (end - datetime.timedelta(days=1)).isoformat(), 'limit': 100}
        if after: params['exclude_paths'] = after
        page = goatcounter('/stats/hits', **params)
        for h in page.get('hits', []):
            out[h['path']] = out.get(h['path'], 0) + (h.get('count') or 0)
        if not page.get('more'): return out
        after = ','.join(str(h['path_id']) for h in page['hits'])


def usage(days):
    today = datetime.date.today()
    this = counts(today - datetime.timedelta(days=days), today + datetime.timedelta(days=1))
    last = counts(today - datetime.timedelta(days=2 * days), today - datetime.timedelta(days=days))
    lines = [f'## Usage, last {days} days (the {days} before in brackets)', '']

    def n(path): return this.get(path, 0), last.get(path, 0)

    def row(label, path):
        a, b = n(path)
        if a or b: lines.append(f'- {label}: **{a}** ({b})')

    app = 'weatherpenguin-ios/'
    row('App launches', app + 'platform/ios')
    row('New devices (first launch)', app + 'start')
    row('Swiped to Tomorrow', app + 'view/tomorrow')
    row('Changed the temperatures', app + 'settings/temperatures')
    row('Turned Morning penguin on', app + 'morning/on')
    row('Turned Morning penguin off', app + 'morning/off')
    row('Morning notification tapped', app + 'morning/opened')
    row('Apple Watch app opened', app + 'watch/open')
    row('Siri or Shortcuts asked', app + 'siri/what-to-wear')

    def group(title, prefix):
        items = sorted(((p[len(prefix):], c) for p, c in this.items() if p.startswith(prefix)), key=lambda x: -x[1])
        if items: lines.append(f"- {title}: " + ', '.join(f'{k} {c}' for k, c in items))

    group('Languages', app + 'lang/')
    group('Units', app + 'units/')
    group('Screens', app + 'layout/')
    group('Widgets installed (launches that had them)', app + 'widget/')
    group('Outfits shown', app + 'outfit/')
    group('Errors', app + 'error/')
    site = sorted(((p, c) for p, c in this.items() if not p.startswith(app) and not p.startswith('weatherpenguin/')), key=lambda x: -x[1])
    if site:
        lines.append('- Website pages: ' + ', '.join(f'{p} {c}' for p, c in site[:12]))
    return lines


def ratings(days):
    since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
    lines, total, weighted, reviews = [], 0, 0.0, []
    per_store = []
    for cc in STOREFRONTS:
        try:
            r = fetch(f'https://itunes.apple.com/lookup?id={APP_ID}&country={cc}').get('results', [])
        except Exception:
            continue
        if r and r[0].get('userRatingCount'):
            c, avg = r[0]['userRatingCount'], r[0].get('averageUserRating') or 0
            total += c; weighted += c * avg
            per_store.append((cc.upper(), c, avg))
        try:
            feed = fetch(f'https://itunes.apple.com/{cc}/rss/customerreviews/page=1/id={APP_ID}/sortby=mostrecent/json').get('feed', {})
        except Exception:
            continue
        entries = feed.get('entry', [])
        for e in entries if isinstance(entries, list) else [entries]:
            when = datetime.datetime.fromisoformat(e.get('updated', {}).get('label', '1970-01-01T00:00:00+00:00'))
            if when < since or 'im:rating' not in e: continue
            reviews.append((when, cc.upper(), int(e['im:rating']['label']), e.get('im:version', {}).get('label', ''),
                            e.get('title', {}).get('label', ''), e.get('content', {}).get('label', '')))
    lines += ['## Ratings', '']
    if total:
        lines.append(f'- All storefronts checked: **{weighted / total:.2f}** from {total} ratings')
        lines.append('- ' + ', '.join(f'{cc} {avg:.1f} ({c})' for cc, c, avg in sorted(per_store, key=lambda x: -x[1])))
    else:
        lines.append('- No ratings found')
    lines += ['', f'## Written reviews, last {days} days', '']
    if not reviews:
        lines.append('- None')
    for when, cc, stars, version, title, text in sorted(reviews, reverse=True):
        lines.append(f'- {"★" * stars}{"☆" * (5 - stars)} {cc}, {when.date()}, version {version}: **{title}** {text[:400]}')
    return lines


def main():
    days = int(sys.argv[sys.argv.index('--days') + 1]) if '--days' in sys.argv else 7
    out = [f'# Weather Penguin, week to {datetime.date.today()}', '']
    try:
        out += usage(days)
    except Exception as e:
        out += ['## Usage', '', f'- GoatCounter not readable: {e}']
    out += [''] + ratings(days)
    out += ['', '_Downloads: App Store Connect → Analytics (not in this report; it needs a Sales and Reports key)._']
    print('\n'.join(out))


if __name__ == '__main__':
    main()
