#!/bin/bash
# Uninstall the auto-tutor-docling launchd agent

set -e

LAUNCHD_DIR="$HOME/Library/LaunchAgents"
PLIST_DEST="$LAUNCHD_DIR/com.user.auto-tutor.docling.plist"

if [ -f "$PLIST_DEST" ]; then
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    rm "$PLIST_DEST"
    echo "Agent uninstalled from $PLIST_DEST"
else
    echo "Agent not found at $PLIST_DEST"
fi