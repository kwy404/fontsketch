// Quill, the fontsketch octopus calligrapher.
import { taper, spline, broadNib, splat, sticker, r, P, smoothOpen } from './lib.mjs';

export const PAL = {
  light: {
    body: '#4440B0', shade: '#36329A', spot: '#5E5ACB', hi: '#7D79E0', line: '#1C1A4A',
    cup: '#F6E5C6', cupIn: '#E7C99A', eye: '#FFFDF6', ver: '#E4472B', verD: '#B9341F',
    gold: '#EBB54F', steel: '#CDD0E6', wood: '#D69B5E', woodL: '#F2D6A6', amber: '#F4B63E',
    ink: '#2A2770', graphite: '#3B3958', rim: '#FFFFFF', shadow: '#1C1A4A', letter: '#2A2770', letter2: '#E4472B',
  },
  dark: {
    body: '#5753C9', shade: '#4440B0', spot: '#716DDB', hi: '#9A97F0', line: '#14123A',
    cup: '#F6E5C6', cupIn: '#E7C99A', eye: '#FFFDF6', ver: '#F0563A', verD: '#C23C24',
    gold: '#F0BE5C', steel: '#D8DBEF', wood: '#DDA468', woodL: '#F4DCB0', amber: '#F6BE4C',
    ink: '#2A2770', graphite: '#3B3958', rim: '#F7ECD6', shadow: null, letter: '#2A2770', letter2: '#E4472B',
  },
};

const norm = (v) => { const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };

function tentacle(c, pts, w0, w1, side, cupsFrom = 0.3) {
  const width = (t) => w0 + (w1 - w0) * Math.pow(t, 0.85);
  let out = `<path d="${taper(pts, width, { n: 30, capStart: false })}" fill="${c.body}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>`;
  const s = spline(pts, 30);
  for (let i = Math.round(cupsFrom * 30); i < 29; i += 3) {
    const t = i / 30;
    const a = s[i - 1], b = s[i + 1];
    const tg = norm([b[0] - a[0], b[1] - a[1]]);
    const nx = -tg[1] * side, ny = tg[0] * side;
    const w = width(t) / 2;
    const cx = s[i][0] + nx * w * 0.5, cy = s[i][1] + ny * w * 0.5;
    const rr = Math.max(w * 0.34, 2.2);
    const ang = (Math.atan2(tg[1], tg[0]) * 180) / Math.PI;
    out += `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rr)}" ry="${r(rr * 0.78)}" transform="rotate(${r(ang)} ${r(cx)} ${r(cy)})" fill="${c.cup}" stroke="${c.line}" stroke-width="2"/>`;
  }
  return out;
}

const sw = (c) => `stroke="${c.line}" stroke-width="2.6" stroke-linejoin="round"`;

const tools = {
  brush: (c) => `<path d="M-6 46h12v86a6 6 0 0 1-12 0Z" fill="${c.wood}" ${sw(c)}/>
<path d="M-6 112h12v8h-12Z" fill="${c.ver}" ${sw(c)}/>
<path d="M-7.5 30h15v17h-15Z" fill="${c.steel}" ${sw(c)}/>
<path d="M0 -1C-5 8-9 20-7.5 31L7.5 31C9 20 5 8 0-1Z" fill="${c.ink === '#C9C6FF' ? '#2A2770' : c.ink}" ${sw(c)}/>
<path d="M-2.5 24C-3 17-1.5 10 0 6" fill="none" stroke="#8F8BE8" stroke-width="2" stroke-linecap="round"/>`,
  pen: (c) => `<path d="M-7 44h14l-3 92a4 4 0 0 1-8 0Z" fill="${c.ver}" ${sw(c)}/>
<path d="M-3 52v70" stroke="#F58A70" stroke-width="2.4" stroke-linecap="round"/>
<path d="M-8.5 32h17v13h-17Z" fill="${c.steel}" ${sw(c)}/>
<path d="M0 0L-7 17C-8.5 22-8.5 28-8.5 33L8.5 33C8.5 28 8.5 22 7 17Z" fill="${c.gold}" ${sw(c)}/>
<path d="M0 3V20" stroke="${c.line}" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="22" r="2.4" fill="${c.line}"/>`,
  marker: (c) => `<path d="M-4.5 0h9l2.5 11h-14Z" fill="${c.ver}" ${sw(c)}/>
<path d="M-8 10h16v9h-16Z" fill="${c.line}" ${sw(c)}/>
<path d="M-11 18h22v62a4 4 0 0 1-4 4h-14a4 4 0 0 1-4-4Z" fill="${c.cup}" ${sw(c)}/>
<path d="M-11 38h22v18h-22Z" fill="${c.ver}" ${sw(c)}/>
<path d="M-12 78h24v20a6 6 0 0 1-6 6h-12a6 6 0 0 1-6-6Z" fill="${c.ver}" ${sw(c)}/>`,
  pencil: (c) => `<path d="M-9.5 24h19v76h-19Z" fill="${c.amber}" ${sw(c)}/>
<path d="M-3 26v72M3 26v72" stroke="#D99A22" stroke-width="2"/>
<path d="M-10 100h20v12h-20Z" fill="${c.steel}" ${sw(c)}/>
<path d="M-10 112h20v9a5 5 0 0 1-5 5h-10a5 5 0 0 1-5-5Z" fill="#F29A8A" ${sw(c)}/>
<path d="M0 0L-9.5 24L9.5 24Z" fill="${c.woodL}" ${sw(c)}/>
<path d="M0 0L-3.6 9.2L3.6 9.2Z" fill="${c.graphite}" stroke="${c.graphite}" stroke-width="1.5" stroke-linejoin="round"/>`,
};

/** Place a tool so its tip is at tip and it points along dir (unit). */
function placeTool(c, kind, tip, dir) {
  const a = (Math.atan2(dir[0], -dir[1]) * 180) / Math.PI;
  return `<g transform="translate(${r(tip[0])} ${r(tip[1])}) rotate(${r(a)})">${tools[kind](c)}</g>`;
}

/** Tentacle reaching a grip point on a tool, then a curl wrapping over the tool. */
function holder(c, basePts, grip, dir, side, w0 = 34) {
  void dir;
  return tentacle(c, [...basePts, grip], w0, 15, side === 1 ? -1 : 1);
}

function wrap(c, grip, dir, side) {
  const p = [-dir[1] * side, dir[0] * side];
  const q = (a, b) => [grip[0] + p[0] * a + dir[0] * b, grip[1] + p[1] * a + dir[1] * b];
  const pts = [q(-13, 4), q(0, 0), q(13, -3), q(17, -12), q(12, -19)];
  return `<path d="${taper(pts, (t) => 15 - 7 * t, { n: 16 })}" fill="${c.body}" stroke="${c.line}" stroke-width="3.4" stroke-linejoin="round"/>`;
}

function pointedPen(pts, hair, swell, n = 70) {
  // width grows on downstrokes (y increasing)
  return taper(pts, (t, tg) => hair + swell * Math.pow(Math.max(0, tg[1]), 1.6), { n });
}

export function letters(c) {
  let out = '';
  // Brush A (upper left), thick and thin with pressure.
  const brushW = (lo, hi) => (t) => lo + (hi - lo) * Math.pow(Math.sin(Math.PI * Math.min(Math.max(t, 0.02), 0.98)), 0.7);
  out += `<g fill="${c.letter}">`;
  out += `<path d="${taper([[20, 96], [30, 64], [42, 34], [50, 16]], brushW(2.5, 7))}"/>`;
  out += `<path d="${taper([[50, 16], [58, 40], [66, 66], [72, 92]], brushW(3, 15))}"/>`;
  out += `<path d="${taper([[24, 70], [44, 64], [68, 60], [86, 62]], brushW(2, 7.5))}"/>`;
  out += `</g>`;
  // Pointed pen g (upper right).
  out += `<path fill="${c.letter}" d="${pointedPen([[396, 30], [380, 20], [360, 24], [352, 42], [362, 56], [382, 52], [394, 34], [396, 30]], 2.4, 7)}"/>`;
  out += `<path fill="${c.letter}" d="${pointedPen([[396, 26], [397, 60], [394, 90], [378, 106], [356, 104], [350, 92]], 2.4, 7.5)}"/>`;
  out += `<path fill="${c.letter}" d="${pointedPen([[396, 26], [404, 20], [412, 20]], 2, 2)}"/>`;
  // Marker Q (lower left), monoline vermilion.
  out += `<path d="M 66 352 A 30 30 0 1 1 52 330" fill="none" stroke="${c.letter2}" stroke-width="7" stroke-linecap="round"/>`;
  out += `<path d="M 50 372 Q 66 388 84 392" fill="none" stroke="${c.letter2}" stroke-width="7" stroke-linecap="round"/>`;
  // Pencil bezier with handles (lower right).
  const g = c.graphite === '#4A4868' ? '#C9C6FF' : c.graphite;
  out += `<path d="M300 392 C318 352 350 400 372 352" fill="none" stroke="${c.letter}" stroke-width="3.2" stroke-linecap="round"/>`;
  out += `<g stroke="${c.letter2}" stroke-width="2" fill="none"><path d="M300 392L318 352M372 352L350 400"/></g>`;
  out += `<g fill="${c.eye}" stroke="${c.letter2}" stroke-width="2"><circle cx="318" cy="352" r="4"/><circle cx="350" cy="400" r="4"/></g>`;
  out += `<g fill="${c.letter2}"><rect x="295" y="387" width="10" height="10" rx="1.5"/></g>`;
  void g;
  return out;
}

export function quillBody(c, { tools: withTools = true, scale = 1 } = {}) {
  void scale;
  let back = '';
  // bottom curls
  back += tentacle(c, [[196, 240], [190, 290], [176, 322], [172, 348], [188, 358], [202, 346], [196, 334]], 32, 7, 1, 0.25);
  back += tentacle(c, [[226, 240], [232, 290], [248, 320], [254, 346], [240, 360], [224, 352], [228, 338]], 32, 7, -1, 0.25);
  const items = [
    { kind: 'brush', base: [[168, 222], [126, 226], [96, 206], [84, 176]], grip: [86, 148], dir: norm([-0.42, -0.91]), side: 1, len: 52 },
    { kind: 'pen', base: [[252, 222], [294, 226], [324, 206], [336, 176]], grip: [334, 148], dir: norm([0.3, -0.95]), side: -1, len: 50 },
    { kind: 'marker', base: [[178, 246], [146, 276], [112, 290], [90, 300]], grip: [72, 304], dir: norm([-0.5, 0.86]), side: -1, len: 40 },
    { kind: 'pencil', base: [[244, 246], [276, 276], [310, 288], [334, 298]], grip: [352, 302], dir: norm([0.45, 0.89]), side: 1, len: 44 },
  ];
  let mid = '';
  for (const it of items) {
    mid += holder(c, it.base, it.grip, it.dir, it.side);
    if (withTools) {
      const tip = [it.grip[0] + it.dir[0] * it.len, it.grip[1] + it.dir[1] * it.len];
      mid += placeTool(c, it.kind, tip, it.dir);
    }
    mid += wrap(c, it.grip, it.dir, it.side);
  }
  return back + mid + head(c);
}

export function head(c, { cx = 210 } = {}) {
  const dx = cx - 210;
  let h = `<g transform="translate(${dx} 0)">`;
  h += `<path d="M210 66C262 66 300 104 302 158C304 206 284 240 256 254C240 262 226 264 210 264C194 264 180 262 164 254C136 240 116 206 118 158C120 104 158 66 210 66Z" fill="${c.body}" stroke="${c.line}" stroke-width="4.5"/>`;
  h += `<path d="M138 196C146 230 172 250 210 252C248 250 274 230 282 196C276 236 248 258 210 258C172 258 144 236 138 196Z" fill="${c.shade}"/>`;
  h += `<g fill="${c.spot}"><circle cx="146" cy="134" r="9"/><circle cx="134" cy="160" r="5"/><circle cx="278" cy="132" r="7.5"/><circle cx="288" cy="156" r="4.5"/><circle cx="270" cy="112" r="4"/></g>`;
  h += `<path d="M146 112C156 96 172 86 190 82" fill="none" stroke="${c.hi}" stroke-width="7" stroke-linecap="round"/>`;
  // eyes
  for (const ex of [180, 240]) {
    h += `<circle cx="${ex}" cy="172" r="23" fill="${c.eye}" stroke="${c.line}" stroke-width="4"/>`;
    h += `<circle cx="${ex + 4}" cy="168" r="13" fill="${c.line}"/>`;
    h += `<circle cx="${ex}" cy="163" r="5" fill="#fff"/><circle cx="${ex + 9}" cy="173" r="2.2" fill="#fff"/>`;
  }
  // brows
  h += `<path d="M162 140Q176 132 190 138M230 138Q244 132 258 140" fill="none" stroke="${c.line}" stroke-width="4.5" stroke-linecap="round"/>`;
  // cheeks
  h += `<g fill="${c.ver}" opacity=".55"><ellipse cx="150" cy="206" rx="13" ry="8"/><ellipse cx="270" cy="206" rx="13" ry="8"/></g>`;
  // mouth
  h += `<path d="M194 206C198 224 222 224 226 206Z" fill="${c.line}" stroke="${c.line}" stroke-width="3.5" stroke-linejoin="round"/>`;
  h += `<path d="M201 216C206 211 214 211 219 216C214 221 206 221 201 216Z" fill="${c.ver}"/>`;
  // beret
  h += `<path d="M150 98C146 70 176 46 218 44C258 42 284 62 280 86C266 98 178 104 150 98Z" fill="${c.ver}" stroke="${c.line}" stroke-width="4.5" stroke-linejoin="round"/>`;
  h += `<path d="M150 98C178 106 258 102 280 86C282 96 274 102 262 104C222 112 172 112 154 106C150 104 149 101 150 98Z" fill="${c.verD}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>`;
  h += `<path d="M226 45C226 38 230 33 236 31" fill="none" stroke="${c.line}" stroke-width="5" stroke-linecap="round"/>`;
  h += `<path d="M172 70C182 60 196 55 210 53" fill="none" stroke="#F58A70" stroke-width="5" stroke-linecap="round"/>`;
  h += `</g>`;
  return h;
}

export function splats(c) {
  return splat(28, 210, 7, 3, c.letter) + splat(392, 214, 6, 5, c.letter2) + splat(118, 380, 5, 8, c.letter) + splat(300, 54, 4.5, 11, c.letter2) + splat(130, 28, 4, 13, c.letter);
}

export function mascotSVG(mode = 'light') {
  const c = PAL[mode];
  const id = `q${mode[0]}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 452 452" width="452" height="452" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">Quill, the fontsketch mascot: an octopus calligrapher holding a brush, a dip pen, a marker and a pencil, drawing letters in the air</title>
<defs>${sticker(`${id}-s`, c.rim, 5.5, c.shadow, [-16, -16, 452, 452])}</defs>
<g filter="url(#${id}-s)">
${splats(c)}
${letters(c)}
${quillBody(c)}
</g>
</svg>`;
}
void P; void broadNib; void smoothOpen;

export function headSVG(mode = 'light') {
  const c = PAL[mode];
  const id = `h${mode[0]}`;
  // two short tentacle curls peeking under the head
  const curls = tentacle(c, [[176, 240], [168, 272], [150, 290], [132, 284]], 30, 10, 1, 0.4)
    + tentacle(c, [[244, 240], [252, 272], [270, 290], [288, 284]], 30, 10, -1, 0.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="96 14 228 304" width="228" height="304" role="img" aria-labelledby="${id}-t">
<title id="${id}-t">Quill, the fontsketch octopus, wearing a vermilion beret</title>
<defs>${sticker(`${id}-s`, c.rim, 5, c.shadow, [96, 14, 228, 304])}</defs>
<g filter="url(#${id}-s)">${curls}${head(c)}</g>
</svg>`;
}

export function faviconSVG() {
  const head = 'M32 14C46 14 55 24 55 37C55 50 45 59 32 59C19 59 9 50 9 37C9 24 18 14 32 14Z';
  const beret = 'M10 24C8 13 20 6 33 6C45 6 54 12 53 20C46 26 19 27 10 24Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
<title>fontsketch</title>
<g fill="#F7ECD6" stroke="#F7ECD6" stroke-width="8" stroke-linejoin="round"><path d="${head}"/><path d="${beret}"/><path d="M36 7L39 2"/></g>
<path d="${head}" fill="#4440B0" stroke="#1C1A4A" stroke-width="2.6"/>
<path d="M36 7L39 2" stroke="#1C1A4A" stroke-width="3" stroke-linecap="round"/>
<path d="${beret}" fill="#E4472B" stroke="#1C1A4A" stroke-width="2.6" stroke-linejoin="round"/>
<circle cx="23" cy="37" r="7.5" fill="#FFFDF6" stroke="#1C1A4A" stroke-width="2.2"/><circle cx="41" cy="37" r="7.5" fill="#FFFDF6" stroke="#1C1A4A" stroke-width="2.2"/>
<circle cx="24.5" cy="36" r="4.2" fill="#1C1A4A"/><circle cx="42.5" cy="36" r="4.2" fill="#1C1A4A"/>
<circle cx="23.2" cy="34.4" r="1.5" fill="#fff"/><circle cx="41.2" cy="34.4" r="1.5" fill="#fff"/>
<ellipse cx="15" cy="47" rx="3.6" ry="2.2" fill="#E4472B" opacity=".6"/><ellipse cx="49" cy="47" rx="3.6" ry="2.2" fill="#E4472B" opacity=".6"/>
<path d="M27 48Q32 53 37 48" fill="none" stroke="#1C1A4A" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;
}
