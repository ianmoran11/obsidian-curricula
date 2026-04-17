#!/bin/bash
# Ensures mock-vault directory structure exists
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
VAULT_DIR="$REPO_ROOT/mock-vault"

mkdir -p "$VAULT_DIR/.obsidian"
mkdir -p "$VAULT_DIR/1-Raw_Sources"
mkdir -p "$VAULT_DIR/2-Markdown_Sources"
mkdir -p "$VAULT_DIR/3-Synthesized"
mkdir -p "$VAULT_DIR/4-Curriculum"

echo "mock-vault structure ensured"