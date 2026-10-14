---
slug: font-hinting-explained
lang: en
title: Font Hinting Explained, TrueType Hinting for Sharp Text
description: Font hinting explained simply. See how TrueType hinting snaps stems to the pixel grid at 9 to 16 px, when it matters, and how to pick auto, manual or none.
h1: Font hinting explained, and when TrueType hinting matters
keyword: font hinting explained
art: hinting-grid
alt: The letter n rasterized on a coarse pixel grid, unhinted with blurry stems beside a hinted version with stems snapped to full pixels
time: PT25M
howto: How to choose and test hinting for your font in fontsketch
steps:
  - name: Decide where the font will be read
    text: List the sizes and platforms. Small UI or body text on Windows benefits most from hinting, large display text barely at all.
  - name: Draw hint friendly outlines
    text: Keep stem widths consistent, place points at curve extremes and align heights to shared zones such as x-height and baseline.
  - name: Pick a hinting mode at export
    text: Choose automatic TrueType hinting, manual stem hints for key glyphs, or no hinting for display and icon fonts at large sizes.
  - name: Test at small pixel sizes
    text: Render a paragraph at 9 to 16 px on Windows and on a standard density monitor and compare against an unhinted build.
  - name: Weigh file size against clarity
    text: If hinting adds weight without visible benefit on your target screens, export without it.
faq:
  - q: What does font hinting do?
    a: Hinting adds instructions that adjust a glyph outline to the pixel grid before it is rasterized at small sizes. Stems land on whole pixels and heights line up, so text looks sharper and more even.
  - q: Does hinting matter on Mac or high DPI screens?
    a: Much less. macOS largely ignores TrueType hinting instructions, and on high density displays there are enough pixels that outlines render well without help. Hinting matters most on Windows at standard densities.
  - q: Does hinting make a font file bigger?
    a: Yes. TrueType instructions add data to every hinted glyph, often a noticeable share of the file. For icon fonts or display fonts used large, skipping hinting saves bytes.
  - q: What is the difference between autohinting and manual hinting?
    a: Autohinting detects stems and alignment heights and generates instructions for the whole font. Manual hinting lets you mark specific stems yourself, which can fix glyphs the automatic pass misreads.
  - q: Should I hint a variable font?
    a: Test it. Variable fonts are often used on high resolution screens where hinting matters less, but small interface text on Windows can still benefit. Compare hinted and unhinted builds at 12 to 16 px.
related: [web-font-formats-ttf-otf-woff2, how-to-make-a-font, variable-font-tutorial, icon-font-generator]
---
Font hinting is a set of instructions inside a font that fits glyph outlines to the pixel grid at small sizes. At 9 to 16 px a stem might fall between two pixels and turn into a gray smear; hinting snaps it to whole pixels so text looks crisp. It matters most on Windows at standard screen densities.

## The problem hinting solves

Fonts are drawn as precise vector outlines in a coordinate space, 1000 units per em in fontsketch. A screen is a grid of square pixels. Rendering text means deciding, for each pixel, how much of it the outline covers.

At large sizes this is easy: a letter 200 pixels tall has plenty of pixels to describe every curve. At small sizes there are very few. Consider a lowercase n at 12 px. With an x-height of 500 units, the x-height is just 6 pixels. A stem 80 units wide is under 1 pixel. If that stem starts at x = 3.4 pixels, it covers parts of two pixels and the rasterizer paints both in light gray. The result:

- Stems look blurry and lighter than intended
- The two stems of n render differently because they sit at different subpixel positions
- x-height wobbles: one letter rounds up to 6 pixels, another down to 5
- Round letters with overshoot look taller than flat letters by a whole pixel

Hinting addresses each of these by moving outline points slightly before rasterization, only at the sizes where it helps.

## What hinting instructions actually do

TrueType hinting is a small program stored in the font. Key ideas:

- **Stem snapping.** Stem edges are moved so the stem covers a whole number of pixels, at least one.
- **Consistent stem widths.** Stems of similar width in different letters are rounded to the same pixel count, so the n and the m look like they belong together.
- **Alignment zones.** Baseline, x-height and cap height are rounded to whole pixels, and overshoots are suppressed at small sizes so round and flat letters share one height.
- **Size awareness.** At larger sizes the instructions relax or stop, letting the natural outline show.

Fonts with CFF outlines, the OTF flavor, use a different model: they store stem hints and alignment zones as declarations, and the rasterizer decides how to apply them. The goals are the same.

## Where hinting matters, and where it does not

| Situation | Hinting impact |
| --- | --- |
| Windows, standard density monitor, 9 to 16 px text | High |
| Windows, high density laptop screen | Low to moderate |
| macOS at any size | Very low, instructions are largely ignored |
| Mobile devices with dense screens | Low |
| Display text above about 24 px | Very low |
| Print | None, printers have plenty of resolution |

So the question is not "should fonts be hinted" but "will this font be read small on lower density screens". A text face for a web app used in offices: yes. A handwriting font for wedding invitations: probably not.

## Hinting options in fontsketch

fontsketch gives you three choices at export:

1. **Automatic TrueType hinting.** fontsketch detects stems and snaps them to the pixel grid at small sizes, along with the main alignment heights. This is the right default for text fonts.
2. **Manual stem hints.** You mark the stems that matter on specific glyphs. Useful when the automatic pass misreads an unusual design, such as a high contrast or reverse contrast letter.
3. **No hinting.** Smallest files and the natural outline everywhere. Ideal for icon fonts, display fonts and anything used large.

In the Node API, the same choice is the `hinting` option of `exportFont`.

## Draw outlines that hint well

Automatic hinting can only be as good as the outlines it analyzes. These habits help a lot, and they are good drawing practice anyway:

- **Consistent stems.** If your lowercase stems are 84, 86 and 88 units wide, decide on one value. The hinter groups similar stems, and clean data makes better groups.
- **Points at extremes.** Put on curve points at the top, bottom, left and right of every bowl, with horizontal or vertical handles. Hinters find edges by looking for these points.
- **Shared heights.** Flat tops of lowercase letters should sit exactly on the x-height, flat capitals exactly on cap height. Overshoots should be consistent, around 10 to 15 units.
- **No tiny wobbles.** Traced shapes often have near vertical edges made of many short segments. Simplify them so a straight stem is really straight.
- **Remove overlaps.** Overlapping contours confuse stem detection.

If your outlines come from tracing, run simplify and check extremes on the most frequent letters first. The [how to make a font](guide:how-to-make-a-font) guide covers this cleanup in more detail.

## How to test hinting

1. Export two builds: one with automatic hinting, one without.
2. Load both on a test page with the same paragraph at 11, 12, 13, 14 and 16 px.
3. View it on Windows on a standard density monitor if you can, since that is where differences show.
4. Take screenshots and zoom in. Look at stem consistency, x-height consistency and whether bowls close up.
5. Check the file sizes of the WOFF2 builds.

If the hinted build is clearly sharper, keep it. If you cannot see a difference on your target devices, choose the smaller file. For icon fonts, see the [icon font generator guide](guide:icon-font-generator); icons are usually displayed at fixed sizes that you can design for directly.

## Hinting and file size

Hinting instructions add bytes to each glyph. On a font with a few hundred glyphs the difference can be significant relative to the outlines. WOFF2 compresses instructions well, but they never come free. For web performance, the bigger wins are usually subsetting to the characters you need and serving WOFF2; the [web font formats guide](guide:web-font-formats-ttf-otf-woff2) explains both.

## Hinting checklist

- Target sizes and platforms identified
- Stems consistent, extremes placed, overlaps removed
- Heights aligned to baseline, x-height and cap height
- Hinted and unhinted builds compared at 11 to 16 px
- File size checked for the web build
- Icons and display fonts exported without hinting unless tests show a benefit

## Next steps

Export a hinted and an unhinted build from the [fontsketch editor](app:) and compare them side by side at small sizes. If your font has several weights in one file, read the [variable font tutorial](guide:variable-font-tutorial) before testing so you check every weight.
