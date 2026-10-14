// A tiny PDF 1.4 writer for the handwriting sheets: rectangles, lines and
// Helvetica text on pages measured in millimetres with Y pointing down.

/**
 * @typedef {{ t: 'rect', x: number, y: number, w: number, h: number, fill?: number[], stroke?: number[], sw?: number, dash?: number[] }
 *   | { t: 'line', x1: number, y1: number, x2: number, y2: number, stroke: number[], sw: number, dash?: number[] }
 *   | { t: 'text', x: number, y: number, size: number, text: string, fill: number[], anchor?: 'start' | 'middle' | 'end', bold?: boolean }} Shape
 */

const MM = 72 / 25.4;
const num = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};
const color = (c) => c.map((v) => num(v / 255)).join(' ');

/**
 * Approximate advance of Helvetica text in ems, good enough to centre labels.
 * @param {string} text
 */
export function textWidthEm(text) {
  let w = 0;
  for (const ch of text) {
    if ('il.,:;\'!|'.includes(ch)) w += 0.28;
    else if ('fjrt()[]-'.includes(ch)) w += 0.36;
    else if ('mwMW@'.includes(ch)) w += 0.86;
    else if (/[A-Z0-9#$%&?]/.test(ch) || ch.charCodeAt(0) > 191) w += 0.66;
    else w += 0.54;
  }
  return w;
}

/**
 * Encodes text for a PDF literal string in WinAnsi. Characters outside it
 * are replaced by `?` (the SVG keeps them exactly).
 * @param {string} text
 */
function pdfString(text) {
  let out = '(';
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (c >= 32 && c < 127) out += ch;
    else if (c >= 160 && c <= 255) out += '\\' + c.toString(8).padStart(3, '0');
    else out += '?';
  }
  return out + ')';
}

/**
 * Content stream operators for a list of shapes.
 * @param {Shape[]} shapes @param {number} pageHeight
 */
function contentStream(shapes, pageHeight) {
  const ops = [`${num(MM)} 0 0 ${num(-MM)} 0 ${num(pageHeight * MM)} cm`];
  for (const s of shapes) {
    if (s.t === 'rect') {
      if (s.fill) ops.push(`${color(s.fill)} rg ${num(s.x)} ${num(s.y)} ${num(s.w)} ${num(s.h)} re f`);
      if (s.stroke) {
        ops.push(`${color(s.stroke)} RG ${num(s.sw || 0.2)} w [${(s.dash || []).map(num).join(' ')}] 0 d`);
        ops.push(`${num(s.x)} ${num(s.y)} ${num(s.w)} ${num(s.h)} re S`);
      }
    } else if (s.t === 'line') {
      ops.push(`${color(s.stroke)} RG ${num(s.sw)} w [${(s.dash || []).map(num).join(' ')}] 0 d`);
      ops.push(`${num(s.x1)} ${num(s.y1)} m ${num(s.x2)} ${num(s.y2)} l S`);
    } else if (s.t === 'text') {
      const width = textWidthEm(s.text) * s.size;
      const x = s.anchor === 'middle' ? s.x - width / 2 : s.anchor === 'end' ? s.x - width : s.x;
      ops.push(`${color(s.fill)} rg BT /${s.bold ? 'F2' : 'F1'} ${num(s.size)} Tf 1 0 0 -1 ${num(x)} ${num(s.y)} Tm ${pdfString(s.text)} Tj ET`);
    }
  }
  return ops.join('\n');
}

/**
 * Writes a multi page PDF.
 * @param {Array<Shape[]>} pages
 * @param {number} width page width in mm
 * @param {number} height page height in mm
 * @param {{ title?: string }} [info]
 * @returns {Uint8Array}
 */
export function writePdf(pages, width, height, info = {}) {
  /** @type {string[]} */
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add('');
  const pagesObj = add('');
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const shapes of pages) {
    const stream = contentStream(shapes, height);
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${num(width * MM)} ${num(height * MM)}] ` +
      `/Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`,
    ));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const infoObj = add(`<< /Title ${pdfString(info.title || 'fontsketch sheet')} /Producer (fontsketch) >>`);

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}
