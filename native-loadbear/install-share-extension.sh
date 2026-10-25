#!/bin/bash
# Copies the Load Bear Share Extension code into the target you created in Xcode.
# Run from anywhere: bash native-loadbear/install-share-extension.sh
set -e
cd "$(dirname "$0")"
TARGET="ios/App/ShareExtension"
if [ ! -d "$TARGET" ]; then
  echo "I can't find $TARGET."
  echo "Create the Share Extension target in Xcode first, and name it exactly: ShareExtension"
  exit 1
fi
cp ShareExtension/ShareViewController.swift "$TARGET/ShareViewController.swift"
cp ShareExtension/Info.plist "$TARGET/Info.plist"
echo "Done. The Load Bear Share Extension code is in place."
