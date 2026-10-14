# Security Policy

## How fontsketch handles your files

- The editor runs entirely in your browser. Drawings, photos of handwriting
  sheets, imported SVG files and fonts are processed on your device and are
  never uploaded. Projects autosave in the browser storage of the site.
- fontsketch parses untrusted binary input when you open a TTF, OTF, WOFF or
  WOFF2 file or an image. The parser validates table offsets and lengths and
  rejects malformed data instead of reading past the end of a buffer. A bug
  here is a security issue: please report it as described below.
- SVG files are read as data. The editor parses them with the browser XML
  parser, removes `script` and `foreignObject` elements and every event
  handler attribute, measures the drawing in a hidden offscreen container and
  keeps only the path geometry. The Node API (`svgToContours`) never builds a
  DOM at all.
- The command line tool reads the folder you point it at and writes only to
  the output folder you choose.

## Reporting a vulnerability

If you find a vulnerability in fontsketch, please report it privately
through GitHub Security Advisories:

https://github.com/kwy404/fontsketch/security/advisories/new

Please do not open a public issue for security problems. Include the version,
the file or steps that reproduce the problem, and the impact you observed. A
crashing font file or image is very welcome as a test case. You will get a
reply as soon as possible, and a fix will be released before the details are
made public.

## Supported versions

Only the latest released version receives security fixes.
