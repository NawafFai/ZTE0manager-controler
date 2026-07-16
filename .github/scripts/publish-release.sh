#!/usr/bin/env bash
#
# Publish the built apps to the "latest" GitHub Release — resiliently.
#
# Runs in the CI "release" job. Uses the pre-installed `gh` CLI with the
# workflow's GITHUB_TOKEN, so there is no floating third-party release action to
# break (the previous ncipollo@v1 step started failing in ~7 s at the API call).
# Publishes whatever artifacts exist (so a one-platform failure still ships the
# other) and retries to ride out transient GitHub API hiccups.
set -uo pipefail

TAG="latest"
TITLE="ZTE Router Manager — Downloads"

# actions/download-artifact@v4 nests each artifact under release-files/<name>/…
# Flatten the app files we actually publish into one directory.
mkdir -p dist-assets
find release-files -type f \( -name '*.apk' -o -name '*.zip' -o -name '*.exe' \) \
  -exec cp -f {} dist-assets/ \; 2>/dev/null || true

echo "Assets to publish:"
ls -la dist-assets || true
if [ -z "$(ls -A dist-assets 2>/dev/null)" ]; then
  echo "No build artifacts were produced — nothing to publish (treating as non-fatal)."
  exit 0
fi

NOTES_FILE="$(mktemp)"
cat > "$NOTES_FILE" <<'EOF'
## 📥 Downloads
- **Android:** `ZTE-Router-Manager.apk` — install on your phone (enable *Install unknown apps*).
- **Windows:** `ZTE-Router-Manager-Windows.zip` — unzip and run `ZTE Router Manager.exe` (no install).

Connect your device to the router's Wi‑Fi, open the app, enter your router password, and log in.
Rebuilt automatically from the latest source.
EOF

publish() {
  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release edit "$TAG" --title "$TITLE" --notes-file "$NOTES_FILE" --latest || return 1
  else
    gh release create "$TAG" --title "$TITLE" --notes-file "$NOTES_FILE" --latest || return 1
  fi
  # --clobber overwrites same-named assets so downloads always get the new build.
  gh release upload "$TAG" dist-assets/* --clobber || return 1
}

for attempt in 1 2 3 4; do
  if publish; then
    echo "✅ Release published (attempt ${attempt})."
    exit 0
  fi
  echo "Publish attempt ${attempt} failed; retrying in 15 s…"
  sleep 15
done

echo "❌ All publish attempts failed."
exit 1
