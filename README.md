<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/banner-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/banner.svg" alt="fontsketch banner: Quill the octopus calligrapher next to the fontsketch wordmark, written in its own handwritten font" width="100%">
</picture>

# fontsketch: turn your handwriting into a font, free in your browser

**Draw, import or scan your handwriting and export a real TTF, OTF, WOFF or WOFF2 font. No upload, no account.**

[![npm version](https://img.shields.io/npm/v/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![npm downloads per month](https://img.shields.io/npm/dm/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![npm downloads total](https://img.shields.io/npm/dt/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![CI](https://github.com/kwy404/fontsketch/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/fontsketch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/fontsketch/blob/main/LICENSE)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/fontsketch)](https://bundlephobia.com/package/fontsketch)

English | [Português (Brasil)](https://github.com/kwy404/fontsketch/blob/main/i18n/README.pt-BR.md)

[Open the editor](https://kwy404.github.io/fontsketch/app/) · [Website](https://kwy404.github.io/fontsketch/) · [Guides](https://kwy404.github.io/fontsketch/guides/) · [Gallery](https://kwy404.github.io/fontsketch/gallery/) · [npm](https://www.npmjs.com/package/fontsketch)

</div>

fontsketch is a free, open source **font editor in the browser** and a font compiler for Node. Write letters with your mouse, finger or pen, import SVG files, or print a handwriting sheet, fill it in and take a phone photo: fontsketch flattens the page, traces every letter and turns it into a font you can install or use on the web. It writes the font binary itself, with kerning, accented letters, automatic TrueType hinting and variable weight axes, and it runs entirely on your device.

The same engine ships as a library and a CLI, so you can **make a font from SVG** files, run an **icon font generator** in CI, or build fonts from code.

## Table of contents

- [Features](#features)
- [Three ways to create a font](#three-ways-to-create-a-font)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Command line: icon fonts from SVG](#command-line-icon-fonts-from-svg)
- [Node and browser API](#node-and-browser-api)
- [Use your font on a website](#use-your-font-on-a-website)
- [Browser support](#browser-support)
- [FAQ](#faq)
- [More from kwy404](#more-from-kwy404)
- [Author](#author)
- [License](#license)

## Features

<table>
<tr>
<td width="33%" valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/draw.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/draw.svg" width="40" alt="Brush stroke icon"></picture><br><b>Freehand drawing</b><br>Brush strokes with a soft pen become smooth, editable outlines.</td>
<td width="33%" valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/pen-tool.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/pen-tool.svg" width="40" alt="Pen nib with bezier handles icon"></picture><br><b>Bezier pen tool</b><br>Corner and smooth points, handles, guides and side bearings.</td>
<td width="33%" valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/import-svg.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/import-svg.svg" width="40" alt="SVG file import icon"></picture><br><b>Import SVG</b><br>Drop SVG files or paste path data straight into a glyph.</td>
</tr>
<tr>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/image-trace.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/image-trace.svg" width="40" alt="Image tracing icon"></picture><br><b>Image tracing</b><br>Convert PNG or JPG lettering into vector contours.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/handwriting-sheet.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/handwriting-sheet.svg" width="40" alt="Printable handwriting sheet icon"></picture><br><b>Handwriting sheet</b><br>Printable A4 and Letter templates (PDF and SVG) with corner markers.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/camera.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/camera.svg" width="40" alt="Phone camera icon"></picture><br><b>Phone camera scan</b><br>Perspective, lighting and cells detected on the device, with a confidence score per letter.</td>
</tr>
<tr>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/kerning.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/kerning.svg" width="40" alt="Kerning pair icon"></picture><br><b>Kerning</b><br>Pairs and classes, exported as OpenType kerning.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/hinting.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/hinting.svg" width="40" alt="Pixel grid hinting icon"></picture><br><b>Hinting</b><br>Automatic TrueType hinting, manual stems, or none.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/variable-font.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/variable-font.svg" width="40" alt="Variable weight slider icon"></picture><br><b>Variable fonts</b><br>A weight axis from compatible masters, in one font file.</td>
</tr>
<tr>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/export.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/export.svg" width="40" alt="Font export icon"></picture><br><b>Export</b><br>TTF, OTF (CFF), WOFF and WOFF2, plus the <code>@font-face</code> CSS.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/icon-font.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/icon-font.svg" width="40" alt="Icon font grid icon"></picture><br><b>Icon fonts</b><br>A CLI that turns a folder of SVG icons into a font with CSS classes.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/autosave.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/autosave.svg" width="40" alt="Autosave icon"></picture><br><b>Autosave</b><br>Projects save in your browser and as <code>.fontsketch.json</code> files.</td>
</tr>
</table>

Accented letters are built automatically from components (a + tilde = ã), covering Latin-1 Supplement and Latin Extended-A, so Portuguese, Spanish, French, German and Polish text works out of the box.

## Three ways to create a font

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/scan-to-font-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/scan-to-font.svg" alt="A phone photo of a handwriting sheet being flattened, cleaned, split into cells and traced into vector glyphs" width="100%">
</picture>

1. **Draw.** Open the [editor](https://kwy404.github.io/fontsketch/app/) and write each letter with a mouse, a finger or a stylus. Strokes become clean outlines you can refine with the bezier pen tool. The editor opens with Quill Hand, a complete handwritten font, as a template, or you can start from a blank page.
2. **Import.** Drop SVG files or paste path data into any glyph, trace a PNG or JPG of your lettering, or open an existing TTF, OTF, WOFF or WOFF2 font and keep editing it.
3. **Handwriting sheet.** Print the template on A4 or Letter paper, fill each cell with a dark pen and take a phone photo. fontsketch finds the four corner markers, corrects the perspective, evens out the light, splits the cells and traces each letter, with a confidence score so you know what to check.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/nib-strokes-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/nib-strokes.svg" alt="Strokes made by a broad nib, a pointed pen, a brush and a monoline marker" width="100%">
</picture>

## Screenshots

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/studio-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/studio.png" alt="The fontsketch studio on the website: the letter a drawn on a stage with x-height and baseline guides, next to a live sentence set in the Quill Hand font" width="100%">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/editor-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/editor.png" alt="The fontsketch font editor in the browser: a letter grid, the letter A on the canvas with metric lines, and spacing, outline and component tools" width="100%">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/templates-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/templates.png" alt="The start screen of the editor: edit Quill Hand, start a blank font, pick a template or import a font file, SVG drawings, an image or a handwriting sheet" width="100%">
</picture>

## Quick start

**In the browser:** open [kwy404.github.io/fontsketch/app](https://kwy404.github.io/fontsketch/app/). Nothing to install, and your files never leave your device.

**With npm** (Node 18 or newer):

```bash
npm install fontsketch
```

**From a CDN** with a script tag (the global is `fontsketch`):

```html
<script src="https://cdn.jsdelivr.net/npm/fontsketch@0.1.0/dist/fontsketch.min.js"></script>
```

## Command line: icon fonts from SVG

Turn a folder of SVG icons into an icon font. Each file becomes a glyph in the Private Use Area (from U+E000), and you get WOFF2, WOFF and TTF files, a stylesheet with one class per icon and an `index.html` preview page:

```bash
npx fontsketch from-svg ./icons --family Icons -o ./dist
```

```html
<link rel="stylesheet" href="dist/icons.css">
<i class="icon icon-home" aria-hidden="true"></i>
```

All commands:

| Command | What it does |
| --- | --- |
| `fontsketch build <project.fontsketch.json> [-o dir] [--formats ttf,woff2] [--hinting auto\|manual\|none] [--variable] [--outlines truetype\|cff] [--legacy-kern] [--no-css]` | Compiles a project saved from the editor (or any font file) into font files and an `@font-face` stylesheet |
| `fontsketch from-svg <folder> --family <name> [-o dir] [--formats woff2,woff,ttf] [--start E000] [--prefix icon]` | Icon font generator: SVG folder to font, CSS classes and preview page. A file named like `home-uE001.svg` keeps that code point |
| `fontsketch info <font> [--json]` | Format, names, metrics, tables and features of a TTF, OTF, WOFF or WOFF2 file |
| `fontsketch instance <font> --wght 700 [-o file] [--format ttf]` | Static instance of a variable font at any axis location |

## Node and browser API

The package works in Node 18+ and in browsers, with no runtime dependencies. In Node, `import ... from 'fontsketch'` also registers the built in zlib for WOFF and WOFF2.

```js
import { writeFileSync } from 'node:fs';
import { createFont, addGlyph, circleContour, reverseContour, exportFont, cssFontFace } from 'fontsketch';

const font = createFont({ family: 'My Hand', designer: 'Me' });
addGlyph(font, {
  name: 'o',
  advanceWidth: 520,
  contours: [circleContour(260, 250, 230), reverseContour(circleContour(260, 250, 130))],
});

writeFileSync('my-hand.woff2', exportFont(font, { format: 'woff2', hinting: 'auto' }));
console.log(cssFontFace(font, '/fonts/my-hand.woff2'));
```

Fonts are plain JSON friendly objects: 1000 units per em, Y axis up, quadratic TrueType contours (`{ x, y, on }` points), kerning pairs and classes, optional `axes` and `masters` for variable fonts. Projects saved by the editor (`.fontsketch.json`) load with `deserialize`.

### Fonts

| Function | Description |
| --- | --- |
| `createFont(meta?)` | New font with `.notdef` and `space`. `meta`: `family`, `style`, `designer`, `license`, `unitsPerEm`, `ascender`, `descender`, `xHeight`, `capHeight` and more |
| `addGlyph(font, glyph)` | Adds or replaces a glyph `{ name, unicodes?, advanceWidth, contours, components?, anchors? }`. Unicode is inferred from production names such as `a`, `Atilde` or `uni0416` |
| `removeGlyph(font, name)` | Removes a glyph and its kerning pairs |
| `glyphNameFor(char)` / `unicodeFor(name)` | Production glyph names and code points |
| `compose(font, char)` / `composeAll(font, { chars?, overwrite? })` | Builds accented letters from a base and mark components, for Latin-1 Supplement and Latin Extended-A (`PORTUGUESE` lists the Portuguese set) |
| `serialize(font)` / `deserialize(json)` | The `.fontsketch.json` project format |
| `validateFont(font)` | Human readable list of problems the compiler would reject |

### Export and import

| Function | Description |
| --- | --- |
| `exportFont(font, options?)` | Compiles to bytes. `format`: `'ttf'`, `'otf'`, `'woff'` or `'woff2'`; `hinting`: `'auto'`, `'manual'` or `'none'`; `variable`: `true` for a variable font from `axes` and `masters`; `outlines`: `'truetype'` or `'cff'` inside WOFF and WOFF2 |
| `exportFontAsync(font, options?)` | Same, and loads the Brotli codec first for WOFF2 in browsers |
| `parseFont(bytes)` / `parseFontAsync(bytes)` | Reads TTF, OTF, WOFF and WOFF2 back into a font object you can edit |
| `cssFontFace(font, url, options?)` | A ready `@font-face` rule. `url` can be a list of files; options `family`, `display`, `weight`, `style`, `unicodeRange`, `variable` |
| `unicodeRange(font)` | The CSS `unicode-range` of a font |
| `svgToContours(svg, options?)` | Converts SVG markup into glyph contours, fitted to the em: `{ contours, advanceWidth, warnings }` |

### Variable fonts and hinting

| Function | Description |
| --- | --- |
| `checkCompatibility(font)` | Clear messages for every master glyph that is not point compatible with the default |
| `interpolate(font, location)` | A static font at a location such as `{ wght: 650 }` |
| `namedInstances(font)` | Thin to Black instances for the weight axis |
| `detectZones(font)` / `findStems(contours, axis, maxWidth)` | The blue zones and stems that automatic hinting snaps to the pixel grid |

### Geometry

`simplify`, `fitCurves`, `fitContour`, `cubicToQuadratic`, `contourFromCubics`, `correctDirection`, `reverseContour`, `removeOverlaps`, `strokeToOutline`, `circleContour`, `transformContours`, `roundContours`, `bounds`, `contourArea` and `pathFromPoints` (SVG path data for previews).

### Handwriting scan

From `fontsketch/scan`, in browsers and in Node. Pass any `ImageData` like object (`{ width, height, data }`) or, in browsers, an `ImageBitmap`, image or canvas. `fontsketch/scan/worker` runs the same scan in a Web Worker.

```js
import { createFont, addGlyph, exportFont } from 'fontsketch';
import { createTemplate, scanSheet } from 'fontsketch/scan';

const sheet = createTemplate({ chars: ['essential', 'portuguese'], pageSize: 'A4' });
// print sheet.pdf (bytes) or sheet.svgPages, write by hand, take a photo

const result = scanSheet(photo, { template: sheet.template });
const font = createFont({ family: 'My Hand' });
for (const glyph of Object.values(result.glyphs)) {
  if (!glyph.empty && glyph.confidence > 0.5) addGlyph(font, glyph);
}
result.rescan('g', { threshold: 0.6 }); // retrace one letter with another ink threshold
const woff2 = exportFont(font, { format: 'woff2' });
```

| Function | Description |
| --- | --- |
| `createTemplate(options?)` | Printable sheet with corner markers, a page code and guide lines: `{ pdf, svg, svgPages, template, pages }`. `chars` takes a string or names from `CHARSETS` (`essential`, `lowercase`, `uppercase`, `digits`, `punctuation`, `basicLatin`, `portuguese`); also `pageSize` (`'A4'` or `'Letter'`), `title` and `metrics` |
| `scanSheet(image, { template, threshold?, chars? })` | Finds the markers at any rotation, flattens perspective and lighting, removes the guides and traces every cell: `{ glyphs, warnings, page, rescan(char, options) }`. Each glyph has `contours`, `advanceWidth`, `confidence` and its own `warnings` |
| `scanSheets(images, options)` | Several photos of a multi page template in any order, merged, with missing pages reported |
| `importImage(image, options?)` | One letter, or a whole alphabet written in rows, from a photo without a template |
| `importSvg(svg, options?)` | Letters from SVG artwork |

### Node helpers

Available from `fontsketch` in Node and from `fontsketch/node`:

| Function | Description |
| --- | --- |
| `buildProject(project, { out, formats, hinting, variable, outlines, css })` | What `fontsketch build` does, returning the written files |
| `fromSvgFolder(dir, { family, out, formats, start, prefix })` | What `fontsketch from-svg` does: `{ font, files, icons }` |
| `fontInfo(bytes)` | Format, names, metrics and tables of a font file |
| `makeInstance(input, location, options?)` | Static instance of a variable font |
| `readFontFile(path)` | Reads any font or project file into a font object |

## Use your font on a website

Export WOFF2 and load it with `@font-face`. The same CSS works in plain HTML, React, Vue, Angular and Next.js.

```css
@font-face {
  font-family: 'My Hand';
  src: url('/fonts/my-hand.woff2') format('woff2');
  font-display: swap;
}

h1 {
  font-family: 'My Hand', cursive;
}
```

In **Next.js** you can let the framework host the file with `next/font/local`:

```js
import localFont from 'next/font/local';

export const myHand = localFont({ src: './fonts/my-hand.woff2', display: 'swap' });
```

Then use `className={myHand.className}` on any element. In **React**, **Vue** and **Angular** projects, put the `@font-face` rule in your global stylesheet and reference the family by name.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/glyph-anatomy-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/glyph-anatomy.svg" alt="Glyph anatomy: ascender, cap height, x-height, baseline and descender around the letters Hgx" width="100%">
</picture>

## Browser support

| | Chrome and Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Editor, drawing and export | 100+ | 100+ | 15.4+ |
| Camera scan of a handwriting sheet | 100+ | 100+ | 15.4+ |
| Fonts you export | every browser and operating system that reads TTF, OTF, WOFF or WOFF2 | | |

The library runs in Node 18.18 or newer and in any modern browser. In Node, WOFF2 uses the Brotli codec built into zlib. In browsers, `exportFontAsync` and `parseFontAsync` load a small Brotli WebAssembly build on demand, only when you export or open WOFF2.

## FAQ

### How do I turn my handwriting into a font for free?

Print the fontsketch handwriting sheet, fill each cell with a dark pen, take a phone photo and drop it into the [editor](https://kwy404.github.io/fontsketch/app/). It traces every letter and exports TTF, OTF or WOFF2. Step by step: [turn your handwriting into a font](https://kwy404.github.io/fontsketch/guides/turn-your-handwriting-into-a-font/).

### Can I create a font online for free without installing anything?

Yes. fontsketch is a font editor in the browser: no account, no install, no watermark, and nothing is uploaded. See [create a font online free](https://kwy404.github.io/fontsketch/guides/create-a-font-online-free/).

### How do I make a font from SVG files?

Import SVG paths into glyphs in the editor, or run `npx fontsketch icons ./icons --out ./dist` to build an icon font from a folder. See [make a font from SVG](https://kwy404.github.io/fontsketch/guides/make-a-font-from-svg/) and the [icon font generator guide](https://kwy404.github.io/fontsketch/guides/icon-font-generator/).

### Which font formats can I export?

TTF (TrueType outlines), OTF (CFF outlines), WOFF and WOFF2, plus a ready `@font-face` snippet. Variable fonts with a weight axis are exported from compatible masters.

### Can I use my font in Cricut Design Space, Canva, Word or Photoshop?

Yes. Install the TTF or OTF on Windows or macOS and it appears in every app that lists system fonts. See [design your own font for Cricut](https://kwy404.github.io/fontsketch/guides/design-your-own-font-for-cricut/).

### Who owns the fonts I make?

You do. fontsketch is MIT licensed and adds no license or watermark to your fonts. Pick any license you like for them.

## More from kwy404

- [Monsoon](https://kwy404.github.io/monsoon/): a CSS framework you use from a CDN, with no build step.
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): reactive HTML attributes for plain pages.
- [breakhound](https://kwy404.github.io/breakhound/): finds bugs in any JavaScript library, no tests required.
- [cookieowl](https://kwy404.github.io/cookieowl/): cookie consent for LGPD and GDPR that really blocks trackers.
- [installkite](https://kwy404.github.io/installkite/): make any website an installable, offline capable PWA.
- [a11ymedic](https://kwy404.github.io/a11ymedic/): accessibility checker that explains every problem and its fix.
- [graphemely](https://kwy404.github.io/graphemely/): emoji safe string utilities.
- [numberparrot](https://kwy404.github.io/numberparrot/): parse localized numbers and currency strings.
- [edgegoat](https://kwy404.github.io/edgegoat/): edge case test inputs for JavaScript.
- [vueleap](https://kwy404.github.io/vueleap/): migrate Vue 2 to Vue 3 with one command.
- [kastor](https://kwy404.github.io/kastor/): TypeScript ORM for PostgreSQL, MySQL, SQLite, SQL Server, Oracle, MongoDB and more.

## Author

Created by **Alexandre Kohler** ([GitHub](https://github.com/kwy404) and [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

The [website](https://kwy404.github.io/fontsketch/) is built with [Monsoon](https://kwy404.github.io/monsoon/), and its interactive parts are built with [Voodoo.js](https://kwy404.github.io/Voodoo.js/).

## License

[MIT](https://github.com/kwy404/fontsketch/blob/main/LICENSE). Copyright (c) 2026 Alexandre Kohler. Fonts you create with fontsketch are yours.
