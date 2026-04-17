#!/usr/bin/env python3
"""Long-running watchdog observer for auto-tutor-docling."""

import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

LOG_DIR = Path.home() / 'Library' / 'Logs'
LOG_FILE = LOG_DIR / 'auto-tutor-docling.log'
MAX_LOG_SIZE = 10 * 1024 * 1024  # 10 MB


def log_rotate() -> None:
    """Rotate log if over size limit."""
    if LOG_FILE.exists() and LOG_FILE.stat().st_size > MAX_LOG_SIZE:
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        rotated = LOG_FILE.with_name(f'auto-tutor-docling-{timestamp}.log')
        LOG_FILE.rename(rotated)


def setup_logging() -> logging.Logger:
    """Configure logging to file and console."""
    log_rotate()
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    
    logger = logging.getLogger('auto-tutor-docling')
    logger.setLevel(logging.DEBUG)
    
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setLevel(logging.DEBUG)
    
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger


class DocumentHandler(FileSystemEventHandler):
    def __init__(self, source_dir: Path, target_dir: Path, extract_script: Path, logger: logging.Logger):
        self.source_dir = source_dir
        self.target_dir = target_dir
        self.extract_script = extract_script
        self.logger = logger
        self._processing = set()
    
    def _process_file(self, file_path: Path) -> None:
        """Process a single file using extract.py."""
        if file_path.suffix.lower() not in ['.pdf', '.docx', '.png', '.jpg', '.jpeg']:
            return
        
        if file_path in self._processing:
            return
        
        self._processing.add(file_path)
        try:
            import subprocess
            result = subprocess.run(
                [sys.executable, str(self.extract_script), 'extract', str(file_path)],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                self.logger.info(f"Processed: {file_path.name}")
            else:
                self.logger.error(f"Failed: {file_path.name} - {result.stderr}")
        except Exception as e:
            self.logger.error(f"Error processing {file_path.name}: {e}")
        finally:
            self._processing.discard(file_path)
    
    def on_created(self, event) -> None:
        if event.is_directory:
            return
        path = Path(event.src_path)
        self.logger.debug(f"File created: {path}")
        time.sleep(0.5)  # Allow file to be fully written
        self._process_file(path)
    
    def on_modified(self, event) -> None:
        if event.is_directory:
            return
        path = Path(event.src_path)
        self.logger.debug(f"File modified: {path}")
        time.sleep(0.5)
        self._process_file(path)
    
    def on_deleted(self, event) -> None:
        if event.is_directory:
            return
        path = Path(event.src_path)
        stem = path.stem.replace(' ', '-').replace('_', '-')
        stem = ''.join(c if c.isalnum() or c in '-_' else '_' for c in stem)
        md_file = self.target_dir / f"{stem}.md"
        if md_file.exists():
            md_file.unlink()
            self.logger.info(f"Deleted paired markdown: {md_file.name}")


def main() -> int:
    import argparse
    
    parser = argparse.ArgumentParser(description='Watch source directory for new documents')
    parser.add_argument('--source', required=True, help='Directory to watch (1-Raw_Sources)')
    parser.add_argument('--target', required=True, help='Directory to output markdown (2-Markdown_Sources)')
    args = parser.parse_args()
    
    source_dir = Path(args.source).expanduser().resolve()
    target_dir = Path(args.target).expanduser().resolve()
    script_dir = Path(__file__).parent
    
    if not source_dir.exists():
        print(f"Error: source directory {source_dir} does not exist", file=sys.stderr)
        return 1
    
    logger = setup_logging()
    logger.info(f"Starting watchdog on {source_dir} -> {target_dir}")
    
    event_handler = DocumentHandler(source_dir, target_dir, script_dir / 'extract.py', logger)
    observer = Observer()
    observer.schedule(event_handler, str(source_dir), recursive=True)
    
    try:
        observer.start()
        logger.info("Watchdog started, press Ctrl+C to stop")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Stopping watchdog...")
        observer.stop()
    observer.join()
    
    return 0


if __name__ == '__main__':
    sys.exit(main())