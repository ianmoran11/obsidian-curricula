#!/bin/bash
# Install the auto-tutor-docling launchd agent

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

SOURCE_DIR="${1:-$REPO_ROOT/mock-vault/1-Raw_Sources}"
TARGET_DIR="${2:-$REPO_ROOT/mock-vault/2-Markdown_Sources}"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory $SOURCE_DIR does not exist"
    exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory $TARGET_DIR does not exist"
    exit 1
fi

PLIST_FILE="$SCRIPT_DIR/com.user.auto-tutor.docling.plist"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
PLIST_DEST="$LAUNCHD_DIR/com.user.auto-tutor.docling.plist"

mkdir -p "$LAUNCHD_DIR"

SCRIPT_ABS="$(cd "$SCRIPT_DIR" && pwd)/watch.py"

sed "s|--SCRIPT_DIR--|$SCRIPT_ABS|g; s|--SOURCE_DIR--|$SOURCE_DIR|g; s|--TARGET_DIR--|$TARGET_DIR|g" \
    "$PLIST_FILE" > "$PLIST_DEST"

echo "Installed launchd agent to $PLIST_DEST"
launchctl load "$PLIST_DEST"
echo "Agent loaded and running"