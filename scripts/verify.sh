#!/bin/bash
# Runs the standard repo verification checks
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$REPO_ROOT/plugin"

echo "=== Lint ==="
cd "$PLUGIN_DIR"
npm run lint

echo "=== Typecheck ==="
npm run typecheck

echo "=== Unit tests ==="
npm test

echo "=== All checks passed ==="
exit 0