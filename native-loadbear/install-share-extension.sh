#!/bin/bash
# Copies the Load Bear Share Extension code into the target you created in Xcode.
# Run from anywhere: bash native-loadbear/install-share-extension.sh
set -e
cd "$(dirname "$0")"
# Xcode names the folder after the target: "Load Bear" or "ShareExtension".
TARGET=""
for candidate in "ios/App/Load Bear" "ios/App/ShareExtension"; do
  if [ -d "$candidate" ]; then TARGET="$candidate"; break; fi
done
if [ -z "$TARGET" ]; then
  echo "I can't find the Share Extension folder in ios/App."
  echo "Create the Share Extension target in Xcode first."
  exit 1
fi
cp ShareExtension/ShareViewController.swift "$TARGET/ShareViewController.swift"
cp ShareExtension/Info.plist "$TARGET/Info.plist"
echo "Done. The Load Bear Share Extension code is in place in: $TARGET"
