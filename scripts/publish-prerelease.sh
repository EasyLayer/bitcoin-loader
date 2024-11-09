#!/bin/bash

# Stop the script on errors
set -e

# Get environment variables
baseVersion=$BASE_VERSION
suffix=$SUFFIX
increment=$INCREMENT

# Check if increment is empty or not set
if [ -z "$increment" ]; then
  publishVersion="$baseVersion-$suffix"
else
  publishVersion="$baseVersion-$suffix.$increment"
fi

tagName="v$publishVersion"

# Update package versions (e.g., 0.0.1-beta.0)
echo "Setting package versions to: $publishVersion"
./node_modules/.bin/lerna version $publishVersion --exact --yes --no-git-tag-version --no-push --force-publish=\*

# Add changes to Git
echo "Committing version changes"
git config user.name "github-actions"
git config user.email "github-actions@github.com"
git add **/package.json yarn.lock lerna.json
git status
git commit -m "Prerelease: $tagName"

# Publish packages with the suffix as a tag
echo "Publishing packages with tag: $suffix"
./node_modules/.bin/lerna publish from-package --no-private --dist-tag $suffix --loglevel verbose --yes --no-git-tag-version --force-publish

# Push to the Git branch
echo "Pushing to head branch"
git push origin HEAD

# Create and push a Git tag
git tag $tagName
echo "Pushing tag $tagName"
git push origin $tagName
