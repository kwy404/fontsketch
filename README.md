<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/banner-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/banner.svg" alt="fontsketch banner: Quill the octopus calligrapher next to the fontsketch wordmark, written in its own handwritten font" width="100%">
</picture>

# fontsketch

**Make a font from your handwriting, in the browser or in Node.**

[![npm version](https://img.shields.io/npm/v/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![CI](https://github.com/kwy404/fontsketch/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/fontsketch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/fontsketch/blob/main/LICENSE)

English | [Português (Brasil)](https://github.com/kwy404/fontsketch/blob/main/i18n/README.pt-BR.md)

[Open the editor](https://kwy404.github.io/fontsketch/app/) · [Website](https://kwy404.github.io/fontsketch/) · [Guides](https://kwy404.github.io/fontsketch/guides/) · [Gallery](https://kwy404.github.io/fontsketch/gallery/)

</div>

fontsketch is an open source font editor that runs in the browser, and the font compiler behind it as a Node library and CLI. Draw letters with a mouse, finger or pen, import SVG, or photograph a filled handwriting sheet, then export TTF, OTF, WOFF or WOFF2. It writes the font binary itself, with kerning, accented letters, TrueType hinting and variable weight axes. Nothing is uploaded: everything runs on your device.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/studio-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/studio.png" alt="The fontsketch studio on the website: the letter a drawn on a stage with x-height and baseline guides, next to a live sentence set in the Quill Hand font" width="100%">
</picture>

## Make a font in the browser

The fastest start is the [home page](https://kwy404.github.io/fontsketch/): type your name, press **Draw these letters**, draw each letter of it, and download the font.

The [editor](https://kwy404.github.io/fontsketch/app/) has four ways in:

1. **Quick font.** Pick a style (Script, Block or Pixel) and draw the 26 lowercase letters with a faint guide letter behind each one. fontsketch adds the capitals, numbers, punctuation, accented letters and spacing, so a usable font takes about five minutes. Capitals you skip are made from your own lowercase until you draw them. Open it directly with [](https://kwy404.github.io/fontsketch/app/#quick=script),  or .
2. **Draw.** Write each letter with a mouse, finger or stylus, then refine it with the bezier pen tool. The editor opens with Quill Hand, a complete handwritten font, as a template, or you can start blank.
3. **Import.** Drop SVG files or paste path data into a glyph, trace a PNG or JPG, or open a TTF, OTF, WOFF or WOFF2 font and keep editing it.
4. **Scan.** Print the handwriting sheet, fill each box with a dark pen and take a phone photo. fontsketch flattens the page, evens out the light, splits the boxes and traces each letter, with a confidence score so you know what to check.

Accented letters are built from a base letter and a mark (a + tilde = ã), covering Latin-1 Supplement and Latin Extended-A. Projects autosave in the browser and can be downloaded as `.fontsketch.json` files.

## Install

```bash
npm install fontsketch
```

Node 18.18 or newer. For a script tag, use `https://cdn.jsdelivr.net/npm/fontsketch@0.1.0/dist/fontsketch.min.js` (the global is `fontsketch`).

## Command line

Turn a folder of SVG icons into an icon font with WOFF2, WOFF and TTF files, one CSS class per icon and a preview page:

```bash
npx fontsketch from-svg ./icons --family Icons -o ./dist
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

Export WOFF2 and load it with `@font-face`. The editor and `cssFontFace` give you this rule ready to paste:

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

The **Use your font** box in the editor's Download panel shows the steps for a computer, Word, Canva and websites. To use the font in desktop apps, install the TTF or OTF file on Windows or macOS; Canva accepts uploaded fonts on plans with Brand Kit. The [website guide](https://kwy404.github.io/fontsketch/guides/use-a-custom-font-on-your-website/) covers React, Next.js and Vue.

## Browser support

The editor, drawing, export and camera scan work in Chrome and Edge 100+, Firefox 100+ and Safari 15.4+. In browsers, `exportFontAsync` and `parseFontAsync` load a small Brotli WebAssembly build only when you export or open WOFF2. In Node, WOFF2 uses the Brotli codec in zlib.

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
