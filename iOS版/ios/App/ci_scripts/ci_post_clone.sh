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

install_node() {
    echo "Installing Node.js..."
    NODE_VERSION="20.18.0"
    SYS_ARCH="$(uname -m)"
    if [ "$SYS_ARCH" = "arm64" ]; then
        NODE_ARCH="darwin-arm64"
    else
        NODE_ARCH="darwin-x64"
    fi
    NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_ARCH}.tar.gz"
    NODE_INSTALL_DIR="/tmp/node-v${NODE_VERSION}-${NODE_ARCH}"
    
    if [ ! -d "$NODE_INSTALL_DIR" ]; then
        echo "Downloading Node.js v${NODE_VERSION} for ${NODE_ARCH}..."
        curl -sL "$NODE_URL" -o /tmp/node.tar.gz
        echo "Extracting Node.js..."
        tar -xzf /tmp/node.tar.gz -C /tmp
        rm /tmp/node.tar.gz
    fi
    
    export PATH="$NODE_INSTALL_DIR/bin:$PATH"
    echo "Node.js installed at $NODE_INSTALL_DIR"
}

if ! command -v node >/dev/null 2>&1; then
    install_node
fi

if ! command -v npm >/dev/null 2>&1; then
    install_node
fi

echo "Node version: $(node --version 2>/dev/null || echo 'not found')"
echo "npm version: $(npm --version 2>/dev/null || echo 'not found')"

cd "$WEB_DIR"

echo "Installing npm dependencies..."
npm ci || npm install

echo "Building web app..."
npm run build

echo "Copying to public..."
mkdir -p "$APP_DIR/App/public"
cp -r dist/* "$APP_DIR/App/public/"

echo "=== ci_post_clone.sh: Done ==="
