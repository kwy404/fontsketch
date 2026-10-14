---
slug: web-font-formats-ttf-otf-woff2
lang: en
title: WOFF2 vs TTF vs OTF, Which Font Format for the Web
description: WOFF2 vs TTF vs OTF explained. Which font format to use for the web, how @font-face, font-display, preload, subsetting and unicode-range make fonts load fast.
h1: WOFF2 vs TTF vs OTF, which font format to use for the web
keyword: woff2 vs ttf
art: export-cards
alt: Four file cards labeled TTF, OTF, WOFF and WOFF2 with relative file sizes, the WOFF2 card smallest
time: PT20M
howto: How to export and serve a web font efficiently
steps:
  - name: Export WOFF2
    text: Export your font as WOFF2 from fontsketch, together with the generated CSS @font-face snippet.
  - name: Reduce the character set
    text: Include only the characters your site needs, and split large character sets into subsets with unicode-range.
  - name: Write the @font-face rule
    text: Point src to the WOFF2 file, declare weight and style, and choose a font-display value.
  - name: Preload the critical file
    text: Add a preload link with crossorigin for the one font file used above the fold.
  - name: Serve with long caching
    text: Use a versioned file name and a long cache lifetime, with the correct font/woff2 content type.
faq:
  - q: Should I use WOFF2 or TTF for my website?
    a: Use WOFF2. It is the same font data compressed with Brotli and is supported by every current browser. TTF files are larger and are meant for installing fonts on a computer.
  - q: Do I still need WOFF or EOT fallbacks?
    a: EOT and SVG fonts are obsolete. WOFF is only useful for very old browsers. For most sites, a single WOFF2 file per style is enough, with a system font as the fallback in your font stack.
  - q: What is the difference between TTF and OTF?
    a: Both are OpenType fonts. TTF usually has TrueType outlines made of quadratic curves, while OTF usually has CFF outlines made of cubic curves. For installing and using fonts, both work on Windows and macOS.
  - q: Which font-display value should I use?
    a: swap shows fallback text immediately and switches when the font loads, good for most text. optional avoids layout shifts by only using the font if it arrives very quickly. block suits icon fonts.
  - q: How much smaller is WOFF2 than TTF?
    a: It varies with the font, but WOFF2 is commonly around half the size of an uncompressed TTF and noticeably smaller than WOFF, thanks to Brotli compression and font specific preprocessing.
related: [use-a-custom-font-on-your-website, font-hinting-explained, variable-font-tutorial, icon-font-generator]
---
For the web, use WOFF2. It contains the same font data as TTF or OTF but compressed with Brotli, so it is much smaller, and every current browser supports it. Use TTF or OTF to install fonts on a computer. Load it with @font-face, pick a font-display value, preload the critical file and subset what you do not need.

## The four formats at a glance

| Format | What it is | Main use |
| --- | --- | --- |
| TTF | OpenType font with TrueType outlines (quadratic curves) | Installing on Windows, macOS, Linux |
| OTF | OpenType font usually with CFF outlines (cubic curves) | Installing on desktops, print workflows |
| WOFF | TTF or OTF wrapped and compressed with zlib | Legacy web fallback |
| WOFF2 | TTF or OTF compressed with Brotli plus font specific transforms | The web, today |

fontsketch exports all four, plus a ready CSS @font-face snippet.

### TTF vs OTF

Both are OpenType. The difference is the outline flavor. TrueType outlines use quadratic bezier curves and TrueType hinting instructions. CFF outlines use cubic curves, the same kind you draw with a bezier pen in most vector apps, and declarative stem hints. For everyday use, either installs and works on Windows and macOS. Some older apps or devices handle TTF more reliably, which is why TTF is the safe default when you are unsure.

### Why WOFF2 wins on the web

WOFF2 is not a different kind of font. It is a container that compresses the tables of a TTF or OTF. Two things make it small:

1. **Brotli compression**, which beats the zlib compression used by WOFF.
2. **Preprocessing** of the glyph data before compression, which makes outlines far more compressible.

The result is typically around half the size of the raw TTF and clearly smaller than WOFF. The browser decompresses it back into a normal font.

## A quick decision guide

If you only remember one paragraph, make it this one:

- **Building a website or web app?** Ship WOFF2. Nothing else is needed for current browsers.
- **Supporting a very old embedded browser** you know your users have? Add WOFF as a second source after WOFF2.
- **Installing on your own computer** or sending a font to a designer? Use TTF, or OTF if the recipient prefers CFF outlines.
- **Embedding in a mobile app?** Most app platforms take TTF or OTF directly; check the platform documentation.
- **Cutting with a craft machine** or using in office documents? Install TTF on the computer.

When in doubt, export all of them from the same project. They contain the same design, so there is no risk in having several files, as long as each goes where it belongs.

## Writing the @font-face rule

A modern, minimal rule:

```css
@font-face {
  font-family: "MyHand";
  src: url("/fonts/myhand-v1.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

body {
  font-family: "MyHand", system-ui, sans-serif;
}
```

Key points:

- **font-family** is any name you choose; reuse it in your CSS.
- **format("woff2")** lets the browser skip files it cannot use without downloading them.
- **font-weight and font-style** must match how you use the font. If you declare only 400 and then use bold, the browser fakes a bold by smearing the outline. Declare a separate rule for each real style.
- A **fallback stack** after your font keeps text readable while loading and in the rare case it fails.

For a variable font, declare a range, for example `font-weight: 400 700`. The [variable font tutorial](guide:variable-font-tutorial) explains this.

## Choosing font-display

`font-display` controls what users see while the font downloads.

| Value | Behavior | Good for |
| --- | --- | --- |
| swap | Shows fallback immediately, swaps when loaded | Most body and heading text |
| fallback | Short invisible period, then fallback; swaps only if the font arrives soon | Text where late swaps feel jarring |
| optional | Uses the font only if it is available almost immediately | Performance first sites, avoids layout shift |
| block | Hides text for up to about three seconds | Icon fonts, where fallback characters look broken |
| auto | Browser decides | Rarely the best choice |

## Reducing layout shift

When a fallback font swaps to your web font, text can reflow if the two fonts have different widths and line heights. CSS lets you tune the fallback to match:

```css
@font-face {
  font-family: "MyHand Fallback";
  src: local("Arial");
  size-adjust: 104%;
  ascent-override: 92%;
  descent-override: 24%;
}

body { font-family: "MyHand", "MyHand Fallback", sans-serif; }
```

Adjust the percentages until the fallback paragraph occupies the same space as your font. This keeps layout shift low even with `swap`.

## Preload the critical font

Browsers discover fonts late: only after the CSS is parsed and an element needs the font. Preloading tells the browser up front:

```html
<link rel="preload" href="/fonts/myhand-v1.woff2" as="font" type="font/woff2" crossorigin>
```

The `crossorigin` attribute is required even for same origin fonts, otherwise the preloaded file is not reused. Preload only the one or two files used above the fold; preloading every weight wastes bandwidth.

## Subsetting and unicode-range

The fastest byte is the one you never send. Two techniques:

- **Subsetting**: remove glyphs your site never uses. If your font only appears in English headings, you do not need Cyrillic or rare symbols. When designing in fontsketch, you can simply leave out characters you do not need.
- **unicode-range**: split a large font into subset files and tell the browser which characters each covers. It downloads only the files it needs for the text on the page.

```css
@font-face {
  font-family: "MyHand";
  src: url("/fonts/myhand-latin.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2018-201D, U+20AC;
}
@font-face {
  font-family: "MyHand";
  src: url("/fonts/myhand-latin-ext.woff2") format("woff2");
  unicode-range: U+0100-017F;
}
```

## Hinting and file size

TrueType hinting instructions improve rendering at small sizes on Windows but add bytes. For display and handwriting fonts used large, exporting without hinting is a reasonable trade. The [font hinting guide](guide:font-hinting-explained) helps you decide.

## Serving and caching

- Serve WOFF2 with the content type `font/woff2`.
- Use versioned file names, such as `myhand-v2.woff2`, and a long cache lifetime.
- Self host when you can. It avoids an extra connection to a third party domain and keeps visitors' requests on your own site.
- If fonts are served from another domain, the server must send CORS headers that allow your site.

## Web font checklist

- WOFF2 exported, one file per real style or one variable file
- Character set limited to what the site needs
- @font-face with format, weight, style and font-display
- Fallback stack, ideally with metric overrides
- One or two critical files preloaded with crossorigin
- Versioned file names and long caching

## Next steps

Export WOFF2 and the CSS snippet from the [fontsketch editor](app:), then follow [use a custom font on your website](guide:use-a-custom-font-on-your-website) for framework specific setup. If you are shipping icons, the [icon font generator guide](guide:icon-font-generator) covers the CLI route.
