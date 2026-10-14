---
slug: free-font-maker
lang: en
title: Free Font Maker and Font Creator, Open Source
description: fontsketch is a free font maker and font creator that runs in your browser or Node. Draw, import or scan glyphs, kern, hint and export TTF, OTF and WOFF2.
h1: A free font maker that runs in your browser
keyword: free font maker
art: type-case
alt: An open type case with drawers of letters next to exported font files labeled TTF, OTF and WOFF2
time: PT40M
howto: How to make a font with a free font maker
steps:
  - name: Open the font maker
    text: Load the fontsketch app in a desktop browser. No account is needed and projects autosave locally.
  - name: Add your glyphs
    text: Draw with the brush or bezier pen, import SVG or PNG and JPG images, or scan a filled handwriting sheet.
  - name: Clean up the outlines
    text: Simplify traced shapes, remove overlaps and let fontsketch correct contour direction so counters render properly.
  - name: Set metrics and spacing
    text: Align x-height, cap height, ascender and descender, then adjust side bearings and kerning pairs.
  - name: Export the font files
    text: Export TTF, OTF, WOFF or WOFF2 with optional hinting, plus a CSS @font-face snippet for the web.
faq:
  - q: What is the best free font maker for beginners?
    a: Look for a tool that lets you start quickly without installing anything, offers a handwriting scan route, and exports standard formats. fontsketch covers those points and still gives you real outline editing when you want more control.
  - q: Do free font creators add a watermark or limit characters?
    a: fontsketch does neither. It is MIT licensed open source software, there is no paid version, and you can include as many glyphs as you draw.
  - q: Can a free font maker export OTF and WOFF2?
    a: Yes. fontsketch exports TTF, OTF with CFF outlines, WOFF and WOFF2, and it can also generate the CSS @font-face rule for using the font on a website.
  - q: Can I automate font creation from code?
    a: Yes. fontsketch is also a Node library with functions such as createFont, addGlyph and exportFont, and a CLI that turns a folder of SVG icons into an icon font.
related: [create-a-font-online-free, best-free-font-editor, how-to-make-a-font, icon-font-generator]
---
A free font maker lets you draw or import letter shapes and export them as an installable font file. fontsketch is a free, open source font creator that runs entirely in your browser: you draw, import SVGs or images, or scan your handwriting, then export TTF, OTF, WOFF or WOFF2 without uploading anything or creating an account.

## What a font maker actually does

A font file is more than a set of pictures of letters. It is a small database that maps characters to outlines and describes how they behave together. A proper font maker handles all of these parts:

- **Outlines**: the vector shapes of each glyph, made of points and curves
- **Character mapping**: which Unicode character each glyph represents
- **Metrics**: units per em, ascender, descender, x-height and cap height
- **Spacing**: side bearings and the advance width of each glyph
- **Kerning**: adjustments between specific pairs of letters
- **Hinting**: instructions that help outlines snap to pixels at small sizes
- **Export**: writing all of this into TTF, OTF, WOFF or WOFF2

Simple online converters often handle only the first two. The rest is what makes a font comfortable to read.

## What you can make with fontsketch

| Project | Best route in fontsketch |
| --- | --- |
| Your own handwriting font | Print the handwriting sheet and photograph it |
| Display or logo lettering | Import SVG or trace a high contrast image |
| Geometric or text typeface | Draw with the bezier pen tool |
| Icon font for a web project | Use the CLI on a folder of SVG icons |
| Edit or extend an existing font | Open the TTF, OTF, WOFF or WOFF2 file |
| Weight range in one file | Draw Regular and Bold masters and export a variable font |

## A tour of the tools

### Drawing

The brush is for loose, expressive strokes. The bezier pen tool is for precise outlines, with corner points for sharp joins and smooth points for continuous curves. You can switch between them inside one glyph.

### Importing

SVG files and pasted SVG paths become editable outlines. PNG and JPG images are traced into vector outlines. When you trace, start from a high contrast image at decent resolution, because tracing quality depends heavily on the input. See [convert an image to a font](guide:convert-image-to-font) for practical tips.

### Handwriting sheet

The handwriting route is the fastest way from paper to font. Print the A4 or Letter PDF, fill the cells, take a photo. fontsketch locates the corner markers, fixes perspective, evens out lighting, binarizes, splits the cells and traces each character, with a confidence score so you know which glyphs to review.

### Cleanup and outline tools

Traced shapes always need some tidying. **Simplify** and curve fitting cut point counts and smooth wobbly edges. **Overlap removal** merges crossing strokes into one outline, which matters for both rendering and file size. **Contour direction correction** makes sure holes in letters like o, a and B stay hollow.

### Accented letters

Draw the marks once, and fontsketch composes accented letters from base glyph plus mark component, for example a plus tilde gives ã. Coverage includes Latin-1 Supplement and Latin Extended-A, which handles Portuguese, Spanish, French, German, Polish, Czech and many more. Because these are components, fixing the base letter fixes every accented version too.

### Kerning, hinting and variable fonts

Kerning works with individual pairs and with classes, so you can kern every round letter against T in one move. Hinting can be automatic TrueType hinting, manual stem hints, or none. For variable fonts, fontsketch builds a weight axis (wght) from compatible masters and exports a single variable font file. The [variable font tutorial](guide:variable-font-tutorial) walks through it.

## Privacy by design

Most free font makers online process your files on their servers. fontsketch does the opposite: the app is a static page and all the work happens on your device. Nothing is uploaded and there is no account to protect. Projects autosave in your browser, and you can save a `.fontsketch.json` project file to move between machines or keep version backups.

## For developers: Node library and CLI

The same engine is available as a package for Node 18 and later:

```bash
npm i fontsketch
```

The API includes `createFont`, `addGlyph`, `exportFont`, `parseFont` and `cssFontFace`. A typical use is converting an existing font to WOFF2 in a build step:

```js
import { readFile, writeFile } from 'node:fs/promises';
import { parseFont, exportFont } from 'fontsketch';

const font = parseFont(await readFile('MyFont.ttf'));
const woff2 = exportFont(font, { format: 'woff2' });
await writeFile('MyFont.woff2', woff2);
```

There is also a CLI that builds an icon font from a folder of SVG files, covered in the [icon font generator guide](guide:icon-font-generator). Start with:

```bash
npx fontsketch --help
```

## Who owns the fonts you make

The fontsketch software is released under the MIT license. That license covers the code of the tool, not the letters you draw with it. Glyphs you design yourself are your work, and you decide how to license the resulting font: keep it private, sell it, or release it openly.

If you want to share a font for free, a common choice is the SIL Open Font License (OFL). It lets anyone use, embed, modify and redistribute the font, but not sell the font file on its own, and it can reserve the font name so modified versions must be renamed. If you plan to sell, write a simple end user license that states where the font may be used (desktop, web, apps) and whether embedding in products is allowed.

Be careful when editing existing fonts. Opening a TTF or OTF in a font maker is technically easy, but modifying and redistributing it is only allowed if its license permits that. OFL fonts allow modification under conditions; many commercial fonts do not.

## How to pick a free font creator

If you are comparing tools, these questions matter more than feature counts:

- Does it export standard formats you can install and use anywhere?
- Do your files stay on your device, or are they uploaded?
- Can you edit outlines, or only convert images?
- Does it handle spacing and kerning, not just shapes?
- Can you save a project and come back later?
- Is the license clear about who owns the fonts you make?

Our [neutral checklist for choosing a font editor](guide:best-free-font-editor) expands on each point.

## Quick start checklist

- Decide the character set before drawing
- Draw or trace n, o and H first to set stems, curves and spacing
- Keep one x-height and one cap height across the font
- Clean outlines with simplify and overlap removal
- Test spacing in real words
- Export TTF or OTF for desktop and WOFF2 for the web

## Next steps

Open the [fontsketch editor](app:) and try the route that fits you best. If you are new to type design, follow [how to make a font](guide:how-to-make-a-font) from start to finish. If you want the quickest result, go straight to [turning your handwriting into a font](guide:turn-your-handwriting-into-a-font).
