#!/bin/bash

# Stop the script on errors
set -e

# Get environment variables
SUFFIX=$SUFFIX
RELEASE_TYPE=$RELEASE_TYPE

if [ -z "$SUFFIX" ]; then
  echo "Error: SUFFIX is not set."
  exit 1
fi

if [ -z "$RELEASE_TYPE" ]; then
  echo "Error: RELEASE_TYPE is not set."
  exit 1
fi

# Update package versions (e.g., 0.0.1-beta.0)
echo "Publishing packages with tag: $SUFFIX"
./node_modules/.bin/lerna  version "$RELEASE_TYPE" --preid "$SUFFIX" --yes --no-push --no-git-tag-version --force-publish=\*

# Get the version number from lerna.json
version_num=$(jq -r '.version' lerna.json)
echo "New Version: $version_num"

# Add changes to Git
if [[ -n $(git status --porcelain) ]]; then
  echo "Committing version changes"
  git config user.name "github-actions"
  git config user.email "github-actions@github.com"
  git add $(find . -name 'package.json' -not -path '*/node_modules/*') yarn.lock lerna.json

  if git diff-index --quiet HEAD --; then
    echo "No changes to commit."
  else
    git commit -m "Prerelease: v$version_num"
    # Push to the Git branch
    echo "Pushing version changes to development branch"
    git push origin HEAD
  fi
else
  echo "No changes to commit."
fi

# Publish packages with the SUFFIX as a tag
echo "Publishing packages with tag: $SUFFIX"
./node_modules/.bin/lerna publish from-package --no-private --dist-tag "$SUFFIX" --loglevel verbose --yes --no-git-tag-version --force-publish
if [ $? -ne 0 ]; then
    echo "Lerna publish failed!"
    exit 1
fi