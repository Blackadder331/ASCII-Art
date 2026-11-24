"""Import the curated ASCII Bin snapshot without rasterizing artwork.

Usage: python3 scripts/import-archive.py /path/to/asciiart_db.txt
The upstream file is https://github.com/amwhoi/ascii-bin/blob/main/asciiart_db.txt.
Only outer whitespace is normalized; drawing characters and signatures remain.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import textwrap

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).read_text()
expected_hash = '4833eae18797b5822a31c846982b958842804a57d1ed6c73306bedfc058a3dc5'
if hashlib.sha256(source.encode()).hexdigest() != expected_hash:
    raise SystemExit('This source differs from the curated snapshot. Review entry numbers before importing.')
blocks = re.split(r'^===EOF===\s*$', source, flags=re.M)
index = json.loads((ROOT / 'scripts/archive-index.json').read_text())
artworks = []
for number, name, group, tags in index:
    block = blocks[number - 1]
    original = re.split(r'^tags:', block, flags=re.M)[0].strip('\n')
    assert original.isascii() and '===EOF===' not in original, name
    artwork = textwrap.dedent('\n'.join(line.rstrip() for line in original.expandtabs(8).splitlines())).strip('\n')
    line = source[:source.index(block)].count('\n') + 1
    artworks.append({
        'id': f'ascii-bin-{number}', 'name': name, 'group': group, 'tags': tags,
        'text': artwork, 'source': 'ASCII Bin',
        'sourceURL': f'https://github.com/amwhoi/ascii-bin/blob/main/asciiart_db.txt#L{line}',
    })
(ROOT / 'dist/assets/library.json').write_text(json.dumps(artworks, indent=2) + '\n')
print(f'Imported {len(artworks)} original text drawings. Source SHA-256: {hashlib.sha256(source.encode()).hexdigest()}')
