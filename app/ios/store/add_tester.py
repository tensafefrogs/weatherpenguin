"""Adds the App Store Connect account holder (the team's owner) to the Internal TestFlight group, so new builds
reach their phone. Only that one person: nobody else is added. Prints no names or emails.
Run by the **TestFlight tester** workflow (Actions tab). Safe to run again."""
import sys
import urllib.parse
from asc import ApiError, app as get_app, call, request

GROUP = 'Internal'
app_id = get_app()['id']
group = next((g for g in call('GET', f'/v1/apps/{app_id}/betaGroups?limit=50')['data'] if g['attributes']['name'] == GROUP), None)
if not group:
    sys.exit(f'::error::No TestFlight group called {GROUP}.')

owners = [u for u in call('GET', '/v1/users?limit=200')['data'] if 'ACCOUNT_HOLDER' in (u['attributes'].get('roles') or [])]
if len(owners) != 1:
    sys.exit(f'::error::Expected one account holder, found {len(owners)}; add the tester by hand.')
u = owners[0]['attributes']
email = u['username']

have = call('GET', f"/v1/betaGroups/{group['id']}/betaTesters?limit=200")['data']
if any((t['attributes'].get('email') or '').lower() == email.lower() for t in have):
    print(f'The account holder is already in {GROUP}.'); sys.exit()

try:
    request('POST', '/v1/betaTesters', {'data': {'type': 'betaTesters',
            'attributes': {'email': email, 'firstName': u.get('firstName') or '', 'lastName': u.get('lastName') or ''},
            'relationships': {'betaGroups': {'data': [{'type': 'betaGroups', 'id': group['id']}]}}}})
    print(f'Added the account holder to {GROUP}. TestFlight shows them the group\'s builds within a few minutes.')
except ApiError as e:
    if e.code != 409:
        sys.exit(f'::error::Could not add the tester ({e.code}).')
    # already a tester of this app (in no group, or a deleted one): put that tester in the group
    found = call('GET', f'/v1/betaTesters?filter[email]={urllib.parse.quote(email)}&filter[apps]={app_id}')['data']
    if not found:
        sys.exit('::error::Apple says the tester exists but it could not be found; add them by hand.')
    call('POST', f"/v1/betaGroups/{group['id']}/relationships/betaTesters", {'data': [{'type': 'betaTesters', 'id': found[0]['id']}]})
    print(f'Added the account holder to {GROUP}.')
