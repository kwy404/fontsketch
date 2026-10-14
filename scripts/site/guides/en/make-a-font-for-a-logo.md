---
slug: make-a-font-for-a-logo
lang: en
title: Make a Font for a Logo, From Custom Lettering to Font
description: Make a font for a logo by extending custom lettering into a full alphabet. Consistency rules, wordmark kerning, export for brand use and licensing basics.
h1: How to make a font for a logo, and turn custom lettering into a brand font
keyword: make a font for a logo
art: nib-strokes
alt: A hand lettered wordmark broken into individual glyphs, with shared stroke angles and terminals extended into a full alphabet
time: PT4H
howto: How to turn logo lettering into a brand font with fontsketch
steps:
  - name: Collect the logo letters
    text: Import the logo letters as SVG or trace them from a high resolution image, one glyph per character.
  - name: Extract the design rules
    text: Measure stem width, contrast, stroke angle, terminal shape, x-height and cap height from the existing letters.
  - name: Draw the missing letters
    text: Extend the alphabet by reusing parts of the logo letters so every new glyph follows the same rules.
  - name: Space and kern the font
    text: Set even side bearings for running text, then add kerning pairs and classes for common combinations.
  - name: Export for every brand use
    text: Export OTF or TTF for the design team and WOFF2 with CSS for the website.
  - name: Decide the license
    text: Document who owns the font, who may use it and whether it may be shared outside the company.
faq:
  - q: Should a logo be typed in a font or drawn as artwork?
    a: The final logo should be vector artwork, with every letter position fine tuned by hand. A matching font is for everything around the logo, such as headings, packaging and signage, so the brand looks consistent.
  - q: Can I use any font in my logo?
    a: Only if its license allows it. Many desktop licenses permit logo use, some do not, and free fonts vary. OFL fonts can be used in logos. Always read the license before building a brand on a font.
  - q: Do I own a font made from my own logo lettering?
    a: If you drew the lettering yourself, or have a written transfer of rights from the designer who did, you control the font you make from it. Protection for typeface designs differs between countries, so ask a lawyer for anything high stakes.
  - q: How many characters does a logo font need?
    a: For headlines only, uppercase, figures and basic punctuation may be enough. If the brand writes body copy or works in several languages, add lowercase and accented letters, which fontsketch builds from marks automatically.
related: [convert-image-to-font, make-a-font-from-svg, font-kerning-guide, use-a-custom-font-on-your-website]
---
To make a font for a logo, import the logo letters as SVG or trace them, measure the design rules they share, draw the missing characters with the same rules, then space, kern and export. The logo stays hand tuned artwork; the font carries its voice everywhere else. fontsketch does all of this free in your browser.

## Why turn logo lettering into a font

A custom wordmark has a strong personality, but it usually contains only a handful of letters. When the brand needs a headline, a packaging label or a sign, designers often pick a different typeface that merely looks similar, and the identity gets diluted. A small custom font built from the logo letters solves that: anyone on the team can type in the brand voice.

There is also a privacy angle. Logo work is often confidential before launch. fontsketch runs entirely in the browser, so unreleased lettering never leaves your machine.

## Step 1: get the logo letters into glyphs

The cleanest source is the original vector file. Export each letter as a separate SVG, convert strokes to outlines and flatten transforms, then import into the matching character. The [make a font from SVG guide](guide:make-a-font-from-svg) lists the preparation steps.

If you only have a raster logo, trace it from the largest, sharpest version you can find. A logo exported at small web size will trace poorly. Follow the tips in [convert an image to a font](guide:convert-image-to-font) for contrast and resolution.

Set all imported letters on a common baseline at the same scale. Logos are often kerned tightly or even overlapped, so check that each glyph is complete when isolated.

## Step 2: extract the design rules

Before drawing anything new, measure what the logo letters already tell you. Make a short list:

- **Stem width** of vertical strokes, and of horizontal strokes
- **Contrast**, the ratio between thick and thin parts
- **Stress angle**, the axis along which round strokes are thickest
- **Terminals**, how strokes end: flat, rounded, angled, flared, ball
- **Proportions**: are letters wide or condensed?
- **x-height and cap height** in the 1000 unit em
- **Special details**: an ink trap, a notch, a swash, a distinctive curve

These rules are your design system for every new glyph. When unsure how to draw a letter, check it against the list.

## Step 3: extend the alphabet

Build from what exists. If the logo contains an n and an o, you can derive h, m, u, b, d, p and q from their parts. If it contains an H and an O, you have the core of E, F, L, T, C, G and Q. Reuse outlines whenever possible rather than redrawing by eye.

Some letters will not exist in any form, often a, g, s, k and the figures. Draw them last, when the rules are clear. Test each new glyph between letters from the original logo: *HaH*, *nan*, *OgO*. If it looks like an outsider, compare it against the rule list and adjust.

Remember accented letters if the brand works in other languages. Draw the marks in the same style, with the same terminals, and fontsketch composes letters like é, ã and ç automatically.

## Step 4: spacing for text, not for the logo

Logo letters are often spaced very tightly for visual impact. Copying that spacing into the font usually makes typed text cramped. Space the font for **running headlines**:

1. Set *nnnn* and *HHHH* so they feel even and open.
2. Fit round letters with *nonono* and *HOHOHO*.
3. Kern problem pairs: To, Ty, AV, LT, quote marks and periods after letters.

Kerning classes save time: group round left sides (C, G, O, Q) and kern them against T, V, W and Y in one move. The [font kerning guide](guide:font-kerning-guide) explains how.

Then compare: type the brand name in the new font. It will not match the logo exactly, and it should not. The logo is optically adjusted artwork; the font is a system.

## Step 5: export for every use

| Who uses it | Format |
| --- | --- |
| Designers in desktop apps | OTF or TTF |
| Website and web apps | WOFF2 plus the CSS @font-face snippet |
| Slides and office documents | TTF installed on each machine |

For the website, follow [use a custom font on your website](guide:use-a-custom-font-on-your-website). Display brand fonts are used large, so hinting is optional. If the font will also appear in small interface text, test automatic hinting.

## Licensing basics for logo fonts

This is not legal advice, but a few principles help you ask the right questions.

### If you start from someone else's font

Fonts are software with licenses. Using a font in a logo is permitted by many licenses, but modifying the font file and redistributing it is a different matter. The SIL Open Font License (OFL) allows modification and redistribution as long as you keep the license and rename the font if it uses a reserved name. Many commercial licenses forbid modification entirely. Read the license before building a brand font on top of another font.

### If you drew the lettering

If you drew the letters yourself, or a designer drew them and transferred the rights to you in writing, you control the font made from them. When commissioning lettering, ask for a written agreement that covers both the logo artwork and any font derived from it.

### Decide how the brand font may be shared

Write down the rules: who may install it, whether agencies and freelancers may receive it, whether it can be embedded in apps or PDFs, and whether it may ever be released publicly. A short internal license avoids confusion later.

## Logo font checklist

- Logo letters imported as clean outlines on one baseline
- Design rules written down: stems, contrast, terminals, proportions
- Missing letters built from existing parts
- Marks drawn in the same style for accented letters
- Spacing set for headlines, not copied from the logo
- Kerning classes for round and diagonal letters
- License and sharing rules documented

## Next steps

Import your logo letters into the [fontsketch editor](app:) and write the rule list before drawing a single new glyph. When the alphabet is complete, polish it with the [font kerning guide](guide:font-kerning-guide) and ship it with the web font steps.
