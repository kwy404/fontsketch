---
slug: convert-image-to-font
lang: en
title: Convert an Image to a Font, PNG and JPG to Vector Glyphs
description: Convert an image to a font by tracing PNG or JPG lettering into vector glyphs. Tips for resolution, contrast and cleanup, then export TTF, OTF or WOFF2 free.
h1: How to convert an image to a font (PNG and JPG to font)
keyword: convert image to font
art: glyph-anatomy
alt: A pixelated PNG letter g beside its smooth traced vector outline with labeled bowl, ear and loop
time: PT35M
howto: How to convert PNG or JPG images into a font with fontsketch
steps:
  - name: Prepare a high contrast image
    text: Crop each letter or word, convert it to black on white and make sure the letter is at least several hundred pixels tall.
  - name: Import the image into a glyph
    text: Open fontsketch, select the character and import the PNG or JPG. It is traced into vector outlines automatically.
  - name: Inspect the trace
    text: Zoom in on curves and corners, delete stray specks and check that counters are open.
  - name: Simplify and fix the outlines
    text: Run simplify with curve fitting, remove overlaps and correct contour direction, then fix corners by hand with the pen tool.
  - name: Align to metrics and space
    text: Set the glyph on the baseline, match x-height or cap height, and adjust side bearings.
  - name: Export the font
    text: Export TTF, OTF, WOFF or WOFF2 and test it in real words at several sizes.
faq:
  - q: Can I turn a picture of letters into a font?
    a: Yes, as long as each character can be isolated in its own image or crop. fontsketch traces PNG and JPG files into vector outlines that become editable glyphs, then exports a standard font file.
  - q: What resolution do I need to convert a PNG to a font?
    a: Aim for each letter to be at least 500 pixels tall, and more for detailed lettering. Small images produce blocky, wobbly outlines that need a lot of cleanup.
  - q: Can I convert a logo image into a font?
    a: You can trace the letters of a logo and build them into a font, but only if you own the lettering or have permission. If you only need the logo itself, a vector file of the logo is usually more useful than a font.
  - q: Why does my traced letter look bumpy?
    a: Bumps come from low resolution, JPG compression artifacts or soft edges. Start from a larger, sharper image, then run simplify and curve fitting to smooth the outline.
  - q: Can I identify a font from an image with this tool?
    a: No. fontsketch traces shapes you provide to create your own font. It does not recognize or match existing typefaces from pictures.
related: [make-a-font-from-svg, make-a-font-for-a-logo, handwriting-to-font-converter, how-to-make-a-font]
---
To convert an image to a font, isolate each letter as a high contrast PNG or JPG, trace it into vector outlines, clean up the curves, align it to the font metrics and export. fontsketch does the tracing in your browser: import an image into a glyph, review the outline, then export TTF, OTF, WOFF or WOFF2 with no upload.

## When tracing an image makes sense

Image tracing is the right route when your letters exist only as pixels:

- Brush or ink lettering you photographed or scanned
- Hand painted signs or chalk lettering
- Lettering drawn in a raster painting app
- Old printed material where you own the rights to the artwork
- Your own logo lettering when the original vector file is lost

If you already have vectors, use them directly with the [SVG to font guide](guide:make-a-font-from-svg), which preserves the exact curves. If you are starting from handwriting on paper, the [handwriting sheet workflow](guide:handwriting-to-font-converter) is faster because it splits and maps all the letters for you.

## How tracing works

A raster image is a grid of pixels. A font glyph is a set of curves. Tracing finds the edge between ink and background and fits lines and bezier curves along it. Two things limit quality:

1. **Edge information.** If a letter is 40 pixels tall, its curves are described by a few dozen edge pixels, so the trace has to guess. At 800 pixels tall, the curve is well defined.
2. **Noise.** Compression artifacts, paper texture and soft shadows add fake edges that the tracer dutifully follows.

Everything in the preparation stage aims to give the tracer more edge information and less noise.

## Prepare the image

### Resolution

Aim for a letter height of **at least 500 pixels**, and closer to 1000 for detailed brush lettering. If you are scanning, 600 dpi for small artwork is reasonable. Upscaling a small image does not add real detail, so start large.

### Contrast

The tracer works best with dark ink on a light background. In any image editor:

- Convert to grayscale.
- Increase contrast with levels or curves until the background is pure white and the ink is nearly black.
- Remove paper texture and smudges with a white brush.

Do not push contrast so far that thin hairlines disappear. Check thin parts of letters like the crossbar of an e or the tail of a script letter.

### Format

PNG is preferable because it is lossless. JPG works, but save it at high quality: heavy JPG compression creates blocky ringing around edges, which becomes bumps in the outline.

### Cropping

Crop each character into its own image, with some margin. If you have a whole word, split it into letters first. Keep the crops at the same scale: do not resize letters individually, or their heights will no longer match.

## Trace the image in fontsketch

Open the [fontsketch editor](app:), pick the character you want to create and import the PNG or JPG. The image is traced into vector outlines that you can edit like any drawn glyph.

Now inspect the result at high zoom:

- **Specks**: small isolated contours from dust or noise. Delete them.
- **Closed counters**: the hole in a, e, o or g should be open. If a counter filled in, the ink probably bled in the image. Fix it in the editor or improve the image.
- **Rounded corners**: tracing tends to soften sharp corners slightly. Convert those points to corner points with the pen tool.
- **Lumpy curves**: too many points along a curve.

## Clean up the outline

Traced outlines nearly always have more points than a designer would draw. Run **simplify** with curve fitting to reduce points while keeping the shape. Fewer, well placed points give smoother curves, smaller files and more predictable hinting.

Good outline anatomy, as type designers draw it:

- Points at the **extremes** of each curve (top, bottom, leftmost, rightmost)
- Handles **horizontal or vertical** at those extremes
- Corner points only where the shape actually has a corner
- No tiny segments between two nearly identical points

You do not need to reach perfection on every glyph, but simplifying and checking extremes on the most common letters (e, a, o, n, s, t) pays off.

Finish with **overlap removal** if strokes cross, and **contour direction correction** so counters render properly.

## Align, space and complete the font

Place each glyph on the baseline and check it against x-height and cap height in the 1000 unit em. Then set side bearings so letters space evenly in words. Draw or trace the marks once and fontsketch builds accented letters from components.

When a few pairs still look uneven, add kerning. If you are building lettering for a brand, also read [make a font for a logo](guide:make-a-font-for-a-logo), which covers consistency and licensing.

## Tracing different kinds of lettering

Not every image behaves the same way under a tracer. A few patterns come up again and again.

### Brush and pointed pen script

Script lettering has extreme contrast between thick downstrokes and thin upstrokes. The hairlines are the weak point: if the image is small or the contrast too aggressive, they break apart. Scan or photograph larger than you think you need, and when cleaning up, check every hairline for gaps. If the letters connect, plan the joins: each letter should leave and enter at the same height so they meet when typed side by side.

### Painted signs and chalk lettering

Texture is the enemy here. Brush texture, wall grain and chalk dust all become tiny bumps along the edge. Smooth the image with a light blur before raising contrast, or accept that you will redraw the outline over the trace using the pen tool. Tracing as a guide and redrawing on top is a perfectly valid professional technique.

### Geometric or stencil lettering

Clean geometric letters trace well, but tracing still rounds corners and adds slight wobble to straight lines. For this style it is often faster to redraw with the bezier pen using the traced outline as a reference, keeping straight segments perfectly horizontal or vertical.

### Distressed or textured styles

If the texture is part of the look, keep it, but expect large files and many points per glyph. Simplify carefully so the texture survives while redundant points go away, and test the exported file size if the font is meant for the web.

## Image to font checklist

- Letters at least 500 pixels tall, ideally more
- High contrast, grayscale, clean background
- PNG or high quality JPG
- One character per crop, all at the same scale
- After tracing: specks removed, counters open, corners sharp
- Simplified outlines with points at extremes
- Spacing and kerning tested in real words

## Next steps

Try a single letter first in the [fontsketch editor](app:) to find the image size and contrast that trace cleanly, then process the rest with the same settings. For the complete design process, see [how to make a font](guide:how-to-make-a-font).
