---
slug: create-a-font-online-free
lang: en
pair: criar-fonte-online-gratis
title: Create a Font Online Free, No Upload and No Account
description: Create a font online free in your browser. Draw, import SVG or scan your handwriting, then export TTF, OTF, WOFF or WOFF2 with no upload, no account and no fee.
h1: How to create a font online for free
keyword: create a font online free
art: pen-tool
alt: A browser window with a bezier pen tool drawing the letter a, showing corner and smooth points on a grid
time: PT45M
howto: How to create a font online for free with fontsketch
steps:
  - name: Open the editor in your browser
    text: Go to the fontsketch app. There is nothing to install and no sign up, and your work autosaves locally in the browser.
  - name: Choose how to create glyphs
    text: Draw letters with the brush or bezier pen, import SVG files or images, or print and scan the handwriting sheet.
  - name: Set the font metrics
    text: Check ascender, descender, x-height and cap height on the 1000 unit em so all letters share the same proportions.
  - name: Space the letters
    text: Adjust left and right side bearings until test words look evenly spaced, then add kerning pairs where needed.
  - name: Build accented letters
    text: Draw the marks once and let fontsketch compose accented letters from base plus mark components.
  - name: Export the font
    text: Export TTF or OTF for desktop use, or WOFF2 plus the CSS snippet for the web, and save a project file as a backup.
faq:
  - q: Can I create a font online for free without signing up?
    a: Yes. fontsketch has no accounts at all. You open the page and start drawing, and everything is stored in your own browser storage or in project files you save yourself.
  - q: Is an online font maker safe for private designs?
    a: With fontsketch your drawings are not uploaded anywhere, because the whole editor runs on your device. That makes it suitable for unreleased brand lettering or client work that should not sit on someone else's server.
  - q: Can I sell a font I made with a free online tool?
    a: The tool license and the font license are separate things. fontsketch is MIT licensed software and puts no restriction on fonts you create, so the glyphs you draw are yours to license, give away or sell.
  - q: What file format should I download my font in?
    a: Use TTF or OTF to install the font on Windows or macOS and use it in office or design apps. Use WOFF2 for websites because it is compressed with Brotli and loads fastest.
  - q: Does creating a font online work on a phone?
    a: Browsing works on a phone, but drawing and editing outlines is far more comfortable with a mouse, trackpad or pen tablet on a larger screen. Phones are great for photographing a handwriting sheet.
related: [free-font-maker, how-to-make-a-font, turn-your-handwriting-into-a-font, best-free-font-editor]
---
To create a font online for free, open a browser based font editor, draw or import your letters, set metrics and spacing, and export a font file. With fontsketch the entire process runs locally in the browser: no account, no upload, no watermark, and you can export TTF, OTF, WOFF or WOFF2 when you are done.

## Why make a font in the browser

Desktop font editors are powerful, but they take time to install and learn. Online converters are quick, but most of them require you to upload your files to a server and you rarely control the output. A browser editor that keeps files on your device sits in between: you get real editing tools without sending your drawings anywhere.

That last point matters more than it seems. If you are designing lettering for a client, a logo before launch, or simply your own handwriting, you probably prefer it to stay on your machine. fontsketch processes everything on your device and autosaves the project in local browser storage. You can also save a `.fontsketch.json` project file to move work between computers or keep backups.

## Three ways to create glyphs

A glyph is the drawn shape of a character. You can mix all three methods in the same font.

### Draw directly

The **brush** creates freehand strokes, which is handy for casual or marker style lettering. The **bezier pen** gives you precise control with corner points and smooth points. For clean geometric letters, the pen is the better choice.

A few habits that make pen drawing easier:

- Put points at the extremes of curves, meaning the top, bottom, left and right of a bowl.
- Keep handles horizontal or vertical at those extremes. This gives smooth curves and helps hinting later.
- Use as few points as the shape allows. Fewer points means smoother curves.

### Import SVG or images

If you already draw in a vector app, export each letter as SVG and import it. Paths come in as outlines ready to edit. Raster images in PNG or JPG are traced into vector outlines, which works well for brush lettering or logos. Our guides on [making a font from SVG](guide:make-a-font-from-svg) and [converting an image to a font](guide:convert-image-to-font) go deeper.

You can also open an existing TTF, OTF, WOFF or WOFF2 file to edit it, as long as its license allows modification.

### Scan your handwriting

Print the handwriting template, fill it with a pen, and photograph it. fontsketch detects the corner markers, corrects perspective and lighting, splits the cells and traces each letter with a confidence score. The full walkthrough is in [turn your handwriting into a font](guide:turn-your-handwriting-into-a-font).

## Decide your character set first

Before drawing anything, list the characters you need. A practical minimum for a usable Latin font:

- Uppercase A to Z and lowercase a to z
- Digits 0 to 9
- Basic punctuation: period, comma, colon, semicolon, apostrophe, quotes, question mark, exclamation mark, hyphen, parentheses
- Common symbols you will actually type, such as @, &, slash and the currency sign for your country

If you write in Portuguese, Spanish, French or German, you also need accented letters. You do not have to draw them all. Draw the marks (acute, grave, circumflex, tilde, diaeresis, cedilla, ring) and fontsketch builds letters like á, ñ, ç and ö automatically from components. This covers Latin-1 Supplement and Latin Extended-A.

## Get the metrics right

fontsketch uses **1000 units per em**, the usual value for OpenType fonts. Every glyph is drawn inside that coordinate system. The vertical metrics define where letters sit:

| Metric | What it controls | Typical value |
| --- | --- | --- |
| Baseline | Where letters sit | 0 |
| x-height | Height of lowercase like x, n, o | 450 to 550 |
| Cap height | Height of uppercase letters | 650 to 720 |
| Ascender | Top of b, d, h, k, l | 700 to 780 |
| Descender | Bottom of g, p, q, y | negative 180 to 250 |

These are starting points, not rules. A large x-height reads well at small sizes; a small x-height feels more elegant and old style. What matters is consistency: once you choose a value, every lowercase letter should honor it.

Round letters like o, c and s need a small **overshoot**. They should go 10 to 15 units above the x-height and below the baseline, otherwise they look smaller than flat letters next to them.

## Spacing and kerning

Spacing is the step most beginners skip, and it is the step that most separates an amateur font from a good one. Each glyph has a left and right **side bearing**. Straight sided letters like n and H need more space than round ones like o, because round shapes already have optical space around them.

Test spacing with strings like *nnonnoon* and *HHOHHOOH*. When the rhythm looks even, add kerning pairs for the combinations that still look loose or tight: AV, To, Ty, Yo, LT and P followed by a period are classic examples. The [font kerning guide](guide:font-kerning-guide) explains pairs and classes in detail.

## Export your font

When the letters and spacing look right, export:

- **TTF** or **OTF (CFF outlines)** for installing on Windows or macOS
- **WOFF2** for websites, with a ready made CSS @font-face snippet
- **WOFF** as a fallback for very old browsers

You can also choose automatic TrueType hinting, manual stem hints, or no hinting. For a display or handwriting font, automatic is a fine default.

If you need a variable font with a weight axis, draw Regular and Bold masters with the same point structure and export them as one variable file. See the [variable font tutorial](guide:variable-font-tutorial).

## Save and back up your work

Because nothing lives on a server, your browser is where the project autosaves. That is convenient, but browser storage can be cleared by privacy settings, cleanup tools or simply using a different browser. Save a `.fontsketch.json` project file whenever you reach a milestone, for example after tracing, after spacing and before export. Name the files with a date or version so you can return to an earlier state if an experiment goes wrong. The project file is also how you move work to another computer.

## Before you export: checklist

- Every character you plan to type exists, including punctuation
- Lowercase letters share one x-height, capitals share one cap height
- Round letters overshoot slightly
- Overlaps removed and contour directions corrected
- Spacing tested with real words, not just the alphabet
- Project file saved as a backup

## Next steps

Open the [fontsketch editor](app:) and draw your first three letters: n, o and H. They define stems, curves and spacing for everything else. Then follow [how to make a font](guide:how-to-make-a-font) for the full process, or compare tools with our neutral [free font editor checklist](guide:best-free-font-editor).
