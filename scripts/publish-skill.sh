#!/usr/bin/env bash
# Publish packages/skill/ contents to github.com/dubeyAditya/preflight.
# Triggered by GitHub Actions publish-skill job on semver release tags.
#
# Required env vars:
#   SKILL_GITHUB_TOKEN  — personal access token with repo write scope for dubeyAditya/preflight
# Optional env vars:
#   CI_COMMIT_TAG — set automatically by GitHub Actions on tag pipelines

set -euo pipefail

export GIT_TERMINAL_PROMPT=0

GITHUB_REPO="https://x-access-token:${SKILL_GITHUB_TOKEN}@github.com/dubeyAditya/preflight.git"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/packages/skill"
TAG="${CI_COMMIT_TAG:-$(git describe --tags --abbrev=0 2>/dev/null || echo "dev")}"
WORK_DIR=$(mktemp -d)

echo "Publishing skill at tag ${TAG} to github.com/dubeyAditya/preflight"

# Clone or init the target GitHub repo
if git clone --depth=1 "$GITHUB_REPO" "$WORK_DIR" 2>/dev/null; then
  echo "Cloned existing repo"
else
  echo "Initialising new repo"
  git init "$WORK_DIR"
  cd "$WORK_DIR"
  git remote add origin "$GITHUB_REPO"
  cd - > /dev/null
fi

# Remove old lowercase skill.md if present — git on Linux is case-sensitive
# and the canonical filename is SKILL.md (skills CLI convention).
rm -f "$WORK_DIR/skill.md"

# Copy skill package contents (overwrite everything)
cp -r "$SKILL_DIR"/. "$WORK_DIR/"

cd "$WORK_DIR"

git config user.name "CI Publisher"
git config user.email "ci@noreply.github.com"

git add -A

if git diff --cached --quiet; then
  echo "No changes to publish — skill is already up to date"
else
  git commit -m "publish: ${TAG}"
  echo "Committed skill update for ${TAG}"
fi

# Ensure remote URL always carries the token (survives clone re-use)
git remote set-url origin "$GITHUB_REPO"

# Push HEAD to main and the release tag
git push origin HEAD:main --force-with-lease || git push origin HEAD:main

if [[ "$TAG" != "dev" ]]; then
  git tag -f "$TAG"
  git push origin "$TAG" --force || git push origin "$TAG"
  echo "Pushed tag ${TAG}"
fi

echo "Done — skill published at github.com/dubeyAditya/preflight"
