#!/bin/bash

# Stop the script on errors
set -e

# Get the version from lerna.json
version=$(jq -r '.version' lerna.json)
tagName="v$version"

# Publish packages with default "latest" tag
echo "Publishing packages with tag: latest"
./node_modules/.bin/lerna publish from-package --no-private --yes --no-git-tag-version --force-publish

# Create and push a Git tag
echo "Pushing tag $tagName to master branch"
git config user.name "github-actions"
git config user.email "github-actions@github.com"
git tag $tagName
git push origin $tagName

# Output the tag name for later use in the workflow
echo "::set-output name=tag::$tagName"
