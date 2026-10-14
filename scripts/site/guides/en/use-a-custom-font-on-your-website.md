---
slug: use-a-custom-font-on-your-website
lang: en
title: Add a Custom Font to Your Website With @font-face
description: Add a custom font to your website with @font-face. Ready snippets for plain HTML, React, Next.js and Vue, plus preload, fallbacks and fixes for common errors.
h1: How to add a custom font to your website
keyword: add custom font to website
art: type-case
alt: A WOFF2 font file dropped into a project folder next to HTML, React, Next.js and Vue code snippets using the same font family
time: PT15M
howto: How to add a custom font to a website with @font-face
steps:
  - name: Export the web font
    text: Export WOFF2 from fontsketch along with the generated CSS @font-face snippet.
  - name: Put the file in your project
    text: Copy the WOFF2 file into a fonts folder that your site serves, such as public/fonts or src/assets/fonts.
  - name: Declare the font with @font-face
    text: Add the @font-face rule with the correct path, weight, style and font-display value.
  - name: Apply the font family
    text: Use the family name in font-family on body or specific elements, followed by a fallback stack.
  - name: Preload and verify
    text: Preload the main file, then confirm in the browser developer tools that the font downloads and renders.
faq:
  - q: How do I add a custom font to my website without a font hosting service?
    a: Self host it. Put the WOFF2 file in your project, declare it with @font-face pointing to that file, and use the family name in your CSS. No third party service is involved.
  - q: Why is my custom font not loading?
    a: The usual causes are a wrong path relative to the CSS file, a family name typo, a missing crossorigin attribute on a preload, or the server blocking cross origin requests. Check the Network panel for a 404 or CORS error.
  - q: Where do I put font files in a React or Vue project?
    a: Either in the public folder and reference them with an absolute path such as /fonts/MyHand.woff2, or next to your CSS in src so the build tool fingerprints them. Both work.
  - q: Why does my bold text look smeared with a custom font?
    a: You only declared a regular weight, so the browser synthesizes bold. Add a separate @font-face rule for the real bold file, or use a variable font with a weight range.
  - q: Can I use my handwriting font on a website?
    a: Yes. Export it as WOFF2 from fontsketch, add it with @font-face and use it for headings or accents. Handwriting fonts are usually best for short text rather than long paragraphs.
related: [web-font-formats-ttf-otf-woff2, turn-your-handwriting-into-a-font, variable-font-tutorial, icon-font-generator]
---
To add a custom font to your website, export it as WOFF2, place the file in your project, declare it with an @font-face rule that points to the file, then use the family name in font-family with a fallback stack. The same rule works in plain HTML, React, Next.js and Vue; only the file location and import style change.

## Step 1: get a WOFF2 file

WOFF2 is the format browsers download fastest. If you made the font in fontsketch, export WOFF2 and copy the CSS @font-face snippet it generates. If you are using someone else's font, check that its license allows web embedding. The [web font formats guide](guide:web-font-formats-ttf-otf-woff2) explains why WOFF2 is the right choice and when other formats still matter.

Name files in lowercase without spaces and include a version, for example `myhand-v1.woff2`. It avoids case sensitivity bugs on Linux servers and makes cache busting easy.

## Before you start: license and purpose

Two quick checks save trouble later. First, the license: a font you made yourself is yours to embed, but a font from elsewhere needs a license that explicitly allows web use. Desktop licenses often do not include it. Open source fonts under the SIL Open Font License can be self hosted freely.

Second, decide where the font will appear. A distinctive display or handwriting font shines in headings, buttons, quotes and logos, but long paragraphs in a handwriting style tire readers quickly. A common pattern is one custom font for headings and a well tested system or text font for body copy. Fewer custom files also means a faster page.

## Plain HTML and CSS

A simple folder structure:

```text
site/
  index.html
  css/style.css
  fonts/myhand-v1.woff2
```

In `css/style.css`:

```css
@font-face {
  font-family: "MyHand";
  src: url("../fonts/myhand-v1.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

h1, h2 {
  font-family: "MyHand", "Segoe Print", cursive;
}
```

The URL inside `@font-face` is relative to the **CSS file**, not the HTML page. That is the most common cause of missing fonts.

In `index.html`, preload the font and link the stylesheet:

```html
<head>
  <link rel="preload" href="/fonts/myhand-v1.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/style.css">
</head>
```

## React with Vite

Option A, use the public folder. Put the file in `public/fonts/myhand-v1.woff2` and reference it with an absolute path:

```css
/* src/fonts.css */
@font-face {
  font-family: "MyHand";
  src: url("/fonts/myhand-v1.woff2") format("woff2");
  font-display: swap;
}
```

Option B, keep the font in `src/assets/fonts/` and use a relative path. The build tool then fingerprints the file name for caching:

```css
@font-face {
  font-family: "MyHand";
  src: url("./assets/fonts/myhand-v1.woff2") format("woff2");
  font-display: swap;
}
```

Import the CSS once at the entry point:

```js
// src/main.jsx
import './fonts.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
```

Then use it anywhere:

```js
export function Title() {
  return <h1 style={{ fontFamily: '"MyHand", cursive' }}>Hello</h1>;
}
```

## Next.js

Next.js has a built in helper for local fonts that self hosts the file, preloads it and generates fallback metrics to reduce layout shift.

```js
// app/layout.js
import localFont from 'next/font/local';

const myHand = localFont({
  src: './fonts/myhand-v1.woff2',
  display: 'swap',
  variable: '--font-myhand',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={myHand.variable}>
      <body>{children}</body>
    </html>
  );
}
```

Put the file at `app/fonts/myhand-v1.woff2`. In your CSS, use the variable:

```css
h1 { font-family: var(--font-myhand), cursive; }
```

For several weights, pass an array of sources to `localFont`, each with its own `weight` and `style`.

## Vue with Vite

The approach mirrors React. Place the file in `src/assets/fonts/`, write the rule in a CSS file and import it in `main.js`:

```js
// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import './assets/fonts.css';

createApp(App).mount('#app');
```

```css
/* src/assets/fonts.css */
@font-face {
  font-family: "MyHand";
  src: url("./fonts/myhand-v1.woff2") format("woff2");
  font-display: swap;
}

:root { --font-display: "MyHand", cursive; }
```

Then in any component style block, `font-family: var(--font-display);`.

## Generating the CSS from Node

If you build fonts in a pipeline, the fontsketch Node package can produce the files and the CSS for you. `exportFont` writes the WOFF2 bytes and `cssFontFace` generates the matching @font-face rule, so your build can output both together.

## Site builders and content management systems

If your site runs on a hosted builder or a content management system, the idea is the same even without a code editor. Upload the WOFF2 file to the media library or a theme folder, copy its public URL, and paste an @font-face rule with that absolute URL into the custom CSS area of your theme. Then apply the family name to the elements you want.

Two things often go wrong on these platforms. Some media libraries refuse font uploads by default, so you may need a theme folder instead. And if the file is served from a different domain than the site, such as a separate media host, that server must allow cross origin requests for fonts, or browsers will block the file silently.

## Multiple weights and styles

Declare one `@font-face` rule per real file, all with the same family name:

```css
@font-face { font-family: "MySans"; src: url("/fonts/mysans-400.woff2") format("woff2"); font-weight: 400; font-style: normal; }
@font-face { font-family: "MySans"; src: url("/fonts/mysans-700.woff2") format("woff2"); font-weight: 700; font-style: normal; }
```

Now `font-weight: 700` picks the real bold. With a variable font, one rule with a range such as `font-weight: 400 700` replaces both; see the [variable font tutorial](guide:variable-font-tutorial).

## Keep the font fast

Each font file is a download that competes with images and scripts. A sensible budget for most sites is two to four font files on the first page view. Some ways to stay inside it:

- Use one variable font instead of several static weights when you need three or more.
- Drop styles you rarely use; an italic used once can often be replaced by the regular style with emphasis from color or size.
- Include only the characters you need, and split large sets with unicode-range.
- Preload only the file needed for text visible without scrolling.

Your browser's built in performance audit will flag fonts that delay the first render of text. The [web font formats guide](guide:web-font-formats-ttf-otf-woff2) goes deeper into subsetting and font-display.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Fallback font shows, 404 in Network panel | Wrong path | Make the URL relative to the CSS file, or use an absolute path |
| Font blocked, CORS error in console | Served from another domain | Add an Access-Control-Allow-Origin header on the font server |
| Preloaded font downloads twice | Missing crossorigin on preload | Add crossorigin to the link tag |
| Bold looks smeared | No real bold declared | Add a 700 weight rule or use a variable font |
| Old version keeps showing | Cache | Rename the file with a new version |
| Works locally, fails on server | File name case mismatch | Use lowercase file names everywhere |

To confirm which font is actually used, open the browser developer tools, select a text element and look for the rendered fonts in the computed styles. The Network panel filtered by Font shows whether the file downloaded.

## Checklist

- WOFF2 file in a served folder, lowercase versioned name
- @font-face with correct relative or absolute path
- font-display chosen, usually swap
- Fallback stack after the custom family
- Critical file preloaded with crossorigin
- Real weights declared, or a variable font range
- Verified in developer tools

## Next steps

Export WOFF2 and the CSS snippet from the [fontsketch editor](app:) and drop them into one of the setups above. Do not have a font yet? Make one from your own writing with [turn your handwriting into a font](guide:turn-your-handwriting-into-a-font), or ship a set of interface icons with the [icon font generator](guide:icon-font-generator).
