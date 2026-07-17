#!/usr/bin/env bash
#
# Publish the built apps to the "latest" GitHub Release — resiliently.
#
# Runs in the CI "release" job. It talks to the GitHub REST API directly (via
# `gh api` + curl) rather than the `gh release upload/view` subcommands, which
# on the runner fail to find an existing release even when it exists.
#
# Strategy: delete the existing "latest" release *entirely* (by id — which the
# REST lookup reliably returns) plus its tag, then create a fresh, empty release
# at the pushed commit and upload each asset. Recreating from empty avoids the
# HTTP 422 "asset already_exists" you get when re-uploading over an existing
# same-named asset. Retries absorb transient API hiccups.
set -uo pipefail

TAG="latest"
TITLE="ZTE Router Manager — Downloads"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
SHA="${GITHUB_SHA:?GITHUB_SHA is required}"

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
  local rid name http

  # 1) Delete the existing "latest" release (removes all its assets) + its tag.
  rid=$(gh api "repos/${REPO}/releases/tags/${TAG}" --jq '.id' 2>/dev/null || true)
  if [ -n "${rid}" ]; then
    echo "Deleting existing release id=${rid} (and its assets)…"
    gh api -X DELETE "repos/${REPO}/releases/${rid}" >/dev/null 2>&1 || true
  fi
  gh api -X DELETE "repos/${REPO}/git/refs/tags/${TAG}" >/dev/null 2>&1 || true
  sleep 3

  # 2) Create a fresh, empty release at the pushed commit.
  echo "Creating fresh '${TAG}' release…"
  rid=$(gh api -X POST "repos/${REPO}/releases" \
    -f tag_name="${TAG}" \
    -f target_commitish="${SHA}" \
    -f name="${TITLE}" \
    -f "body=$(cat "${NOTES_FILE}")" \
    -f make_latest=true \
    --jq '.id') || { echo "Create failed."; return 1; }
  [ -n "${rid}" ] || { echo "No release id returned."; return 1; }
  echo "Created release id=${rid}"

  # 3) Upload each asset (fresh release → no same-name conflicts).
  for f in dist-assets/*; do
    name=$(basename "${f}")
    echo "Uploading ${name} …"
    http=$(curl -sS -w '%{http_code}' -o /dev/null -X POST \
      -H "Authorization: Bearer ${GH_TOKEN}" \
      -H "Content-Type: application/octet-stream" \
      --data-binary @"${f}" \
      "https://uploads.github.com/repos/${REPO}/releases/${rid}/assets?name=${name}")
    if [ "${http}" != "201" ]; then
      echo "Upload of ${name} failed (HTTP ${http})"
      return 1
    fi
    echo "Uploaded ${name} ✓"
  done
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
