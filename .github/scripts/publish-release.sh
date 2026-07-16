#!/usr/bin/env bash
#
# Publish the built apps to the "latest" GitHub Release — resiliently.
#
# Runs in the CI "release" job. It talks to the GitHub REST API directly (via
# `gh api` + curl) rather than the `gh release upload/view/edit` subcommands,
# which on the runner fail to find an existing release even when it exists
# (`create` reports "tag_name already exists" while `upload` reports "release
# not found"). The REST endpoints work reliably, so we:
#   1. find the existing "latest" release (or create it if missing),
#   2. delete any same-named assets on it (a fresh upload otherwise 422s),
#   3. upload each new asset to the uploads endpoint with curl.
# Assets are updated in place, so a working release is never destroyed. We
# publish whatever artifacts exist and retry to ride out transient hiccups.
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
  local rid name aid http

  # 1) Find the existing "latest" release; create it if it doesn't exist yet.
  rid=$(gh api "repos/${REPO}/releases/tags/${TAG}" --jq '.id' 2>/dev/null || true)
  if [ -z "${rid}" ]; then
    echo "No '${TAG}' release yet — creating it."
    rid=$(gh api -X POST "repos/${REPO}/releases" \
      -f tag_name="${TAG}" \
      -f target_commitish="${SHA}" \
      -f name="${TITLE}" \
      -f "body=$(cat "${NOTES_FILE}")" \
      -f make_latest=true \
      --jq '.id') || return 1
  else
    echo "Updating existing release id=${rid}."
    # Refresh the notes/title on the existing release (best-effort).
    gh api -X PATCH "repos/${REPO}/releases/${rid}" \
      -f name="${TITLE}" -f "body=$(cat "${NOTES_FILE}")" -f make_latest=true \
      >/dev/null 2>&1 || true
  fi
  [ -n "${rid}" ] || return 1

  # 2+3) For each asset: remove any same-named asset, then upload the new one.
  for f in dist-assets/*; do
    name=$(basename "${f}")
    aid=$(gh api "repos/${REPO}/releases/${rid}/assets" \
      --jq ".[] | select(.name==\"${name}\") | .id" 2>/dev/null | head -n1 || true)
    if [ -n "${aid}" ]; then
      gh api -X DELETE "repos/${REPO}/releases/${rid}/assets/${aid}" >/dev/null 2>&1 || true
    fi
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
