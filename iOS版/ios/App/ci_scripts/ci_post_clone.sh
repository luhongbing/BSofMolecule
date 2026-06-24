#!/bin/sh
set -e

echo "=== ci_post_clone.sh: Building web resources ==="

SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
APP_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
IOS_DIR="$( cd "$APP_DIR/.." && pwd )"
WEB_DIR="$( cd "$IOS_DIR/.." && pwd )"

echo "SCRIPT_DIR: $SCRIPT_DIR"
echo "APP_DIR: $APP_DIR"
echo "IOS_DIR: $IOS_DIR"
echo "WEB_DIR: $WEB_DIR"

if [ ! -f "$WEB_DIR/package.json" ]; then
    echo "ERROR: package.json not found at $WEB_DIR"
    exit 1
fi

cd "$WEB_DIR"

echo "Node version: $(node --version 2>/dev/null || echo 'not found')"
echo "npm version: $(npm --version 2>/dev/null || echo 'not found')"

echo "Installing npm dependencies..."
npm ci || npm install

echo "Building web app..."
npm run build

echo "Copying to public..."
mkdir -p "$APP_DIR/App/public"
cp -r dist/* "$APP_DIR/App/public/"

echo "=== ci_post_clone.sh: Done ==="
