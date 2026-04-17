# Obsidian Curricula Evidence Harness

E2E evidence harness for Obsidian Curricula plugin. Records video, screenshots, and evidence artifacts using Playwright-Electron.

## Setup

1. **Install Obsidian desktop** from https://obsidian.md
2. **Build the plugin:**
   ```bash
   cd plugin && npm run build
   ```
3. **Install the plugin into mock vaults:**
   ```bash
   cd ../scripts && ./install-plugin.sh
   ```
4. **Set Obsidian path** (if not default):
   ```bash
   export OBSIDIAN_PATH=/Applications/Obsidian.app/Contents/MacOS/Obsidian
   ```

## Usage

```bash
cd evidence/harness

# List available viewports
npm run evidence -- --list

# Record milestone evidence
npm run evidence -- --milestone 1 --mode grounded --viewport inner
npm run evidence -- --milestone 1 --mode knowledge-only --viewport inner

# Supported modes: grounded | augmented | knowledge-only
# Supported viewports: inner | cover
```

## Viewports

| Name | Resolution | DPR | Description |
|------|-----------|-----|-------------|
| INNER | 2176×1812 | 2.63 | Galaxy Z Fold inner screen (tablet-like) |
| COVER | 2316×904 | 2.63 | Galaxy Z Fold cover screen (narrow phone) |

## Architecture

- `viewports.js` — exports `INNER` and `COVER` viewport configs for Playwright
- `record.js` — Playwright-Electron driver; launches Obsidian, navigates, captures evidence

### Launch assumptions

1. Obsidian is installed at `/Applications/Obsidian.app/Contents/MacOS/Obsidian` or `OBSIDIAN_PATH`
2. Plugin is built (`plugin/dist/main.js`, `manifest.json`, `styles.css` exist)
3. Plugin is installed into the target vault via `scripts/install-plugin.sh`
4. Vaults are at repo root:
   - `mock-vault/` — populated with source files (grounded/augmented mode)
   - `mock-vault-empty/` — empty sources (knowledge-only mode)

### Evidence output structure

```
evidence/milestone-<n>/
├── index.html                  # human-browsable report
├── evidence.json              # machine manifest
├── summary.md                 # plain-English summary
├── environment.txt            # uname, node version, date
├── inner-screen/
│   ├── grounded/
│   │   ├── vault-overview.png
│   │   ├── session.mp4
│   │   └── ...
│   └── knowledge-only/
│       └── ...
├── cover-screen/
│   ├── grounded/
│   └── knowledge-only/
├── artifacts/                 # non-UI evidence
│   └── F*_*.md
└── logs/
    └── harness.log
```

## Mode vault mapping

| Mode | Vault Path | Description |
|------|------------|-------------|
| grounded | `mock-vault/` | Source files in `/2-Markdown_Sources/` |
| augmented | `mock-vault/` | Same as grounded (uses same vault) |
| knowledge-only | `mock-vault-empty/` | No source files |

## Record workflow

1. Launch Obsidian with `--user-data-dir` for isolation
2. Open target vault
3. Wait for Obsidian UI ready (title != 'Obsidian')
4. Set mobile viewport (INNER or COVER)
5. Enable Playwright video recording
6. Perform interaction steps
7. Capture screenshots and close
8. Generate `evidence.json` manifest
9. Generate `index.html` report

## API

### `recordMilestone(milestone, mode, viewport)`

Records evidence for a given milestone, mode, and viewport.

- `milestone` (string): Milestone number (e.g., "1", "2")
- `mode` (string): "grounded" | "augmented" | "knowledge-only"
- `viewport` (string): "inner" | "cover"