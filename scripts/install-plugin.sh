#!/bin/bash
# Idempotent symlink of plugin build output into mock-vault
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$REPO_ROOT/plugin"
VAULT_DIR="$REPO_ROOT/mock-vault"
PLUGIN_TARGET_DIR="$VAULT_DIR/.obsidian/plugins/obsidian-auto-tutor"

mkdir -p "$(dirname "$PLUGIN_TARGET_DIR")"
ln -sfn "$PLUGIN_DIR/dist" "$PLUGIN_TARGET_DIR"

echo "Plugin symlinked to $PLUGIN_TARGET_DIR"