# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Quick font in the editor: pick a style, draw the 26 lowercase letters one by one with a faint guide letter, and the editor adds capitals made from your lowercase, digits, punctuation and marks from the style template, Latin-1 accented letters and even spacing. The start screen leads with it, and `app/#quick=script`, `#quick=block` or `#quick=pixel` opens it directly.
- Script, block and pixel styles, each with its brush and template (Quill Hand, Atelier Geometric and the new Atelier Pixel, a 5 by 7 pixel font).
- A pixel brush that fills and erases whole grid squares, so pixel letters stay on the grid.
- "Use your font" steps in the Download panel for a computer, Word, Canva and websites, with the right file for each and a copy button for the CSS.
- A "font is ready" view after quick mode with a live sample in the new font.

## [0.1.0] - 2026-10-13

### Added

- Font editor in the browser (`docs/app/`): freehand drawing that becomes clean outlines, a bezier pen tool, letter grid, metrics guides, side bearings, spacing, a type tester, templates and autosave in the browser, with `.fontsketch.json` project files.
- Quill Hand, a complete handwritten default font (Basic Latin, Portuguese and Latin-1 accents, typographic quotes and dashes, kerning) that the editor and the website open with.
- Three ways to create glyphs: drawing, importing SVG files and raster images (traced into vectors), and a printable handwriting sheet (A4 or Letter, PDF and SVG) scanned from a phone photo with marker detection, perspective correction, lighting normalization, cell segmentation and bitmap tracing with a confidence score per letter.
- Font compiler written in plain JavaScript: TTF (TrueType outlines), OTF (CFF outlines), WOFF and WOFF2, with `exportFont` and `exportFontAsync`.
- Font parser for TTF, OTF, WOFF and WOFF2 (`parseFont`, `parseFontAsync`), so existing fonts can be opened and edited.
- Automatic TrueType hinting with stem and zone detection, manual stem hints, or no hinting.
- Variable fonts with a weight axis built from point compatible masters, compatibility checks, interpolation and named instances.
- Kerning pairs and classes, and accented letters composed from base and mark components (Latin-1 Supplement and Latin Extended-A).
- Geometry helpers: curve fitting, simplification, cubic to quadratic conversion, contour direction correction, overlap removal and stroke outlines.
- `cssFontFace` and `unicodeRange` for ready `@font-face` rules.
- Command line tool: `fontsketch build`, `fontsketch from-svg` (icon font generator with CSS classes and a preview page), `fontsketch info` and `fontsketch instance`.
- Node helpers: `buildProject`, `fromSvgFolder`, `fontInfo`, `makeInstance` and `readFontFile`.
- Website with a live drawing studio, a scroll story, a gallery of fonts made with fontsketch (Quill Hand, Quill Hand Variable, Compass Display and Atelier Icons), 16 English guides and 5 Portuguese guides.
- Quill the octopus calligrapher, banners, feature icons and atelier illustrations in light and dark versions.

[Unreleased]: https://github.com/kwy404/fontsketch/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/kwy404/fontsketch/releases/tag/v0.1.0
