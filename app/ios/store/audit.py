#!/usr/bin/env python3
"""A read-only check of everything App Store Connect and the developer portal hold for the app, to find settings left
over from 1.x (2013-2016) that may be stale. Changes nothing.

usage: python3 app/ios/store/audit.py        (the App Store audit workflow runs it; credentials as in asc.py)

The repository is public, so its workflow logs are too: this prints counts, types, states and dates, never names,
email addresses, device IDs or certificate owners.
"""
import collections, datetime, os, sys
from asc import ApiError, BUNDLE_ID, app as get_app, request

out = []
NOW = datetime.datetime.now(datetime.timezone.utc)


def say(*a):
    line = ' '.join(str(x) for x in a)
    out.append(line)
    print(line, flush=True)


def get(path):
    """The response, or None (with the reason) when this key can't read it or the API doesn't have it."""
    try:
        return request('GET', path)
    except ApiError as e:
        say(f'  (not readable: {e.code})')
        return None


def every(path):
    items, page = [], get(path)
    while page:
        items += page.get('data', [])
        nxt = page.get('links', {}).get('next')
        page = request('GET', nxt[nxt.index('/v', 8):]) if nxt else None   # the next page's path, without the host
    return items


def age(iso):
    if not iso: return ''
    d = datetime.datetime.fromisoformat(iso.replace('Z', '+00:00'))
    days = (d - NOW).days
    return f'expired {d.date()}' if days < 0 else f'expires {d.date()} ({days} days)'


def main():
    a = get_app(); app_id = a['id']; at = a['attributes']
    say('## The app')
    say(f"- Primary language: {at.get('primaryLocale')}; content rights: {at.get('contentRightsDeclaration')};"
        f" made for kids: {at.get('isOrEverWasMadeForKids')}")

    say('\n## App information')
    for info in (get(f'/v1/apps/{app_id}/appInfos') or {}).get('data', []):
        ia = info['attributes']
        say(f"- App info ({ia.get('appStoreState') or ia.get('state')}): age rating {ia.get('appStoreAgeRating')},"
            f" Brazil rating {ia.get('brazilAgeRatingV2') or ia.get('brazilAgeRating')}, kids band {ia.get('kidsAgeBand')}")
        cats = get(f"/v1/appInfos/{info['id']}?include=primaryCategory,secondaryCategory")
        if cats:
            rel = cats['data']['relationships']
            say(f"  Categories: {(rel.get('primaryCategory', {}).get('data') or {}).get('id')} /"
                f" {(rel.get('secondaryCategory', {}).get('data') or {}).get('id')}")
        decl = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")
        if decl and decl.get('data'):
            answers = {k: v for k, v in decl['data']['attributes'].items() if v not in (None, 'NONE', False)}
            say(f"  Age rating answers that aren't none/no: {answers or 'none'}")
        locs = (get(f"/v1/appInfos/{info['id']}/appInfoLocalizations?limit=200") or {}).get('data', [])
        stale = [l['attributes']['locale'] for l in locs if 'weatherpenguin.com/privacy' not in (l['attributes'].get('privacyPolicyUrl') or '')]
        say(f"  Languages: {len(locs)}: {', '.join(sorted(l['attributes']['locale'] for l in locs))}")
        say(f"  Languages without the current privacy policy URL: {', '.join(stale) or 'none'}")

    say('\n## Versions')
    for v in every(f'/v1/apps/{app_id}/appStoreVersions?limit=50'):
        va = v['attributes']
        say(f"- {va['versionString']} ({va.get('platform')}): {va.get('appStoreState')}, release {va.get('releaseType')},"
            f" copyright \"{va.get('copyright')}\"")
        if va.get('appStoreState') in ('PREPARE_FOR_SUBMISSION', 'WAITING_FOR_REVIEW', 'IN_REVIEW', 'READY_FOR_DISTRIBUTION', 'READY_FOR_SALE'):
            locs = (get(f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations?limit=200") or {}).get('data', [])
            urls = collections.Counter((l['attributes'].get('supportUrl'), l['attributes'].get('marketingUrl')) for l in locs)
            say(f"  {len(locs)} languages; support/marketing URLs: {dict(urls) if len(urls) < 4 else str(len(urls)) + ' different pairs'}")
            detail = get(f"/v1/appStoreVersions/{v['id']}/appStoreReviewDetail")
            if detail and detail.get('data'):
                d = detail['data']['attributes']
                filled = {k: bool(d.get(k)) for k in ('contactFirstName', 'contactLastName', 'contactPhone', 'contactEmail', 'notes')}
                say(f"  App Review details filled in: {filled}; demo account required: {d.get('demoAccountRequired')}")

    say('\n## Availability and price')
    av = get(f'/v1/apps/{app_id}/appAvailabilityV2')
    if av and av.get('data'):
        say(f"- Available in new countries automatically: {av['data']['attributes'].get('availableInNewTerritories')}")
        terr = every(f"/v2/appAvailabilities/{av['data']['id']}/territoryAvailabilities?limit=200")
        states = collections.Counter('available' if t['attributes'].get('available') else (t['attributes'].get('contentStatuses') or ['not available'])[0] for t in terr)
        say(f"- Countries and regions: {dict(states)}")
    sched = get(f'/v1/apps/{app_id}/appPriceSchedule?include=baseTerritory')
    if sched and sched.get('data'):
        prices = (get(f"/v1/appPriceSchedules/{sched['data']['id']}/manualPrices?include=appPricePoint&limit=5") or {})
        pts = [i['attributes'].get('customerPrice') for i in prices.get('included', []) if i['type'] == 'appPricePoints']
        say(f"- Price: {pts or 'no manual price'} (base territory {(sched['data']['relationships'].get('baseTerritory', {}).get('data') or {}).get('id')})")

    say('\n## Things from the old days')
    for label, path in [('In-app purchases', f'/v1/apps/{app_id}/inAppPurchasesV2?limit=50'),
                        ('Subscription groups', f'/v1/apps/{app_id}/subscriptionGroups?limit=50'),
                        ('Encryption declarations', f'/v1/apps/{app_id}/appEncryptionDeclarations?limit=50'),
                        ('Custom licence agreement (EULA)', f'/v1/apps/{app_id}/endUserLicenseAgreement'),
                        ('Game Center', f'/v1/apps/{app_id}/gameCenterDetail'),
                        ('App Clips', f'/v1/apps/{app_id}/appClips'),
                        ('Accessibility declarations', f'/v1/apps/{app_id}/accessibilityDeclarations')]:
        r = get(path)
        if r is None: say(f'- {label}: (see above)'); continue
        data = r.get('data')
        items = data if isinstance(data, list) else ([data] if data else [])
        detail = collections.Counter((i.get('attributes') or {}).get('state') or (i.get('attributes') or {}).get('appEncryptionDeclarationState') or i['type'] for i in items)
        say(f'- {label}: {len(items)}' + (f' {dict(detail)}' if items else ''))

    say('\n## TestFlight')
    for g in every(f'/v1/apps/{app_id}/betaGroups?limit=50'):
        ga = g['attributes']
        n = len(every(f"/v1/betaGroups/{g['id']}/betaTesters?limit=200"))
        say(f"- A group ({'internal' if ga.get('isInternalGroup') else 'external'}), {n} testers, public link"
            f" {'on' if ga.get('publicLinkEnabled') else 'off'}, created {(ga.get('createdDate') or '')[:10]}")
    say(f"- Testers on the app in all: {len(every(f'/v1/betaTesters?filter[apps]={app_id}&limit=200'))}")

    say('\n## Developer portal')
    ids = every('/v1/bundleIds?limit=200&filter[platform]=IOS')
    ours = [b for b in ids if b['attributes']['identifier'].startswith(BUNDLE_ID.rsplit('.', 1)[0])]
    for b in ours:
        caps = [c['attributes'].get('capabilityType') for c in (get(f"/v1/bundleIds/{b['id']}/bundleIdCapabilities") or {}).get('data', [])]
        say(f"- App ID {b['attributes']['identifier']} (prefix {b['attributes'].get('seedId')}): {', '.join(sorted(c for c in caps if c)) or 'no capabilities'}")
    say(f"- Other App IDs on the account: {len(ids) - len(ours)}")
    certs = every('/v1/certificates?limit=200')
    for c in certs:
        ca = c['attributes']
        say(f"- Certificate: {ca.get('certificateType')}, {age(ca.get('expirationDate'))}")
    profiles = every('/v1/profiles?limit=200')
    states = collections.Counter((p['attributes'].get('profileType'), p['attributes'].get('profileState')) for p in profiles)
    say(f"- Provisioning profiles: {len(profiles)}: {dict(states)}")
    old = [p for p in profiles if p['attributes'].get('expirationDate') and p['attributes']['expirationDate'] < NOW.isoformat()]
    say(f"- Profiles past their expiry date: {len(old)}")
    devices = every('/v1/devices?limit=200')
    say(f"- Registered devices: {len(devices)} ({dict(collections.Counter(d['attributes'].get('status') for d in devices))});"
        f" added before 2020: {sum(1 for d in devices if (d['attributes'].get('addedDate') or '9') < '2020')}")

    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        open(summary, 'a').write('# App Store audit\n\n' + '\n'.join(out) + '\n')


if __name__ == '__main__':
    main()
