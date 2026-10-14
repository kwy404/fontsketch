---
slug: font-kerning-guide
lang: en
title: What Is Kerning and How to Kern a Font, With Examples
description: What is kerning and how to kern a font well. Learn spacing first, then pairs like AV, To and Ty, kerning classes, test strings and how to avoid over kerning.
h1: What is kerning, and how to kern a font step by step
keyword: how to kern a font
art: kerning-pair
alt: The pair A V shown before and after kerning, with the gap between the diagonals reduced and measured in font units
time: PT1H30M
howto: How to kern a font with pairs and classes in fontsketch
steps:
  - name: Finish spacing first
    text: Set side bearings with strings like nnonnoon and HHOHHOOH until text has an even rhythm without any kerning.
  - name: Create kerning classes
    text: Group letters with the same left or right shape, for example O C G Q on the left side and o c d e q on the right.
  - name: Kern the critical pairs
    text: Work through capitals with diagonals and overhangs such as AV, To, Ty, LT, Yo and P followed by a period.
  - name: Add exceptions
    text: Where one letter in a class needs a different value, add a specific pair that overrides the class value.
  - name: Test in real text
    text: Export and set real words, headlines and paragraphs at several sizes, then fix pairs that look too tight or too loose.
faq:
  - q: What is the difference between kerning and tracking?
    a: Kerning adjusts the space between one specific pair of letters and is stored inside the font. Tracking, or letter spacing, adds the same space between all letters in a piece of text and is set in the app or CSS.
  - q: What is the difference between kerning and spacing?
    a: Spacing is the side bearings built into every glyph, which decide the basic rhythm of text. Kerning corrects specific pairs that spacing cannot fix. A well spaced font needs fewer kerning pairs.
  - q: Which letter pairs need kerning the most?
    a: Pairs combining diagonals and overhangs, such as AV, AW, AY, To, Ta, Ty, Va, Yo, LT, LY, FA, PA, and capitals followed by periods or commas. Quote marks next to letters are also common.
  - q: How many kerning pairs does a font need?
    a: It depends on the design and character set. A display font for basic Latin may work well with a few hundred pairs when using classes, while large text families can have thousands. Quality matters more than count.
  - q: Does CSS apply the kerning in my font?
    a: Yes. Browsers apply font kerning by default for most text, controlled by the font-kerning property. You can force it with font-kerning normal if needed.
related: [how-to-make-a-font, turn-your-handwriting-into-a-font, make-a-font-for-a-logo, web-font-formats-ttf-otf-woff2]
---
Kerning is the adjustment of space between specific pairs of letters so that text looks evenly spaced. To kern a font, first set good spacing with side bearings, then group similar letters into classes, kern the problem pairs like AV, To and Ty, add exceptions and test in real words. fontsketch supports kerning pairs and classes.

## Why fonts need kerning

Every glyph carries its own space on the left and right, the **side bearings**. Those values are chosen so that most combinations look even. But some shapes leave odd gaps whatever their side bearings are:

- **A next to V**: two diagonals create a big triangle of white space between them.
- **T next to o**: the crossbar of the T overhangs, leaving a gap under it.
- **L next to T**: the open right side of L meets the overhang of T.
- **P next to a period**: the bowl of P sits high, the period sits low.

Fixing these by changing side bearings would break every other combination with those letters. Kerning stores a correction just for the pair, usually a negative value in font units that moves the second glyph closer.

## Spacing first, always

The most common kerning mistake is to start kerning before the spacing is right. If your n and o are spaced poorly, you will end up kerning hundreds of pairs that should never need it.

A classic spacing routine for lowercase:

1. Set n so *nnnnnn* has an even rhythm.
2. Set o so *nonononon* looks even. Round sides need less side bearing than straight ones.
3. Space every other lowercase letter between n and o: *nanbncndnenfn*, *oaobocodoeofo*.

Then the same for capitals using H and O: *HHOHHOOHOO*, then *HAHBHCH* and *OAOBOCO*.

Only when this looks right do you start kerning. The [how to make a font](guide:how-to-make-a-font) guide covers spacing in the context of the whole process.

## Kerning classes save hours

Many letters share the same edge shape. O, C, G and Q have the same round left side. Letters like d, q and a can share a straight or nearly straight right side. Rather than kerning T against each round letter individually, you put them into a class and kern once.

Typical classes, by the side that touches the neighbor:

| Class | Members (example) | Shared shape |
| --- | --- | --- |
| Round left, capitals | C G O Q | Round left edge |
| Round right, capitals | D O Q | Round right edge |
| Diagonal, capitals | V W Y | Diagonal edges |
| Round left, lowercase | c d e o q | Round left edge |
| Round right, lowercase | b o p | Round right edge |
| Straight, lowercase | n m r u | Vertical stem |

Your exact classes depend on the design. In a font with a flat topped a, the a may not belong with the round letters. Accented letters built from components usually belong with their base letter, so é kerns like e.

## Pairs to check first

Work through these combinations with the most visible problems:

- **Capitals with diagonals**: AV, AW, AY, AT, VA, WA, YA
- **Overhangs**: To, Ta, Te, Ty, Tr, Yo, Ya, Vo, Va, Wo, Fa, Fo, Po
- **Open shapes**: LT, LV, LY, L followed by a quote mark
- **Punctuation**: T. T, V. Y, P. F. and r. r, y. y, followed by period and comma
- **Quotes**: opening quote before A, closing quote after s, quote marks next to T
- **Figures**: 1 next to other figures can look loose, 7 next to period
- **Lowercase**: r followed by period or comma, v w y next to period, f followed by quotes or parentheses

Kern by eye, not by numbers. Set the pair between neutral letters, such as *HAVH* or *nTon*, and adjust until the space inside the pair feels the same as the space around it.

## Exceptions

Classes are general rules. Sometimes one member needs something different, for example Tö where the diaeresis would collide with the crossbar if kerned as tight as To. In that case add a specific pair for that combination; specific pairs override class values.

## Typical kerning values

Numbers only make sense relative to the em. In a 1000 unit font like those made in fontsketch, rough starting ranges for a normal weight sans are:

| Pair type | Typical range in units |
| --- | --- |
| AV, AW, VA | negative 50 to 100 |
| To, Ta, Ty | negative 50 to 90 |
| LT, LY | negative 60 to 100 |
| P or F before a period | negative 60 to 120 |
| r before a comma or period | negative 20 to 50 |
| Round against round, such as oo | usually none |

Treat these as a sanity check rather than a target. If you find yourself kerning a pair by 200 units, the spacing or the drawing of one of the letters is probably the real problem.

## How much to kern

Over kerning is as bad as under kerning. Signs you went too far:

- Letters touch or collide at small sizes
- The pair looks darker than the surrounding text
- Words with kerned pairs look tighter than words without

Ask yourself whether the gap is noticeable at the size the font will actually be used. Display fonts get more aggressive kerning; text fonts usually less.

## Test strings that reveal problems

Use real words and phrases, not just pairs:

```text
AVATAR  WAVY  LATTE  TOYOTA  Typography
Tomato. Yes, "Way." Pay. Fly. Try, Very.
L'Avenir  P.S.  F.A.Q.  1977  11.1
Avó, Ação, Você, Tête, Łódź, Żółw
```

Include the languages you support. Portuguese, French and Polish bring accented capitals next to diagonals that standard English tests never show.

## Kerning on the web

Browsers apply the kerning stored in the font for most text by default. If you ever need to be explicit, CSS offers `font-kerning: normal`. Do not confuse it with `letter-spacing`, which adds uniform tracking. Large headings often look better with slightly negative letter spacing, but that is a style decision, separate from kerning. See [web font formats](guide:web-font-formats-ttf-otf-woff2) for serving the font itself.

## Handwriting and logo fonts

Handwriting fonts often need many kerning pairs because real handwriting is irregular. Focus on the most frequent pairs in your language. If you made a font from your writing with [our handwriting guide](guide:turn-your-handwriting-into-a-font), start with lowercase pairs involving r, v, w, y and f. For brand lettering, see [make a font for a logo](guide:make-a-font-for-a-logo), where wordmark spacing and font spacing need different treatment.

## Kerning checklist

- Spacing finished and approved before any kerning
- Classes created for round, straight and diagonal edges
- Critical capital pairs kerned
- Punctuation and quotes kerned
- Exceptions added where accents or details collide
- Tested in real words in every supported language
- No pairs that collide or look darker than the text around them

## Next steps

Open your project in the [fontsketch editor](app:), check spacing with *nonononon* and *HOHOHOH*, then create your first classes. Kern AV, To and Ty first; they reveal quickly whether your values are too timid or too strong.
