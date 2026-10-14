---
slug: turn-your-handwriting-into-a-font
lang: en
pair: criar-fonte-com-minha-letra
title: Turn Your Handwriting Into a Font, Free in Your Browser
description: Turn your handwriting into a font for free. Print a sheet, snap a phone photo and export TTF, OTF or WOFF2 in your browser, with no upload and no account.
h1: How to turn your handwriting into a font (free, in your browser)
keyword: turn your handwriting into a font
art: scan-to-font
alt: A filled handwriting template with corner markers being photographed by a phone and turning into vector letters on screen
time: PT30M
howto: How to turn your handwriting into a font with fontsketch
steps:
  - name: Print the handwriting sheet
    text: Open fontsketch, choose the handwriting sheet and print the PDF template on A4 or Letter paper at 100 percent scale, without fit to page.
  - name: Fill every cell with a dark pen
    text: Write one character per cell with a black felt tip or gel pen, keeping each letter inside its box and resting on the same imagined baseline.
  - name: Photograph or scan the sheet
    text: Take a phone photo in even daylight with all four corner markers visible, or scan the page at 300 dpi.
  - name: Load the image and review the trace
    text: Drop the photo into fontsketch. It finds the markers, corrects perspective and lighting, splits the cells and traces each letter, showing a confidence score per glyph.
  - name: Fix low confidence glyphs
    text: Open the glyphs with the lowest scores, clean stray marks, simplify the outlines and redraw any letter that did not trace well.
  - name: Set spacing and kerning
    text: Adjust side bearings so words look evenly spaced, then add kerning pairs for awkward combinations such as To, Ty and AV.
  - name: Export and install your font
    text: Export TTF or OTF to install on your computer, or WOFF2 with the CSS snippet for a website.
faq:
  - q: Is it really free to make a font from my handwriting?
    a: Yes. fontsketch is free and open source under the MIT license, with no paid tier and no watermark. The font you export is yours to use and share under whatever license you choose.
  - q: Do I need a scanner to turn my handwriting into a font?
    a: No. A phone photo works because fontsketch detects the four corner markers, corrects the perspective and evens out the lighting before it traces. A flatbed scan gives slightly cleaner edges, but it is optional.
  - q: Are my handwriting photos uploaded to a server?
    a: No. All processing runs inside your browser, so the photo and the font never leave your device. Projects autosave locally and you can also save a project file to keep a backup.
  - q: Can my handwriting font include accented letters?
    a: Yes. Once you have the base letters and the marks such as the acute, tilde and cedilla, fontsketch builds accented letters automatically from components, covering Latin-1 Supplement and Latin Extended-A.
  - q: Can I make a cursive font where the letters connect?
    a: You can, as long as each letter ends and starts at a consistent height so the strokes meet. Write the connecting strokes so they reach the cell edges at the same level, then tune side bearings until the joins line up.
related: [handwriting-to-font-converter, how-to-make-a-font, font-kerning-guide, use-a-custom-font-on-your-website]
---
You can turn your handwriting into a font in about half an hour: print a template sheet, fill each cell with one letter, photograph it with your phone, and let fontsketch trace every character into vector outlines. You then fix spacing, add a few kerning pairs and export a TTF, OTF or WOFF2 file, all inside your browser.

## What you need before you start

The good news is that the equipment list is short. Most people already have everything.

- A printer, or access to one, for a single A4 or Letter page
- A pen with dark, consistent ink (a 0.5 to 0.8 mm felt tip is ideal)
- A phone camera or a flatbed scanner
- A modern desktop browser to run the [fontsketch editor](app:)

There is nothing to install and no account to create. The editor runs entirely in your browser, the photo is processed on your device, and your project autosaves locally so you can close the tab and come back later.

## Step 1: print the handwriting template

In fontsketch, open the handwriting sheet option and download the PDF template in A4 or Letter. Print it at **100 percent scale**. If your print dialog shrinks the page with an option like fit to page, the cells still work, but the markers will be closer together than expected and you lose a little resolution for nothing.

Each sheet has a grid of cells, one per character, plus four solid corner markers. Those markers matter: they are how the software finds the page in a photo and straightens it.

## Step 2: write your characters

This is the part that decides how the font will look, so take your time.

- **Write at your natural size.** Fill roughly two thirds of the cell height for capitals. Tiny letters lose detail when traced, and letters that touch the border get clipped.
- **Keep a steady baseline.** Imagine a line about a third of the way up each cell and sit every letter on it, letting descenders on g, j, p, q and y drop below.
- **Match your x-height.** Lowercase letters like a, n and o should reach roughly the same height across all cells, otherwise words will bounce.
- **Do not go back over strokes.** Retouching a line usually makes it thicker and lumpier than the rest. If you make a mistake, print a fresh sheet or redo that letter later in the editor.

If you want the font to feel natural, write the letters as you would inside a word, not in your neatest school print. For a deeper look at pens, paper and lighting, see our [handwriting to font converter guide](guide:handwriting-to-font-converter).

## Step 3: photograph or scan the sheet

A phone photo is enough. Lay the page flat on a table near a window, avoid direct sun, and hold the phone roughly parallel to the paper so your own shadow does not fall across the grid. All four corner markers must be inside the frame. Fill as much of the frame with the page as you can, because more pixels per letter means smoother outlines.

If you have a flatbed scanner, scan in grayscale at 300 dpi. Scans give the cleanest edges, but they are not required.

## Step 4: let fontsketch trace the letters

Drop the image into the editor. fontsketch then runs a short pipeline, all locally:

1. It finds the four corner markers and corrects perspective, so a slightly tilted photo becomes a flat page.
2. It evens out the lighting, which removes the gradient you get from a window on one side.
3. It binarizes the image into pure black ink on white paper.
4. It splits the grid into individual cells and maps each one to its character.
5. It traces each letter into vector outlines and gives every glyph a **confidence score**.

The confidence score is your review list. A high score means the trace found a clean, single shape where it expected one. A low score usually points to a stray mark, a letter touching the cell border, or a faint stroke that broke apart.

## Step 5: clean up the glyphs

Start with the glyphs that have the lowest confidence scores. Typical fixes:

- Delete specks and smudges that were traced as tiny contours.
- Run **simplify** to reduce the number of points. Traced outlines often have far more nodes than needed, which makes curves wobbly. Simplifying with curve fitting gives smoother shapes and smaller files.
- Use **overlap removal** on letters where strokes cross, such as t, f or x, so the outline is a single clean shape.
- Let fontsketch correct **contour direction**, which keeps counters (the holes in o, e, a) rendering correctly.

If a letter just does not look right, redraw it with the brush or the bezier pen tool. Mixing a few hand drawn glyphs with traced ones is normal and nobody will notice.

## Step 6: metrics, spacing and accents

Fonts use a coordinate system called units per em, and fontsketch uses 1000 units. Check the **metrics**: the ascender, descender, x-height and cap height lines should match your writing. If your lowercase looks too small next to your capitals, this is where you fix it.

Spacing is what makes a handwriting font look professional instead of homemade. Each glyph has a left and right **side bearing**, the empty space on each side. Set them so the gaps inside words look even. A good test string is *nonononon* and *HOHOHOH*: if the rhythm looks regular, your base spacing is right.

Next, add kerning pairs for combinations that still look off, such as T next to o or A next to V. Our [font kerning guide](guide:font-kerning-guide) lists the pairs worth checking first.

Accented letters are mostly automatic. Draw or trace the marks (acute, grave, circumflex, tilde, diaeresis, cedilla, ring) and fontsketch composes letters like ã, é, ç and ü from base plus mark components, covering Latin-1 Supplement and Latin Extended-A. That is enough for Portuguese, Spanish, French, German, Polish and many other languages.

## Step 7: export your handwriting font

Pick the format that matches where you will use it:

| Use | Format |
| --- | --- |
| Install on Windows or macOS, use in Word or design apps | TTF or OTF |
| Website or web app | WOFF2 plus the CSS @font-face snippet |
| Older systems that need a fallback | WOFF |

Automatic TrueType hinting is available on export and helps your font stay crisp at small sizes on Windows screens. Handwriting fonts are usually used at larger sizes, so this matters less than for a body text font, but it does no harm.

To put the font on a site, follow [use a custom font on your website](guide:use-a-custom-font-on-your-website).

## Common mistakes to avoid

- Writing with a ballpoint pen. The line is thin and uneven, so traces come out ragged.
- Photographing at an angle in dim light. Perspective correction is good, but heavy shadows still eat into strokes.
- Skipping punctuation. A font without period, comma, apostrophe and question mark is frustrating to use.
- Ignoring spacing. Even beautiful letters look clumsy with uneven gaps.

## Quick checklist

- Template printed at 100 percent scale
- Every cell filled, letters inside the borders
- Photo taken in even light with all four markers visible
- Low confidence glyphs reviewed and fixed
- Spacing tested with nonononon and HOHOHOH
- Marks drawn so accented letters build automatically
- Exported in the right format for your use

## Next steps

Open the [fontsketch editor](app:) and print your first sheet. If you want to understand the full design process beyond handwriting, read [how to make a font](guide:how-to-make-a-font). Once your font works, polish it with the [kerning guide](guide:font-kerning-guide) and save a `.fontsketch.json` project file so you can come back and add more characters later.
