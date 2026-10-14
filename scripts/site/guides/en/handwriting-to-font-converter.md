---
slug: handwriting-to-font-converter
lang: en
title: Handwriting to Font Converter, Scan With Your Phone
description: A handwriting to font converter that works from a phone photo. Learn which pens, paper and lighting give clean traces, then export your font as TTF or WOFF2.
h1: Handwriting to font converter, how to get a clean scan from a phone photo
keyword: handwriting to font
art: nib-strokes
alt: Close view of felt tip, gel and ballpoint pen strokes side by side, showing how line quality affects the traced outline
time: PT30M
howto: How to convert handwriting to a font from a phone photo
steps:
  - name: Choose the right pen
    text: Use a black felt tip or gel pen between 0.5 and 0.8 mm. Avoid ballpoint and pencil, which produce faint and uneven lines.
  - name: Print the template correctly
    text: Print the fontsketch handwriting sheet on plain white A4 or Letter paper at 100 percent scale.
  - name: Write with consistent size
    text: Keep letters inside each cell, away from the borders, with the same x-height and baseline in every cell.
  - name: Set up the light
    text: Place the sheet near a window in indirect daylight, or under two lamps from opposite sides, so no shadow crosses the page.
  - name: Take the photo
    text: Hold the phone parallel to the page, include all four corner markers, fill the frame and tap to focus before shooting.
  - name: Convert and review
    text: Load the photo in fontsketch, then review glyphs with low confidence scores and fix or redraw them before exporting.
faq:
  - q: What is the best pen for a handwriting font?
    a: A black felt tip or fineliner between 0.5 and 0.8 mm gives the cleanest result because the line is dark and even. Gel pens also work well. Ballpoints leave thin, broken lines that trace poorly.
  - q: Can I use lined or colored paper for a handwriting font?
    a: Use the printed template on plain white paper. Lines, grid patterns or colored paper add marks and reduce contrast, which makes the binarization step less reliable.
  - q: Why are some of my letters traced with holes or gaps?
    a: Gaps usually come from faint ink, a pen that skipped, or uneven lighting. Retrace the stroke with steady pressure on a new sheet, or fix the outline directly in the editor.
  - q: Does the handwriting converter work with a tablet and stylus instead of paper?
    a: The scanning route is built for paper. If you write on a tablet, export each letter as SVG or PNG and import those files, or draw directly in fontsketch with the brush tool.
  - q: How high resolution should the photo be?
    a: Any recent phone camera is enough as long as the page fills most of the frame. The more pixels each letter covers, the smoother the traced curves will be.
related: [turn-your-handwriting-into-a-font, convert-image-to-font, how-to-make-a-font, font-kerning-guide]
---
A handwriting to font converter turns letters you write on paper into a digital font file. With fontsketch you print a template, fill it with a dark pen, and take a phone photo. The app finds the corner markers, corrects perspective and lighting, then traces every letter into vector outlines you can export as TTF, OTF or WOFF2.

This guide focuses on the part that makes or breaks the result: the physical sheet and the photo. If you want the complete process from start to finish, read [turn your handwriting into a font](guide:turn-your-handwriting-into-a-font).

## How the converter reads your sheet

Knowing what happens to your photo helps you avoid problems. When you load it into fontsketch, everything runs locally in the browser:

1. **Marker detection.** The four corner markers tell the converter exactly where the page is.
2. **Perspective correction.** The page is mathematically flattened, so a slight tilt is fine.
3. **Lighting correction.** Gradual light differences across the page are evened out.
4. **Binarization.** Each pixel becomes ink or paper.
5. **Cell splitting.** The grid is divided and each cell is matched to its character.
6. **Tracing.** Each letter becomes vector outlines, with a confidence score.

Steps 3 and 4 are where poor input hurts. Lighting correction can flatten a soft gradient, but a hard shadow or a glare spot can make ink disappear or turn paper into fake ink. Faint pen lines might fall on the wrong side of the threshold. Everything below is about giving those steps clean data.

## Choosing a pen

The pen affects line weight, edge quality and contrast.

| Pen type | Result | Recommendation |
| --- | --- | --- |
| Felt tip fineliner, 0.5 to 0.8 mm | Dark, even line, crisp edges | Best choice |
| Gel pen | Dark line, can be glossy | Very good, avoid glare |
| Brush pen | Thick and thin contrast | Great for script, write larger |
| Marker, chisel tip | Bold, calligraphic | Good for display fonts |
| Ballpoint | Thin, faint, skips | Avoid |
| Pencil | Low contrast, shiny | Avoid |

Thicker lines trace more reliably than thin ones. If your handwriting looks too heavy at 0.8 mm, that is often fine: a font made from a slightly bold pen is easier to read on screen than one made from a hairline.

Stick to **black ink**. Blue ink has less contrast after binarization, and colored inks may vanish entirely.

## Paper and printing

Print the template on plain, matte white paper. Glossy or coated paper reflects light and creates glare. Avoid recycled paper with visible flecks, which can be traced as specks.

Print at 100 percent scale. Check the printer is not in toner saving mode, because the corner markers should be solid black.

## Writing tips that improve the font

The converter traces exactly what you write, so a few habits make a big difference:

- **Warm up first.** Write a few lines on scrap paper so your hand settles into its normal rhythm.
- **Write the way you write words.** Letters written in isolation tend to look stiff. Imagine each letter sitting inside a word.
- **Respect the cell borders.** Leave a small margin on all sides. A stroke touching the border can merge with the grid and fail to trace.
- **Keep size consistent.** Pick a baseline and an x-height in your head and use them in every cell.
- **One clean pass per stroke.** Retouching thickens lines unevenly.
- **Give descenders room.** g, j, p, q and y need space below the baseline inside the cell.

If you plan to make a connected script, make each entry and exit stroke leave the letter at the same height. You will fine tune the joins with side bearings later.

## Fill the sheet with a plan

Before writing, think about which characters you will actually type with this font. Uppercase, lowercase and digits are obvious, but punctuation is where handwriting fonts often fall short. A missing apostrophe or question mark forces the computer to substitute a fallback font, which looks jarring in the middle of your handwriting.

A few practical points:

- **Print a spare sheet.** If one letter goes wrong, rewrite it on the spare and photograph that cell set separately rather than starting over.
- **Write marks carefully.** The acute, tilde, cedilla and other marks are reused for every accented letter that fontsketch composes, so one clean tilde becomes ã, õ and ñ.
- **Mind the small characters.** Period, comma and apostrophe are tiny. Write them at their natural size relative to your letters, not enlarged, so they sit correctly in text.
- **Do a test run.** Fill one row, photograph it and load it. If the trace is clean, fill the rest with the same pen and setup.

## Lighting: the most common problem

Most bad scans come from lighting, not handwriting.

- **Use indirect daylight.** A spot near a window, out of direct sun, is ideal.
- **Avoid overhead lamps directly above you.** Your head and phone will cast a shadow on the page.
- **At night, use two light sources** at roughly 45 degrees from opposite sides. This cancels shadows.
- **Turn off the flash.** It creates a bright hotspot in the middle and dark corners.
- **Watch for glare** on gel ink. Tilt the light source, not the phone.

## Taking the photo

- Lay the page completely flat. Weigh down curled corners.
- Hold the phone parallel to the paper, directly above the center.
- Make sure **all four corner markers** are in the frame with a little margin.
- Fill as much of the frame as possible with the page.
- Tap the screen to focus on the letters and hold still.
- Use the normal photo mode. Avoid filters, portrait mode or document modes that apply heavy sharpening.

A flatbed scanner at 300 dpi in grayscale is an excellent alternative if you have one.

## Reviewing the result

Once traced, each glyph shows a confidence score. Work through the lowest scores first. Common fixes:

- **Specks**: delete tiny stray contours.
- **Broken strokes**: bridge small gaps by editing points, or redraw the stroke with the brush.
- **Lumpy curves**: run simplify with curve fitting.
- **Crossed strokes**: run overlap removal so letters like t and x become one shape.

Then move on to spacing and kerning, which are covered in the [font kerning guide](guide:font-kerning-guide). If some characters are missing from the sheet, you can draw them directly or import them, as explained in [convert an image to a font](guide:convert-image-to-font).

## Converter checklist

- Black felt tip or gel pen, 0.5 to 0.8 mm
- Plain matte white paper, template printed at 100 percent
- Letters inside cells with consistent size
- Even, indirect light, no flash, no shadow
- All four markers visible, page filling the frame
- Low confidence glyphs reviewed before export

## Next steps

Print a sheet from the [fontsketch editor](app:) and try a test photo with just a few letters to check your pen and lighting before filling the whole page. When the trace looks clean, follow [how to make a font](guide:how-to-make-a-font) to finish metrics, spacing and export.
