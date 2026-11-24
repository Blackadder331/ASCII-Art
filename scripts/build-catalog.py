"""Build the text-art catalog from checksum-pinned archive snapshots.

python3 scripts/build-catalog.py --cache /tmp/ascii-deep-research
Add --download to fetch missing snapshots. Never executes source files.
"""
import argparse
from collections import Counter
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import textwrap
from urllib.parse import quote
from urllib.request import urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
JGS = 'https://priede.bf.lu.lv/atteli/ASCII/jgs/www.geocities.com/SoHo/7373/'
CANDY_SHA = '35301d438aa2c1e58e8cb3ea215b0af323bddf9b'
SOURCES = [
    dict(id='ascii-bin', name='ASCII Bin', url='https://github.com/amwhoi/ascii-bin', author='', license='Collection CC0; individual artist rights apply', licenseURL='https://github.com/amwhoi/ascii-bin#license'),
    dict(id='jgs', name='Joan Stark · GeoCities', url=JGS+'index.htm', author='Joan G. Stark (jgs)', license='Personal use · keep artist signature', licenseURL=JGS+'please.htm', originalURL='http://www.geocities.com/SoHo/7373/', archiveURL='https://web.archive.org/web/20100202112131/http://www.geocities.com/SoHo/7373/index.htm'),
    dict(id='ldb', name='Laura Brown · ldb', url='https://asciiartist.com/', author='Laura Brown (ldb)', license='CC BY-NC-SA 4.0', licenseURL='https://creativecommons.org/licenses/by-nc-sa/4.0/'),
    dict(id='ascii-cats', name='ASCII Cats', url='https://github.com/stealth-factory/ascii-cats', author='William Li collection · original signatures retained', license='MIT · original signatures retained', licenseURL='https://github.com/stealth-factory/ascii-cats#license'),
    dict(id='candy-box', name='Candy Box 2', url='https://candybox2.github.io/ascii_art.html', author='Candy Box 2 contributors', license='CC BY-SA 3.0', licenseURL='https://creativecommons.org/licenses/by-sa/3.0/'),
    dict(id='roy-sac', name='Roy/SAC', url='https://www.roysac.com/roy_asciishow.html', author='Carsten Cumbrowski (Roy/SAC)', license='Public domain · released by the artist', licenseURL='https://www.roysac.com/roy_asciishow.html'),
]
BY_SOURCE = {source['id']: source for source in SOURCES}


def decode(data):
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return data.decode('cp1252', errors='replace')


def normalize(text):
    text = text.replace('\r\n', '\n').replace('\r', '\n').replace('\xa0', ' ').expandtabs(8)
    return textwrap.dedent('\n'.join(line.rstrip() for line in text.split('\n'))).strip('\n')


def words(text):
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text).lower()
    return re.findall(r'[a-z0-9]+', text)


def tags_for(title, extra=''):
    tags = set(words(title + ' ' + extra))
    aliases = {'cats':'cat', 'kitty':'cat', 'kitties':'cat', 'kitten':'cat', 'kittens':'cat', 'wildcat':'cat', 'garfield':'cat', 'skulls':'skull', 'skeleton':'skull', 'skellie':'skull', 'roses':'rose', 'bunny':'rabbit', 'bunnies':'rabbit', 'tux':'penguin', 'puppy':'dog', 'puppies':'dog', 'dogs':'dog'}
    tags.update(aliases[t] for t in list(tags) if t in aliases)
    return ', '.join(sorted(tags))


class TextBlocks(HTMLParser):
    """Read only text in PRE blocks; skip scripts and stylesheet contents."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pre = 0
        self.ignore = 0
        self.buffer = []
        self.blocks = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.ignore += 1
        elif tag == 'pre':
            if self.pre == 0:
                self.buffer = []
            self.pre += 1
        elif tag == 'br' and self.pre:
            self.buffer.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.ignore = max(0, self.ignore - 1)
        elif tag == 'pre' and self.pre:
            self.pre -= 1
            if not self.pre:
                self.blocks.append(normalize(''.join(self.buffer)))

    def handle_data(self, data):
        if self.pre and not self.ignore:
            self.buffer.append(data)


def group_for(title, fallback='objects'):
    t = set(words(title))
    if t & set('cat cats kitten kitty dog puppy bird birds owl bat fish shark whale dragon unicorn horse cow sheep lion tiger rabbit bunny butterfly flower flowers rose roses tree trees leaf plant forest animal animals nature'.split()):
        return 'nature'
    if t & set('house home castle building lighthouse church village city mountain landscape island scenery'.split()):
        return 'places'
    if t & set('skull skeleton witch wizard fairy elf angel devil demon ghost person baby santa dragon knight monster creature'.split()):
        return 'characters'
    return fallback


def build(cache):
    records = []
    skipped = Counter()

    def add(source_id, name, text, url, *, author=None, group='objects', tags='', key=None, date='', original_url=''):
        text = normalize(text)
        lines = text.split('\n')
        # Exclude empty separators, control streams, huge layouts, and prose-only chunks.
        if len(lines) < 2 or len(lines) > 400 or max(map(len, lines), default=0) > 300 or len(text) < 10:
            skipped[source_id] += 1
            return
        if re.search(r'[\x00-\x08\x0b-\x1f\x7f\ufffd]', text):
            skipped[source_id] += 1
            return
        source = BY_SOURCE[source_id]
        origin = dict(sourceId=source_id, source=source['name'], sourceURL=url,
                      author=source['author'] if author is None else author,
                      license=source['license'], licenseURL=source['licenseURL'])
        if original_url:
            origin['originalURL'] = original_url
        identity = key or hashlib.sha256((url+'\n'+text).encode()).hexdigest()[:14]
        records.append(dict(id=f'{source_id}-{identity}', name=name, group=group_for(name, group),
                            tags=tags_for(name, tags), text=text, date=date, **origin, origins=[origin]))

    for entry in json.loads((ROOT/'scripts/catalog/ascii-bin.json').read_text()):
        add('ascii-bin', entry['name'], entry['text'], entry['sourceURL'], key=entry['id'].removeprefix('ascii-bin-'), group=entry['group'], tags=entry['tags'])

    cats = json.loads((cache/'cats.json').read_text())
    for name, lines in cats.items():
        text = '\n'.join(lines)
        # Three Japanese/wide-character drawings need a different cell renderer.
        if name in ('awake', 'got-dat-cat', 'longcat'):
            skipped['ascii-cats'] += 1
            continue
        label = {'^':'Tiny cat', 'ass':'Cat — rear view', 'sexy':'Cat — detailed portrait'}.get(name, name.replace('-', ' ').capitalize()+' cat')
        add('ascii-cats', label, text, 'https://github.com/stealth-factory/ascii-cats/blob/master/cats.json', key=name if name != '^' else 'tiny', group='nature', tags='cat kitten feline pet '+name)

    # Most JGS drawings have a title/date header. Some PREs contain several drawings.
    heading = re.compile(r'(?m)^\s*-?=+\[\s*(.*?)\s*\]=+-?([^\n]*)\n?')
    animal_pages = set('aquatic birds pets pets2 insects reptiles farm wildlife teddy zoo'.split())
    nature_pages = animal_pages | {'nature', 'flowers'}
    character_pages = {'haloween', 'halowen2', 'mythical', 'mythical2', 'mythos', 'mythos2', 'baby', 'men', 'women', 'couples', 'kids', 'people', 'religion'}
    # These include third-party song lyrics or poetry, rather than just drawings.
    exclude_titles = re.compile(r'princess diana|england.s rose|ode to|lyrics|poem|jingle bells|twelve days|night before christmas', re.I)
    for file in sorted((cache/'jgs').glob('*.htm')):
        parser = TextBlocks()
        parser.feed(decode(file.read_bytes()))
        context = ''
        date = ''
        for number, block in enumerate(parser.blocks):
            headers = list(heading.finditer(block))
            sections = []
            if headers:
                for i, header in enumerate(headers):
                    context = re.sub(r'\s+', ' ', header[1]).strip()
                    date = header[2].strip()
                    sections.append((context, date, block[header.end():headers[i+1].start() if i+1<len(headers) else len(block)]))
            else:
                sections = [(context, date, block)]
            for title, created, art in sections:
                if not title or exclude_titles.search(title) or not re.search(r'\bjgs\b', art, re.I):
                    continue
                # A visual separator alone isn't a drawing, even beside an artist label.
                if len(set(art)-set(' \n\rjgs.*~:_-=')) < 5:
                    continue
                group = 'nature' if file.stem in nature_pages else 'characters' if file.stem in character_pages else 'places' if file.stem=='build' else 'objects'
                label = title[:120].strip(' .').capitalize()
                extra = 'animal' if file.stem in animal_pages else file.stem
                add('jgs', label, art, JGS+file.name, group=group, tags=extra+' joan stark jgs', date=created,
                    original_url='http://www.geocities.com/SoHo/7373/'+file.name)

    # ldb files separate artworks with at least two empty lines, retaining captions.
    ldb_categories = {
        'animal':'Animals', 'asciigreetings':'Greetings', 'mischoliday':'Holidays', 'canadian':'Canada', 'christmas':'Christmas',
        'pagan':'Pagan symbols', 'insectbug':'Insects', 'halloween':'Halloween', 'sciencefiction':'Science fiction',
        'people':'People', 'remembrance':'Remembrance', 'fantasy':'Fantasy', 'landscape':'Landscape', 'stpatricksday':"St Patrick's Day",
        'dragon':'Dragon', 'hobbiescrafts':'Hobbies and crafts', 'valentine':"Valentine's Day", 'communications':'Communication',
        'food':'Food', 'spring':'Spring', 'technology':'Technology', 'floral':'Flowers', 'summer':'Summer',
        'transportationtravel':'Transportation', 'buildings':'Buildings', 'autumn':'Autumn', 'other':'Objects', 'winter':'Winter',
    }
    for file in sorted(cache.glob('ldb-*.txt')):
        if file.name == 'ldb-animals.txt':  # Initial research download duplicates animalascii.txt.
            continue
        slug = file.stem.removeprefix('ldb-').removesuffix('ascii')
        category = ldb_categories.get(slug, slug.capitalize())
        chunks = re.split(r'\n(?:[ \t]*\n){2,}', decode(file.read_bytes()).replace('\r\n', '\n'))
        for number, art in enumerate(chunks):
            if not re.search(r'\bldb\b', art, re.I):
                continue
            caption_lines = [line.strip() for line in art.splitlines() if re.fullmatch(r"[A-Za-z][A-Za-z ,/'-]{5,70}", line.strip())]
            label = caption_lines[-1] if caption_lines else f'{category} — study {number+1:02}'
            # Topic overrides for the mixed animal collection are reviewed separately.
            overrides_path = ROOT/'scripts/catalog/ldb-labels.json'
            overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
            override = overrides.get(f'{file.name}:{number}')
            if override:
                label = override
            group = 'nature' if slug in ('animal','insectbug','dragon','floral','spring','autumn','winter','summer') else 'places' if slug in ('landscape','buildings') else 'characters' if slug in ('fantasy','halloween','people') else 'objects'
            add('ldb', label, art, 'https://asciiartist.com/ldb/'+file.name.removeprefix('ldb-'), group=group, tags=category+' laura brown ldb')

    with zipfile.ZipFile(cache/'candybox.zip') as archive:
        for name in sorted(archive.namelist()):
            if '/ascii/' not in name or not name.endswith('.txt'):
                continue
            path = 'ascii/'+name.split('/ascii/', 1)[1]
            text = decode(archive.read(name))
            authors = re.findall(r'^@author\s+(.+)', text, re.M)
            art = re.sub(r'^@author[^\n]*(?:\n|$)', '', text, flags=re.M)
            bits = path.removeprefix('ascii/').removesuffix('.txt').split('/')
            label = ' '.join(words(' '.join(bits[-2:]))) if bits[-1] in ('logo','background','text','inside','outside') else ' '.join(words(bits[-1]))
            add('candy-box', label.capitalize(), art, f'https://github.com/candybox2/candybox2.github.io/blob/{CANDY_SHA}/{quote(path)}',
                author='; '.join(authors) if authors else 'Candy Box 2 · no author notice in source', tags=' '.join(bits)+' fantasy game', key=path.removeprefix('ascii/').removesuffix('.txt').replace('/','-'))

    with zipfile.ZipFile(cache/'roy-ascii.zip') as archive:
        for name in sorted(archive.namelist()):
            if not name.upper().endswith('.ASC'):
                continue
            raw = archive.read(name)
            # DOS EOF / optional SAUCE metadata are not part of the visible drawing.
            raw = raw.split(b'\x1a', 1)[0]
            art = raw.decode('cp437').replace('\x00','').replace('\x0c','\n')
            add('roy-sac', 'Scene artwork — '+Path(name).stem, art,
                'https://www.roysac.com/roy_asciishow.html', key=Path(name).stem.lower(),
                group='lettering', tags='scene bbs demoscene retro logo lettering '+Path(name).stem)

    # Merge exact normalized drawings, retaining every discovered origin and tag.
    unique = {}
    for record in records:
        fingerprint = hashlib.sha256(record['text'].encode()).hexdigest()
        if fingerprint in unique:
            existing = unique[fingerprint]
            existing['tags'] = ', '.join(sorted(set(existing['tags'].split(', ')) | set(record['tags'].split(', '))))
            for origin in record['origins']:
                if origin not in existing['origins']:
                    existing['origins'].append(origin)
        else:
            unique[fingerprint] = record
    catalog = list(unique.values())
    # Repeat titles need human-readable distinctions in the gallery.
    totals = Counter((x['sourceId'], x['name']) for x in catalog)
    seen = Counter()
    for item in catalog:
        pair = item['sourceId'], item['name']
        if totals[pair] > 1:
            seen[pair] += 1
            item['name'] += f' — {seen[pair]:02}'
    for source in SOURCES:
        source['count'] = sum(any(o['sourceId']==source['id'] for o in item['origins']) for item in catalog)
    return catalog, dict(total=len(catalog), deduplicated=len(records)-len(catalog), excluded=dict(skipped), sources=SOURCES, retrieved='2026-11-24')


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--cache', type=Path, required=True)
    args.add_argument('--download', action='store_true')
    options = args.parse_args()
    manifest = json.loads((ROOT/'scripts/catalog/sources.json').read_text())
    for entry in manifest['files']:
        file = options.cache/entry['file']
        if not file.exists() and options.download:
            file.parent.mkdir(parents=True, exist_ok=True)
            with urlopen(entry['url'], timeout=30) as response:
                file.write_bytes(response.read())
        if not file.exists() or hashlib.sha256(file.read_bytes()).hexdigest() != entry['sha256']:
            raise SystemExit(f'Missing or changed snapshot: {file}. Review its source before importing.')
    catalog, report = build(options.cache)
    (ROOT/'dist/assets/library.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n')
    (ROOT/'dist/assets/archives.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
