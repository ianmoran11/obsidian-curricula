# Auto-Tutor Docling Service

Mac-side document parser that watches for new files and extracts Markdown content.

## Installation

```bash
./install.sh [source_dir] [target_dir]
```

The source directory should be your vault's `1-Raw_Sources/` folder, and target should be `2-Markdown_Sources/`.

## What it does

- Watches the source directory for new PDF, DOCX, PNG, JPG files
- Runs docling to extract Markdown content
- Writes extracted content to target directory with frontmatter
- Handles file changes, renames, and deletions
- Logs to `~/Library/Logs/auto-tutor-docling.log`

## Uninstallation

```bash
./uninstall.sh
```

## Manual usage

```bash
# Extract a single file
python3 extract.py extract /path/to/file.pdf

# Start the watcher
python3 watch.py --source /path/to/1-Raw_Sources --target /path/to/2-Markdown_Sources
```

## Requirements

- Python 3.11+
- docling package (`pip install docling`)
- watchdog package (`pip install watchdog`)