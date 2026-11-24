# ASCII Studio

A green-and-black ASCII workbench inspired by the cover of *ASCII Art from GameFAQs* from Lock Books.

Run `npm run dev` and open http://localhost:4173. No installation or build step is required. Run `npm test` to verify conversion, archive integrity, search, and cycling.

## Features

- Search 97 existing text drawings selected from [ASCII Bin](https://github.com/amwhoi/ascii-bin), including seven skull variations. Try `skull`, `cat`, `rose`, or `castle`.
- Previous/Next wraps through every match. “View all matches” opens the same results as a gallery. Arrow keys cycle when the canvas is focused. Zoom never rewrites the source text.
- Enter `Text: HELLO` to generate a banner.
- Convert uploaded JPG, PNG, WEBP, GIF, AVIF, or BMP files entirely in the browser. Animated images use a static frame. Files are limited to 20 MB and 60 megapixels.
- Live detail, contrast, character-set, and inversion controls for generated art; zoom for all artwork.
- Copy or export TXT, PNG, and SVG, preserving source attribution.
- Responsive layout, keyboard controls, and accessible native dialogs.

The archive is a curated snapshot of one online collection, not a live search of all ASCII libraries. No photo or illustration search is used. Artwork is bundled locally, so browsing needs no external API or image host. Free-form AI generation is not connected. An idea searches existing text artwork; an image or text banner generates new output.

## Attribution

See [dist/credits.html](dist/credits.html) for source and reuse notes. ASCII Bin publishes its collection under CC0 1.0, while noting that this covers rights held by the collector and cannot waive other artists’ rights. Its license is included in `dist/assets/ASCII-BIN-LICENSE.txt`. Preserve signatures and check individual creator rights before reuse requiring permission.

The source snapshot was imported November 24, 2026, from `asciiart_db.txt`. Its SHA-256 after newline normalization is `4833eae18797b5822a31c846982b958842804a57d1ed6c73306bedfc058a3dc5`. Only surrounding blank padding, common left indentation, and trailing spaces are normalized; tabs expand at eight-column stops. No drawing characters or signatures are removed.

`scripts/archive-index.json` supplies titles and search tags. To reproduce the import, download the matching upstream snapshot and run:

```sh
python3 scripts/import-archive.py /path/to/asciiart_db.txt
```

The importer validates the snapshot hash before applying the catalog. Adding another library means adding text records with a unique ID, title, tags, category, source URL, and original text to `dist/assets/library.json`, respecting its reuse terms and retaining credits.

The `dist/` directory is the editable, deployable site and can be served by any static web host. Local hosting configuration and environment files are excluded from version control.
