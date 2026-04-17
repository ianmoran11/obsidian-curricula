#!/usr/bin/env python3
"""Single-file document extraction using docling."""

import hashlib
import json
import os
import sys
from pathlib import Path

import docling
from docling.datamodel.base_models import InputDocument
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.pipeline.standard_pdf_pipeline import StandardPdfPipeline


def compute_content_hash(file_path: Path) -> str:
    with open(file_path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def get_cache_path(source_path: Path, cache_dir: Path) -> Path:
    content_hash = compute_content_hash(source_path)
    return cache_dir / f"{content_hash[:16]}.json"


def load_cache(cache_path: Path) -> dict | None:
    if cache_path.exists():
        with open(cache_path) as f:
            return json.load(f)
    return None


def save_cache(cache_path: Path, data: dict) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, 'w') as f:
        json.dump(data, f)


def extract_markdown(source_path: Path, target_dir: Path) -> Path | None:
    """Extract markdown from a document using docling."""
    pipeline_options = PdfPipelineOptions()
    pipeline = StandardPdfPipeline(pipeline_options=pipeline_options)
    
    input_doc = InputDocument.from_path(str(source_path))
    pipeline_dict = pipeline.process(input_doc)
    
    md = pipeline_dict.document.export_to_markdown()
    
    stem = source_path.stem
    stem = stem.replace(' ', '-').replace('_', '-')
    stem = ''.join(c if c.isalnum() or c in '-_' else '_' for c in stem)
    target_file = target_dir / f"{stem}.md"
    
    frontmatter = f'---\nsource: {source_path.relative_to(source_path.parent.parent.parent)}\nextracted_at: {__import__("datetime").datetime.utcnow().isoformat()}Z\n---\n\n'
    
    with open(target_file, 'w') as f:
        f.write(frontmatter + md)
    
    return target_file


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] != 'extract':
        print("Usage: extract.py extract <path>", file=sys.stderr)
        return 1
    
    source = Path(sys.argv[2]).expanduser().resolve()
    if not source.exists():
        print(f"Error: {source} does not exist", file=sys.stderr)
        return 1
    
    cache_dir = source.parent.parent / '.docling-cache'
    cache_path = get_cache_path(source, cache_dir)
    
    cached = load_cache(cache_path)
    if cached and cached['status'] == 'success':
        content_hash = compute_content_hash(source)
        if cached.get('content_hash') == content_hash:
            print(f"No changes detected for {source.name}, skipping.")
            return 0
    
    target_dir = source.parent.parent / '2-Markdown_Sources'
    target_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        result = extract_markdown(source, target_dir)
        if result:
            content_hash = compute_content_hash(source)
            save_cache(cache_path, {'status': 'success', 'content_hash': content_hash, 'output': str(result)})
            print(f"Extracted: {result}")
            return 0
        else:
            save_cache(cache_path, {'status': 'failed'})
            return 1
    except Exception as e:
        save_cache(cache_path, {'status': 'error', 'error': str(e)})
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())