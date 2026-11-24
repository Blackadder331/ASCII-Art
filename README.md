# ASCII Studio

A green-and-black ASCII workbench inspired by Lock Books’ *ASCII Art from GameFAQs*.

Run `npm run dev` and open http://localhost:4173. No install or build step. Run `npm test` for conversion, search, deduplication, filtering, source-credit and cycling checks.

## The archive

The app bundles 3,493 distinct existing text artworks from six collections: Joan Stark’s preserved GeoCities galleries, Laura Brown, ASCII Cats, Candy Box 2, Roy/SAC and ASCII Bin. Over 100 cat results are available. Duplicate normalized drawings are merged with all discovered origins retained. This is a dated catalog, not a live search of the entire internet.

Search a subject, cycle every match with Previous/Next, or open “View all matches.” The gallery has source and subject filters, source labels and pagination. Left/right arrow keys cycle while the canvas is focused. Artist signatures stay in the art. Each piece shows its author and reuse terms; copy and TXT/PNG/SVG exports include credits and license links.

Adjustment controls remain visible beside the canvas. Select “Remix artwork” to convert an archive drawing into an adjustable copy with detail/density, contrast, character-set and inversion controls. “Restore original artwork” returns the exact archived text; selecting another result also returns to its original. Remix exports retain source attribution.

New art is generated from image uploads or `Text: HELLO` banners. Uploads are processed locally, with detail, contrast, character set and inversion controls. Free-form AI generation is not connected.

## Sources and reproducibility

See [credits](dist/credits.html) and [archive metadata](dist/assets/archives.json). Licenses vary: some works permit personal or noncommercial use only. This collection is not collectively public domain. Collection licenses cannot waive individual artists’ rights.

`scripts/catalog/sources.json` records the URL and SHA-256 of each source snapshot. `scripts/build-catalog.py` reads HTML PRE blocks and text/ZIP files as data, never executing source code. It preserves signatures, extracts titles and author notices, normalizes outer whitespace, rejects unsupported layouts, merges duplicate text and builds both catalog JSON files.

```sh
python3 scripts/build-catalog.py --cache /path/to/archive-cache --download
```

Without `--download` the build is offline. Changed upstream files fail checksum validation and require review before importing. Keep the original cache for exact reproduction if a source later disappears. The pinned Candy Box revision and preserved GeoCities pages provide historical provenance. The credits page and README counts should be updated if the catalog changes.

The initial ASCII Bin subset is retained in `scripts/catalog/ascii-bin.json`, with its original metadata index and import script. `scripts/catalog/ldb-labels.json` adds reviewed subject titles to otherwise unlabelled drawings.

Research also checked Christopher Johnson’s collection, ASCII.co.uk, ASCII Art Archive, and the Internet Archive. Sources without verified reuse terms or with inaccessible downloads were not bulk imported. The GeoCities collection was available from a preservation mirror; its Wayback record is linked in credits.

The editable site is in `dist/`, ready for static hosting. No photo libraries or online raster conversion are used for archive results.
