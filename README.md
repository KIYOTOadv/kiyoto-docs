# KIYOTO Docs

A Persian-first library of 19 final KIYOTO Creative documents, with a custom PDF
reader and Bauhaus-inspired motion graphics.

**Website:** https://kiyotoadv.github.io/kiyoto-docs/

The site is static and self-contained. No build, backend or external CDN is needed.
PDFs load when opened. Reading position is saved in each visitor's own browser.

## Maintain the library

The document catalog is `catalog.json`. PDFs are in `pdfs/` and their cover previews
are in `assets/covers/`. Only approved final documents belong in this repository.

Run `node tools/verify.mjs` to verify the 19 files, SHA-256 hashes and page assets.
For local preview, serve the repository over HTTP, for example with
`python -m http.server 8080`.

GitHub Pages publishes from the root of the `main` branch.

## Licenses

KIYOTO documents and artwork belong to their respective owner. PDF.js 5.4.624 is
vendored under Apache-2.0 (`vendor/PDFJS-LICENSE`). Noto Sans Arabic is provided
under the SIL Open Font License (`assets/OFL.txt`).
