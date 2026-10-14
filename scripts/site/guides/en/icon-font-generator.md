---
slug: icon-font-generator
lang: en
pair: gerador-de-fonte-de-icones
title: Icon Font Generator, Turn SVG Icons Into a Font
description: Free icon font generator for SVG icons. Turn a folder of SVG files into TTF and WOFF2 plus CSS classes with one command, using Private Use Area codepoints.
h1: Icon font generator, from a folder of SVG icons to a web font
keyword: icon font generator
art: icon-font
alt: A grid of simple SVG icons such as home, search and heart flowing into a single font file with CSS class labels
time: PT15M
howto: How to generate an icon font from SVG icons with fontsketch
steps:
  - name: Prepare the SVG icons
    text: Draw every icon on the same square artboard, convert strokes to filled outlines and remove colors, masks and transforms.
  - name: Put them in one folder
    text: Save all icons as SVG files in a single folder, with clear descriptive file names.
  - name: Install fontsketch
    text: Make sure Node 18 or later is installed, then run npx fontsketch --help to see the available commands.
  - name: Generate the icon font
    text: Run npx fontsketch icons ./icons --out ./dist to build TTF and WOFF2 files plus a CSS file with one class per icon.
  - name: Add the font to your site
    text: Copy the output to your project, link the CSS file and use the generated classes in your markup.
  - name: Make the icons accessible
    text: Hide decorative icons from screen readers and give meaningful icons a text label.
faq:
  - q: How do I convert SVG icons to a font?
    a: Put the SVG files in one folder and run the fontsketch CLI with the icons command. It outputs TTF and WOFF2 font files and a CSS file that maps each icon to a class you can use in HTML.
  - q: Which Unicode codepoints do icon fonts use?
    a: Icon fonts place glyphs in the Private Use Area, which starts at U+E000. These codepoints have no standard meaning, so they never clash with real letters and the icons only appear where your CSS puts them.
  - q: Why do my outlined icons appear filled in the icon font?
    a: Fonts only store filled shapes. A stroke drawn in SVG has no width in a font. Convert strokes to outlines in your vector editor before generating the font, and check that inner shapes are part of compound paths.
  - q: Are icon fonts still a good idea compared to SVG sprites?
    a: Both work. Icon fonts are simple to drop into any page and inherit color and size from text, while inline SVG supports multiple colors and is easier to make accessible. For single color interface icons, an icon font remains a practical option.
  - q: Can icon fonts have more than one color?
    a: Not in the usual sense. Each glyph takes one color from the CSS color property. For multicolor icons, use SVG instead.
related: [make-a-font-from-svg, web-font-formats-ttf-otf-woff2, use-a-custom-font-on-your-website, font-hinting-explained]
---
An icon font generator turns a folder of SVG icons into a font file plus CSS, so each icon is used with a class and styled like text. With fontsketch you run one command, `npx fontsketch icons ./icons --out ./dist`, and get TTF and WOFF2 files with icons mapped to Private Use Area codepoints, plus matching CSS classes.

## How an icon font works

A font maps characters to shapes. An icon font maps characters to icons instead of letters. Because you do not want a heart to appear when someone types a real letter, icon fonts use the **Private Use Area** (PUA) of Unicode, the range starting at U+E000. Those codepoints have no assigned meaning, so they only show your icons when your CSS asks for them.

The CSS then does two things:

1. Declares the font with `@font-face`.
2. Creates a class for each icon that inserts its codepoint through a `::before` pseudo element.

A typical icon class looks like this. The exact names in your project come from the generated CSS file, so open it to see them:

```css
.icon::before {
  font-family: "icons";
  font-style: normal;
  font-weight: normal;
  line-height: 1;
}
.icon-home::before { content: "\e001"; }
```

## Prepare your SVG icons

Icon fonts are strict about input. Clean files give clean glyphs.

### Use a consistent grid

Draw every icon on the same square artboard, such as 24 by 24 or 16 by 16 units, with the same padding. Icons drawn on different sized artboards end up at different visual sizes in the font. Align main edges to whole units of the grid so icons stay sharp at their intended size.

### Fill, do not stroke

Fonts store filled outlines only. Line icons are often drawn with strokes in vector apps; convert those strokes to outlines before export. Otherwise the stroke has no thickness in the font and the icon disappears or fills in.

### Single color, no effects

Remove fills with different colors, gradients, opacity, masks and filters. The font keeps only the shape, and color comes from CSS.

### Compound paths for holes

A ring or a magnifying glass lens needs an inner hole. Make the outer and inner shapes one compound path. A white circle stacked on a black one becomes a solid disc in a font.

### Flatten transforms and clean up

Apply transforms, ungroup unnecessary groups and delete hidden layers. Open one file in a text editor: ideally you see one or a few `path` elements and nothing else.

These preparation rules are the same as for letters; the [make a font from SVG guide](guide:make-a-font-from-svg) explains them in more depth.

## Generate the font with the CLI

The CLI is part of the fontsketch package and needs Node 18 or later. To see what it can do:

```bash
npx fontsketch --help
```

To build an icon font from a folder of SVGs:

```bash
npx fontsketch icons ./icons --out ./dist
```

The output folder contains TTF and WOFF2 font files and a CSS file with one class per icon. Add the command to your build scripts so the font is regenerated whenever an icon changes, and commit the SVG sources, not just the output, so anyone on the team can rebuild.

Name your files descriptively, such as `arrow-left.svg` or `cart.svg`. Clear file names make the generated CSS and your markup easier to read.

## Use the icon font in your project

Copy the WOFF2 file and CSS into your project and link the stylesheet:

```html
<link rel="stylesheet" href="/dist/icons.css">

<button type="button">
  <span class="icon icon-cart" aria-hidden="true"></span>
  Add to cart
</button>
```

The class names in this example are illustrative; use the ones from your generated CSS. Icons behave like text: set `font-size` to resize them and `color` to recolor them, including on hover.

For loading performance, the WOFF2 file is the one browsers will use. Our guide on [web font formats](guide:web-font-formats-ttf-otf-woff2) covers preloading and `font-display`. For an icon font, `font-display: block` is a common choice, because showing fallback characters in place of icons looks broken.

## Accessibility rules for icon fonts

Icon fonts insert characters, and screen readers may try to read them. Two rules cover most cases:

- **Decorative icons** next to visible text: add `aria-hidden="true"` to the icon element, as in the button above.
- **Meaningful icons** without visible text, such as an icon only button: hide the icon and give the button an accessible name with `aria-label` or visually hidden text.

```html
<button type="button" aria-label="Search">
  <span class="icon icon-search" aria-hidden="true"></span>
</button>
```

Also remember that some users override page fonts for readability. With an icon font, those users may see empty boxes instead of icons, which is another reason to pair important icons with text.

## Sizing and alignment tips

Icons placed inline with text inherit the line's font size, but they do not always line up with the text the way you expect. A few CSS habits keep them tidy:

- Set `vertical-align: middle` or a small negative `vertical-align` value on the icon class, then adjust by eye against your body text.
- Use `display: inline-block` and `line-height: 1` so the icon does not stretch the line box.
- Size icons in multiples of your design grid. Icons drawn on a 24 unit grid look sharpest at 24 px, 48 px and so on, and slightly soft at 21 px.
- If an icon looks off center in a button, fix the SVG source padding rather than nudging it with CSS, so every use benefits.

## Versioning and caching

Once an icon font ships, browsers cache it aggressively. When you add or change icons, change the file name or add a version query to the URL in your CSS so users get the new file. Avoid reusing codepoints for different icons across versions: an old cached font with new CSS would show the wrong icon. Adding new icons at new codepoints and retiring old ones is the safe pattern.

## Icon font or SVG sprite?

| Need | Better fit |
| --- | --- |
| Single color icons, styled like text | Icon font |
| Drop in use with only CSS classes | Icon font |
| Multicolor icons or gradients | SVG |
| Animating parts of an icon | SVG |
| Maximum control over accessibility | SVG |

Many projects use both: an icon font for common interface glyphs and inline SVG for illustrations.

## Hinting for icons

Icons are usually displayed at a few fixed sizes. Designing them on a grid that matches those sizes gives sharper results than relying on hinting, and leaving hinting off keeps the file small. The [font hinting guide](guide:font-hinting-explained) explains when hinting helps.

## Icon font checklist

- All icons on the same square artboard with equal padding
- Strokes converted to filled outlines
- One color, no gradients, masks or filters
- Holes made with compound paths
- Transforms flattened, files cleaned
- Font generation added to your build scripts
- Decorative icons hidden from screen readers, meaningful ones labeled

## Next steps

Run `npx fontsketch --help`, then point the icons command at your SVG folder. If you need to edit a single glyph by hand, open the font in the [fontsketch editor](app:). To ship it properly, follow [use a custom font on your website](guide:use-a-custom-font-on-your-website).
