# ASCII Studio

A green-and-black ASCII workbench inspired by the cover of *ASCII Art from GameFAQs* from Lock Books.

Run `npm run dev` and open http://localhost:4173. No installation or build step is required. Run `npm test` to verify conversion and search behavior.

## Features

- Search 2,528 OpenMoji illustrations using subject descriptions. Combine up to four subjects with “and” or “+”.
- Search Wikipedia source photos for other subjects; this also runs when the illustration library has no matching subject.
- Convert uploaded JPG, PNG, WEBP, GIF, AVIF, or BMP files entirely in the browser. Animated images use a static frame. Files are limited to 20 MB and 60 megapixels.
- Live detail, contrast, character-set, inversion, and zoom controls.
- Copy or export TXT, PNG, and SVG, preserving source attribution.
- Responsive layout, keyboard controls, and accessible native dialogs.

Prompt generation searches source artwork. It does not use an AI model to invent arbitrary scenes. For an exact composition, upload a reference image. External search requires Wikipedia and image hosts to be available and allow CORS. Common illustrations and the search catalog are bundled locally; additional illustrations load from the OpenMoji repository.

## Attribution

OpenMoji artwork: https://openmoji.org/ — CC BY-SA 4.0. Artist credits are recorded in `dist/assets/library.json`; the license is bundled in `dist/assets/OPENMOJI-LICENSE.txt`. ASCII adaptations and exported files retain attribution. The initial butterfly study is an original SVG made for this project. Wikipedia photos link to their Commons source for attribution and original licensing.

The `dist/` directory is the editable, deployable site and can be served by any static web host. Local hosting configuration and environment files are excluded from version control.
