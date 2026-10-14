---
slug: how-to-make-a-font
lang: en
pair: como-criar-uma-fonte
title: How to Make a Font, a Complete Beginner Guide
description: How to make a font from scratch, step by step. Plan the character set, set metrics, draw consistent glyphs, space and kern, then export TTF, OTF or WOFF2.
h1: How to make a font, from first letter to finished file
keyword: how to make a font
art: metrics-ruler
alt: The letters H, n, o and p on a ruler showing baseline, x-height, cap height, ascender and descender lines
time: PT3H
howto: How to make a font from scratch with fontsketch
steps:
  - name: Define the purpose and character set
    text: Decide what the font is for and list every character it needs, including punctuation, digits and accented letters.
  - name: Set the metrics
    text: In the 1000 unit em, choose x-height, cap height, ascender and descender values that suit the style.
  - name: Draw the control letters
    text: Draw n, o, H and O first to fix stem thickness, curves, overshoot and proportions.
  - name: Build the rest of the alphabet
    text: Derive related letters from the control letters, reusing stems, bowls and serifs for consistency.
  - name: Space and kern
    text: Set side bearings with test strings like nnonnoon, then add kerning pairs and classes for problem combinations.
  - name: Test in real text
    text: Export, install and set paragraphs at several sizes, then fix what looks wrong and repeat.
  - name: Export the final files
    text: Export TTF or OTF for desktop and WOFF2 with CSS for the web, with suitable hinting.
faq:
  - q: How long does it take to make a font?
    a: A handwriting font can be ready in under an hour. A carefully drawn display font for basic Latin usually takes a few days, and a text family with several weights can take months.
  - q: Do I need to know how to draw to make a font?
    a: Not much. You can scan your handwriting, trace existing lettering you own, or build geometric letters from simple shapes with the pen tool. What matters most is consistency and spacing, which you learn by testing.
  - q: Which letters should I draw first when making a font?
    a: Start with n and o for lowercase and H and O for capitals. They establish stem width, curve weight, overshoot and spacing, and most other letters are built from those parts.
  - q: How many characters does a font need?
    a: For basic English, about 95 printable ASCII characters. For western European languages, add accented letters, which fontsketch builds automatically from base letters and marks.
  - q: Can I make a font without paying for software?
    a: Yes. fontsketch is free and open source and covers drawing, importing, spacing, kerning, hinting and export to TTF, OTF, WOFF and WOFF2.
related: [create-a-font-online-free, font-kerning-guide, turn-your-handwriting-into-a-font, web-font-formats-ttf-otf-woff2]
---
To make a font, decide what it is for, list the characters you need, set metrics such as x-height and cap height, draw a few control letters, build the rest from them, then space, kern, test and export. You can do all of this for free in fontsketch, a browser font editor that exports TTF, OTF, WOFF and WOFF2.

This guide is the full beginner path. Each section links to a deeper guide when you want more detail.

## Step 1: decide what the font is for

Purpose drives every later decision. A font for long paragraphs needs open shapes, a generous x-height and calm spacing. A display font for posters can be quirky and tightly spaced. A handwriting font should feel natural. An icon font follows entirely different rules.

Write one sentence describing the use, for example: *a friendly rounded sans for headings on my bakery website*. Keep it visible while you work.

## Step 2: plan the character set

List the characters before drawing so you never discover a missing apostrophe after launch.

| Group | Characters |
| --- | --- |
| Uppercase | A to Z |
| Lowercase | a to z |
| Figures | 0 to 9 |
| Punctuation | . , : ; ' " ? ! ( ) hyphen and slash |
| Symbols | @ & % # and your currency sign |
| Accented | built from base letters plus marks |

fontsketch composes accented letters from components, so for á, ç, ñ, ö and the rest you only draw the marks: acute, grave, circumflex, tilde, diaeresis, cedilla, ring, caron and so on. Coverage spans Latin-1 Supplement and Latin Extended-A, which handles most European languages that use the Latin script.

## Step 3: set the metrics

fontsketch uses **1000 units per em**. Within that space you define:

- **Baseline** at 0, where letters sit
- **x-height**, the height of lowercase letters without ascenders, usually 450 to 550
- **Cap height**, usually 650 to 720
- **Ascender**, the top of b, d, h, k and l, often slightly above cap height
- **Descender**, the bottom of g, j, p, q and y, often around negative 200

A larger x-height makes text easier to read at small sizes. A smaller one feels more classical. Ascender and descender together also influence default line spacing in many apps, so avoid extreme values.

## Step 4: draw the control letters

Type designers start with a few letters that contain the DNA of the whole font:

- **n**: stem thickness, the arch, the shoulder join
- **o**: curve thickness, overshoot, the shape of round letters
- **H**: capital stem and crossbar
- **O**: capital round shape

Get these right before going further. Some principles:

- **Stems**: vertical strokes should share one thickness across lowercase, and capitals are usually slightly heavier.
- **Optical correction**: horizontal strokes look heavier than vertical strokes of the same thickness, so crossbars are drawn a little thinner.
- **Overshoot**: round and pointed letters extend 10 to 15 units past the baseline and x-height, otherwise they look too small.
- **Counters**: the inner spaces should feel balanced across letters, since readers perceive the white as much as the black.

You can draw with the bezier pen tool, import SVG, trace images or scan handwriting. Mixing methods is fine. See [create a font online free](guide:create-a-font-online-free) for an overview of each route.

## Step 5: build the rest from parts

Most letters share parts with the control letters:

- From **n**: h, m, u (rotated), r
- From **o**: c, e, b, d, p, q
- From **H**: E, F, I, L, T
- From **O**: C, G, Q

Copy and adapt rather than redrawing from scratch. Consistency is what makes a typeface look intentional. Draw capitals and figures with the same stroke logic, and keep figures at a height close to cap height unless you want old style figures.

## Step 6: clean the outlines

Before spacing, tidy every glyph:

- **Overlap removal**, so crossing strokes become a single contour
- **Contour direction correction**, so counters stay hollow
- **Simplify** traced or messy outlines so curves are smooth and point counts low
- Points at curve extremes, with horizontal or vertical handles

## Step 7: spacing comes before kerning

Spacing is the distance built into each glyph through its **side bearings**. Kerning is a correction for specific pairs. Always space first.

A classic method:

1. Set the side bearings of **n** so *nnnnn* looks even.
2. Set **o** so *nonono* looks even. Round sides need less space than straight sides.
3. Space other lowercase letters between n and o, for example *nanbncndn*.
4. Repeat with **H** and **O** for capitals: *HHOHHOOH*.

Then add kerning pairs for combinations spacing cannot fix: AV, To, Ty, Yo, LT, P followed by a period, quotes next to letters. Classes let you kern groups at once, such as all round lowercase letters after T. The [font kerning guide](guide:font-kerning-guide) explains this in depth.

## Step 8: test in real text

Looking at an alphabet tells you little. Test in context:

- Export, install and set paragraphs in a word processor at 12, 16 and 24 points.
- Use pangrams and real sentences in the languages you support.
- Print a page. Problems that hide on screen show up on paper.
- Look at the text from a distance or squint: dark spots mean spacing is too tight or strokes too heavy.

Fix, re-export, repeat. Every font goes through several rounds of this.

## Step 9: export

| Use | Format |
| --- | --- |
| Install on desktop | TTF or OTF (CFF) |
| Websites | WOFF2 plus the CSS @font-face snippet |
| Legacy fallback | WOFF |

Choose automatic TrueType hinting for fonts that will be read at small sizes on Windows, manual stem hints if you want control, or none for large display use. The [web font formats guide](guide:web-font-formats-ttf-otf-woff2) explains which file to use where.

## Common beginner mistakes

- **Drawing every letter in isolation.** Letters that look perfect alone often clash in words. Test combinations early, not at the end.
- **Inconsistent stems.** A stem that is 85 units in n and 95 units in h makes text look blotchy. Measure and reuse.
- **No overshoot.** Without it, o and s look shrunken next to n and x.
- **Too many points.** Extra nodes create wobbly curves and make later edits painful.
- **Tight spacing.** Display spacing looks stylish in a single word but suffocates paragraphs. Space for the intended size.
- **Forgetting punctuation and figures.** These appear in almost every sentence.
- **Skipping backups.** Save a `.fontsketch.json` project file at milestones so you can return to an earlier state.

## Beginner checklist

- Purpose written down
- Character set listed, including punctuation and marks
- Metrics chosen and respected
- Control letters n, o, H, O approved first
- Overlaps removed, directions corrected, outlines simplified
- Spacing tested before kerning
- Tested in real paragraphs, on screen and on paper
- Project file saved

## Next steps

Open the [fontsketch editor](app:), set your metrics and draw n, o, H and O today. If drawing from scratch feels like too much, start with [your own handwriting](guide:turn-your-handwriting-into-a-font) and learn spacing and kerning on letters you already have.
