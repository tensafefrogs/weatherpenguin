#!/usr/bin/env bash
# Archives the app and uploads it to App Store Connect (it shows up in TestFlight after processing).
# Adapted from tensafefrogs/king-walk (ios/scripts/upload.sh).
#
# Signing is automatic: Xcode uses the App Store Connect API key to create the profiles and a
# cloud-managed distribution certificate, so no certificate is stored anywhere.
# Needs: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (the .p8 file's contents), APPLE_TEAM_ID, BUNDLE_ID, BUILD_NUMBER.
# Optional: MARKETING_VERSION (default: project.yml's), ARCHIVE_SIGNING=automatic (see below).
# Run from the repo root after `xcodegen generate` in app/ios.
set -euo pipefail
for v in ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_P8 APPLE_TEAM_ID BUNDLE_ID BUILD_NUMBER; do
  [ -n "${!v:-}" ] || { echo "Missing $v. See README.md, Releasing."; exit 1; }
done
# Pasted secrets often carry a trailing newline or spaces; IDs must be exact
ASC_KEY_ID=$(printf '%s' "$ASC_KEY_ID" | tr -d '[:space:]')
ASC_ISSUER_ID=$(printf '%s' "$ASC_ISSUER_ID" | tr -d '[:space:]')
APPLE_TEAM_ID=$(printf '%s' "$APPLE_TEAM_ID" | tr -d '[:space:]')
BUNDLE_ID=$(printf '%s' "$BUNDLE_ID" | tr -d '[:space:]')
tmp=${RUNNER_TEMP:-$(mktemp -d)}
key="$tmp/AuthKey_$ASC_KEY_ID.p8"
umask 077   # the key file readable by this user only
# the key is removed however the script ends, a failed archive or export included
trap 'rm -f "$key" ~/.appstoreconnect/private_keys/"AuthKey_$ASC_KEY_ID.p8"' EXIT
# The .p8 in its standard layout: a pasted key can lose its line breaks, which Xcode's sign-in rejects.
printf '%s' "$ASC_KEY_P8" | python3 -c '
import re, sys
t = sys.stdin.read()
body = re.sub(r"-----(BEGIN|END) PRIVATE KEY-----", "", t)
body = re.sub(r"[^A-Za-z0-9+/=]", "", body)
print("-----BEGIN PRIVATE KEY-----")
for i in range(0, len(body), 64): print(body[i:i + 64])
print("-----END PRIVATE KEY-----")' > "$key"
auth=(-allowProvisioningUpdates -authenticationKeyPath "$key" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")

project=app/ios/WeatherPenguin.xcodeproj
archive="$tmp/WeatherPenguin.xcarchive"

# As in king-walk: the archive is built unsigned, then its sticker pack and app are signed "to run locally"
# (ad hoc) with their entitlements, and the export step signs it for the App Store with a cloud-managed
# certificate, keeping those entitlements (checked after the export). ARCHIVE_SIGNING=automatic signs
# the archive with automatic signing instead.
if [ "${ARCHIVE_SIGNING:-adhoc}" = automatic ]; then
  signing=(CODE_SIGN_STYLE=Automatic "${auth[@]}")
else
  signing=(CODE_SIGNING_ALLOWED=NO)
fi
xcodebuild -project "$project" -scheme WeatherPenguin -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  SWIFT_ACTIVE_COMPILATION_CONDITIONS="\$(inherited) ${SWIFT_FLAGS:-}" \
  ${MARKETING_VERSION:+MARKETING_VERSION="$MARKETING_VERSION"} \
  "${signing[@]}" archive

app_in_archive="$archive/Products/Applications/WeatherPenguin.app"
if [ "${ARCHIVE_SIGNING:-adhoc}" != automatic ]; then
  # app/ios/WeatherPenguin/WeatherPenguin.entitlements, with the team and bundle ID filled in
  cat > "$tmp/app.entitlements" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.developer.weatherkit</key><true/>
  <key>com.apple.developer.ubiquity-kvstore-identifier</key><string>$APPLE_TEAM_ID.$BUNDLE_ID</string>
</dict></plist>
PLIST
  # the Watch app and its complications share the iPhone app's iCloud store (app/ios/Watch*/…entitlements)
  cat > "$tmp/watch.entitlements" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.developer.weatherkit</key><true/>
  <key>com.apple.developer.ubiquity-kvstore-identifier</key><string>$APPLE_TEAM_ID.$BUNDLE_ID</string>
</dict></plist>
PLIST
  # inside out: each signature covers what's inside it
  watch="$app_in_archive/Watch/WeatherPenguinWatch.app"
  if [ -d "$watch" ]; then
    for appex in "$watch"/PlugIns/*.appex; do codesign --force --sign - --entitlements "$tmp/watch.entitlements" "$appex"; done
    codesign --force --sign - --entitlements "$tmp/watch.entitlements" "$watch"
  fi
  for appex in "$app_in_archive"/PlugIns/*.appex; do
    # the Home Screen widgets need the same as the watch (WeatherKit, the iCloud store); the sticker pack nothing
    case "$appex" in
      */WeatherPenguinWidgets.appex) codesign --force --sign - --entitlements "$tmp/watch.entitlements" "$appex" ;;
      *) codesign --force --sign - "$appex" ;;
    esac
  done
  codesign --force --sign - --entitlements "$tmp/app.entitlements" "$app_in_archive"
fi
echo "--- entitlements in the archive"
codesign -d --entitlements :- "$app_in_archive" 2>/dev/null || true

cat > "$tmp/export.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST

# On failure, show Xcode's own distribution log, which says why (the console only says "Authentication failed")
export_log() {
  for f in $(ls -dt "${TMPDIR:-/tmp}"/*.xcdistributionlogs 2>/dev/null | head -1); do
    echo "--- Xcode distribution log ($f)"
    grep -h -i -E 'error|fail|status|401|403|forbidden|unauthor|team|certificate|profile' "$f"/*.log 2>/dev/null | grep -v -i 'nserror *= *nil' | tail -80
  done
}
xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$tmp/export.plist" \
  -exportPath "$tmp/export" "${auth[@]}" || { export_log; exit 1; }

# Check the signed app has its capabilities before it goes to Apple: without them the weather and
# iCloud settings silently don't work.
ipa=$(ls "$tmp"/export/*.ipa)
rm -rf "$tmp/ipa" && mkdir "$tmp/ipa" && (cd "$tmp/ipa" && unzip -q "$ipa")
app=$(ls -d "$tmp"/ipa/Payload/*.app)
ent=$(codesign -d --entitlements :- "$app" 2>/dev/null || true)
echo "--- app entitlements"; echo "$ent"
missing=""
for e in com.apple.developer.weatherkit com.apple.developer.ubiquity-kvstore-identifier; do
  grep -q "$e" <<<"$ent" || missing="$missing $e"
done
wapp="$app/Watch/WeatherPenguinWatch.app"
if [ -d "$wapp" ]; then
  went=$(codesign -d --entitlements :- "$wapp" 2>/dev/null || true)
  wwent=$(codesign -d --entitlements :- "$wapp"/PlugIns/*.appex 2>/dev/null || true)
  for e in com.apple.developer.weatherkit com.apple.developer.ubiquity-kvstore-identifier; do
    grep -q "$e" <<<"$went" || missing="$missing watch:$e"
    grep -q "$e" <<<"$wwent" || missing="$missing complications:$e"
  done
fi
went=$(codesign -d --entitlements :- "$app/PlugIns/WeatherPenguinWidgets.appex" 2>/dev/null || true)
for e in com.apple.developer.weatherkit com.apple.developer.ubiquity-kvstore-identifier; do
  grep -q "$e" <<<"$went" || missing="$missing widgets:$e"
done
if [ -n "$missing" ]; then
  echo "::error::The signed app is missing:$missing. Turn on WeatherKit and iCloud for each App ID (README.md, Releasing)."
  exit 1
fi

# Now the same export with upload as its destination (the way Xcode itself sends builds)
sed -i '' 's#<string>export</string>#<string>upload</string>#' "$tmp/export.plist"
# If Xcode's upload fails (its own sign-in to App Store Connect has failed with "Account credentials have
# expired" and with HTTP 500 while the key itself worked), send the same signed .ipa with altool and the same key.
if ! xcodebuild -exportArchive -archivePath "$archive" -exportOptionsPlist "$tmp/export.plist" \
  -exportPath "$tmp/upload" "${auth[@]}"; then
  echo "::warning::Xcode's upload failed; trying altool with the same signed app"
  mkdir -p ~/.appstoreconnect/private_keys && cp "$key" ~/.appstoreconnect/private_keys/
  ok=""
  for attempt in 1 2 3; do
    if xcrun altool --upload-app -f "$ipa" -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"; then ok=1; break; fi
    echo "altool attempt $attempt failed"; sleep 30
  done
  rm -f ~/.appstoreconnect/private_keys/"$(basename "$key")"
  [ -n "$ok" ] || { rm -f "$key"; exit 1; }
fi
rm -f "$key"
echo "Uploaded build $BUILD_NUMBER. It appears in App Store Connect → TestFlight after processing (usually 5 to 15 minutes)."
