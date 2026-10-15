// Seasonal art for the special dates (see docs/assets/site/seasons.js):
// Quill in costume, three icons and a hanging garland for the hero, per
// season, in light and dark versions. Everything is drawn here as SVG and
// written to assets/seasons/<id>/ and docs/assets/seasons/<id>/.
import { PAL, head } from './mascot.mjs';
import { ICON_THEME } from './icons.mjs';
import { sticker, taper, spline } from './lib.mjs';

export const SEASONS = ['newyear', 'carnival', 'easter', 'valentine', 'junina', 'halloween', 'christmas'];

const K = {
  light: { orange: '#E8892F', orangeD: '#B9601C', glow: '#FFD36B', night: '#2B2350', nightL: '#4A3F86', red: '#C8463A', redD: '#9C2F26', snow: '#FBF7EE', green: '#2F7D5B', greenD: '#1F5A40', teal: '#1F8A8A', magenta: '#C2407A', gold: '#E9B949', straw: '#E3B65C', strawD: '#B98A35', brown: '#8A5A32', pink: '#F2A7B5', rose: '#E2566E', roseD: '#B83A52', mint: '#8FD3B6', sky: '#8DB8E8', lilac: '#B9A3E8', butter: '#F5D978', batInk: '#2B2350', string: '#59558F' },
  dark: { orange: '#F0954A', orangeD: '#C46F2C', glow: '#FFE08A', night: '#3A3170', nightL: '#5C50A8', red: '#E0594C', redD: '#B03C31', snow: '#FBF7EE', green: '#3E9A72', greenD: '#2B7354', teal: '#2FA3A3', magenta: '#DB5A93', gold: '#F0C65C', straw: '#E8C06E', strawD: '#C29545', brown: '#A06B3E', pink: '#F5B5C2', rose: '#F06A82', roseD: '#C94A62', mint: '#9FDEC2', sky: '#9CC4F0', lilac: '#C6B3F0', butter: '#F7DF8A', batInk: '#9C92DA', string: '#B3AFEA' },
};

const ln = (c, w = 4) => `stroke="${c.line}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const heart = (x, y, s) => `M${x} ${y + s * 0.9}C${x - s * 1.3} ${y + s * 0.1} ${x - s * 1.1} ${y - s * 0.95} ${x} ${y - s * 0.35}C${x + s * 1.1} ${y - s * 0.95} ${x + s * 1.3} ${y + s * 0.1} ${x} ${y + s * 0.9}Z`;
const burst = (x, y, rad, colors, w = 3) => {
  let o = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = rad * 0.35, r1 = rad * (i % 2 ? 0.8 : 1);
    o += `<path d="M${(x + Math.cos(a) * r0).toFixed(1)} ${(y + Math.sin(a) * r0).toFixed(1)}L${(x + Math.cos(a) * r1).toFixed(1)} ${(y + Math.sin(a) * r1).toFixed(1)}" stroke="${colors[i % colors.length]}" stroke-width="${w}" stroke-linecap="round"/>`;
    o += `<circle cx="${(x + Math.cos(a) * (r1 + w * 1.6)).toFixed(1)}" cy="${(y + Math.sin(a) * (r1 + w * 1.6)).toFixed(1)}" r="${(w * 0.6).toFixed(1)}" fill="${colors[(i + 1) % colors.length]}"/>`;
  }
  return o;
};
const egg = (x, y, s, fill, stripe, c, rot = 0) => `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x} ${y - s * 1.3}C${x + s * 0.95} ${y - s * 1.3} ${x + s} ${y + s} ${x} ${y + s}C${x - s} ${y + s} ${x - s * 0.95} ${y - s * 1.3} ${x} ${y - s * 1.3}Z" fill="${fill}" ${ln(c, 3)}/><path d="M${x - s * 0.9} ${y - s * 0.05}l${s * 0.3} ${-s * 0.3}l${s * 0.3} ${s * 0.3}l${s * 0.3} ${-s * 0.3}l${s * 0.3} ${s * 0.3}l${s * 0.3} ${-s * 0.3}l${s * 0.3} ${s * 0.3}" fill="none" stroke="${stripe}" stroke-width="${(s * 0.18).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const flame = (x, y, s, c, k) => `<path d="M${x} ${y - s * 1.6}C${x + s * 0.9} ${y - s * 0.7} ${x + s} ${y - s * 0.1} ${x + s * 0.7} ${y + s * 0.4}C${x + s * 0.4} ${y + s * 0.8} ${x - s * 0.4} ${y + s * 0.8} ${x - s * 0.7} ${y + s * 0.4}C${x - s} ${y - s * 0.1} ${x - s * 0.5} ${y - s * 0.6} ${x} ${y - s * 1.6}Z" fill="${k.orange}" ${ln(c, 3)}/><path d="M${x} ${y - s * 0.7}C${x + s * 0.45} ${y - s * 0.2} ${x + s * 0.45} ${y + s * 0.3} ${x} ${y + s * 0.45}C${x - s * 0.45} ${y + s * 0.3} ${x - s * 0.45} ${y - s * 0.2} ${x} ${y - s * 0.7}Z" fill="${k.glow}"/>`;
const pumpkin = (x, y, s, c, k, face = true) => `<g><path d="M${x - s * 0.1} ${y - s * 0.75}c${s * 0.05} ${-s * 0.3} ${s * 0.2} ${-s * 0.45} ${s * 0.35} ${-s * 0.5}" fill="none" stroke="${k.green}" stroke-width="${(s * 0.16).toFixed(1)}" stroke-linecap="round"/>
<ellipse cx="${x}" cy="${y}" rx="${s * 1.15}" ry="${s * 0.85}" fill="${k.orange}" ${ln(c, 3.5)}/>
<ellipse cx="${x}" cy="${y}" rx="${s * 0.62}" ry="${s * 0.85}" fill="none" stroke="${k.orangeD}" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="${s * 0.2}" ry="${s * 0.85}" fill="none" stroke="${k.orangeD}" stroke-width="3"/>
${face ? `<path d="M${x - s * 0.55} ${y - s * 0.1}l${s * 0.2} ${-s * 0.32}l${s * 0.2} ${s * 0.32}ZM${x + s * 0.15} ${y - s * 0.1}l${s * 0.2} ${-s * 0.32}l${s * 0.2} ${s * 0.32}ZM${x - s * 0.6} ${y + s * 0.25}q${s * 0.6} ${s * 0.45} ${s * 1.2} 0l${-s * 0.2} ${s * 0.05}l${-s * 0.2} ${-s * 0.1}l${-s * 0.2} ${s * 0.12}l${-s * 0.2} ${-s * 0.12}l${-s * 0.2} ${s * 0.1}Z" fill="${k.glow}" stroke="${c.line}" stroke-width="2.4" stroke-linejoin="round"/>` : ''}
<ellipse cx="${x}" cy="${y}" rx="${s * 1.15}" ry="${s * 0.85}" fill="none" ${ln(c, 3.5)}/></g>`;
const bat = (x, y, s, fill) => `<path d="M${x} ${y - s * 0.25}c${s * 0.15} ${-s * 0.2} ${s * 0.3} ${-s * 0.1} ${s * 0.35} 0c${s * 0.4} ${-s * 0.35} ${s * 0.9} ${-s * 0.35} ${s * 1.25} ${-s * 0.05}c${-s * 0.3} 0 ${-s * 0.45} ${s * 0.2} ${-s * 0.5} ${s * 0.4}c${-s * 0.2} ${-s * 0.15} ${-s * 0.4} ${-s * 0.1} ${-s * 0.5} ${s * 0.1}c${-s * 0.15} ${-s * 0.1} ${-s * 0.35} ${-s * 0.1} ${-s * 0.6} ${s * 0.2}c${-s * 0.25} ${-s * 0.3} ${-s * 0.45} ${-s * 0.3} ${-s * 0.6} ${-s * 0.2}c${-s * 0.1} ${-s * 0.2} ${-s * 0.3} ${-s * 0.25} ${-s * 0.5} ${-s * 0.1}c${-s * 0.05} ${-s * 0.2} ${-s * 0.2} ${-s * 0.4} ${-s * 0.5} ${-s * 0.4}c${s * 0.35} ${-s * 0.3} ${s * 0.85} ${-s * 0.3} ${s * 1.25} ${s * 0.05}c${s * 0.05} ${-s * 0.1} ${s * 0.2} ${-s * 0.2} ${s * 0.35} 0Z" fill="${fill}"/>`;

// ---------- Quill in costume ----------
// Each costume returns [behind the head, in front of the head].
const COSTUME = {
  halloween: (c, k) => ['', `<path d="M96 92C120 80 300 74 330 86C340 96 300 110 214 112C130 112 80 104 96 92Z" fill="${k.night}" ${ln(c, 4.5)}/>
<path d="M146 92C158 60 176 22 196 -2C208 -16 230 -22 246 -10C232 -4 224 8 228 22C234 46 256 70 276 88C236 98 186 98 146 92Z" fill="${k.night}" ${ln(c, 4.5)}/>
<path d="M156 76C192 84 236 82 266 74L276 88C236 98 186 98 146 92Z" fill="${k.orange}" ${ln(c, 4)}/>
<path d="M200 10C204 2 212 -4 222 -6" fill="none" stroke="${k.nightL}" stroke-width="5" stroke-linecap="round"/>
${pumpkin(92, 280, 40, c, k)}${bat(330, 40, 46, c.line)}${bat(64, 70, 30, c.line)}`],
  christmas: (c, k) => ['', `<path d="M144 104C138 58 174 26 214 26C256 26 288 56 282 100Z" fill="${k.red}" ${ln(c, 4.5)}/>
<path d="M170 96C168 70 178 50 190 40M214 96V34M258 96C260 70 252 50 240 40" fill="none" stroke="${k.redD}" stroke-width="4" stroke-linecap="round"/>
<rect x="136" y="88" width="152" height="28" rx="14" fill="${k.snow}" ${ln(c, 4.5)}/>
<circle cx="214" cy="22" r="17" fill="${k.snow}" ${ln(c, 4.5)}/>
<path d="M134 234C170 262 252 262 288 232L294 254C254 282 168 282 128 256Z" fill="${k.green}" ${ln(c, 4.5)}/>
<path d="M160 254L166 274M196 262L198 280M232 262L230 280M268 252L262 272" stroke="${k.red}" stroke-width="7" stroke-linecap="round"/>
<path d="M238 266L262 326L236 332L218 272Z" fill="${k.green}" ${ln(c, 4.5)}/><path d="M234 300l20 -6M240 316l18 -5" stroke="${k.red}" stroke-width="6" stroke-linecap="round"/>
<g fill="${k.snow}" stroke="${c.line}" stroke-width="2"><circle cx="70" cy="60" r="7"/><circle cx="352" cy="96" r="6"/><circle cx="90" cy="150" r="4.5"/><circle cx="340" cy="200" r="5"/><circle cx="60" cy="230" r="5.5"/></g>`],
  carnival: (c, k) => ['', `<path fill-rule="evenodd" d="M136 170C146 138 192 136 210 156C228 136 274 138 284 170C282 202 250 210 230 196C222 190 216 188 210 188C204 188 198 190 190 196C170 210 138 202 136 170ZM180 151a20 20 0 1 0 0.1 0ZM240 151a20 20 0 1 0 0.1 0Z" fill="${k.teal}" ${ln(c, 4)}/>
<path d="M136 170C146 138 192 136 210 156C228 136 274 138 284 170" fill="none" stroke="${k.gold}" stroke-width="4" stroke-linecap="round"/>
<g ${ln(c, 3)}><path d="M282 158C300 110 330 84 352 76C340 104 316 134 288 168Z" fill="${k.magenta}"/><path d="M286 162C318 128 350 118 370 120C352 140 322 156 290 172Z" fill="${k.gold}"/><path d="M280 152C286 104 302 72 320 56C318 86 304 122 284 162Z" fill="${k.teal}"/></g>
<g ${ln(c, 2)}><rect x="62" y="56" width="12" height="7" rx="1.5" fill="${k.gold}" transform="rotate(24 68 60)"/><rect x="96" y="20" width="11" height="7" rx="1.5" fill="${k.magenta}" transform="rotate(-30 101 23)"/><rect x="330" y="214" width="12" height="7" rx="1.5" fill="${k.teal}" transform="rotate(40 336 217)"/><circle cx="72" cy="214" r="6" fill="${k.magenta}"/><circle cx="356" cy="30" r="5" fill="${k.gold}"/><rect x="58" y="138" width="11" height="7" rx="1.5" fill="${k.teal}" transform="rotate(-12 63 141)"/></g>`],
  junina: (c, k) => ['', `<path d="M90 96C110 76 314 72 334 92C340 104 300 116 212 116C126 116 80 108 90 96Z" fill="${k.straw}" ${ln(c, 4.5)}/>
<path d="M158 94C156 52 178 30 212 30C246 30 268 52 266 94C240 102 184 102 158 94Z" fill="${k.straw}" ${ln(c, 4.5)}/>
<path d="M160 78C190 86 236 86 264 78L266 94C240 102 184 102 158 94Z" fill="${k.red}" ${ln(c, 3.5)}/>
<path d="M120 102l8 -6M150 106l6 -7M276 104l6 -8M306 100l7 -6M190 50l6 -6M236 46l5 -7" stroke="${k.strawD}" stroke-width="3" stroke-linecap="round"/>
<rect x="232" y="50" width="22" height="18" rx="2" fill="${k.sky}" transform="rotate(12 243 59)" ${ln(c, 2.5)}/>
<g transform="translate(332 296)"><path d="M-44 14L40 -6M-40 -6L44 14" stroke="${k.brown}" stroke-width="13" stroke-linecap="round"/><path d="M-44 14L40 -6M-40 -6L44 14" fill="none" stroke="${c.line}" stroke-width="2.5" stroke-linecap="round" opacity=".5"/>${flame(-12, -14, 22, c, k)}${flame(14, -18, 26, c, k)}</g>`],
  valentine: (c, k) => ['', `<path d="M290 282C320 240 300 150 330 96" fill="none" stroke="${c.line}" stroke-width="2.5" stroke-linecap="round"/>
<path d="${heart(332, 52, 46)}" fill="${k.rose}" ${ln(c, 4.5)}/><path d="M308 30C314 22 324 20 332 24" fill="none" stroke="${k.pink}" stroke-width="6" stroke-linecap="round"/><path d="M326 96l6 -6l6 6Z" fill="${k.roseD}" ${ln(c, 2.5)}/>
<g ${ln(c, 2.5)}><path d="${heart(74, 70, 13)}" fill="${k.pink}"/><path d="${heart(96, 204, 9)}" fill="${k.rose}"/><path d="${heart(60, 150, 7)}" fill="${k.rose}"/></g>`],
  easter: (c, k) => [`<path d="M172 70C146 10 146 -34 168 -36C192 -38 204 6 202 62Z" fill="${k.snow}" ${ln(c, 4.5)}/><path d="M176 58C160 18 160 -18 170 -20C182 -22 192 14 192 56Z" fill="${k.pink}"/>
<path d="M250 64C254 6 266 -36 288 -32C310 -28 300 16 272 74Z" fill="${k.snow}" ${ln(c, 4.5)}/><path d="M258 58C264 18 274 -14 284 -14C294 -12 288 22 270 64Z" fill="${k.pink}"/>`, `<g transform="translate(96 288)"><path d="M-30 -18C-30 -70 30 -70 30 -18" fill="none" stroke="${k.brown}" stroke-width="7"/><path d="M-30 -18C-30 -70 30 -70 30 -18" fill="none" stroke="${c.line}" stroke-width="2" opacity=".4"/>
${egg(-16, -20, 14, k.sky, k.snow, c, -14)}${egg(6, -24, 15, k.butter, k.rose, c, 6)}${egg(24, -16, 13, k.mint, k.lilac, c, 18)}
<path d="M-46 -14H46L38 26C36 32 32 36 26 36H-26C-32 36 -36 32 -38 26Z" fill="${k.straw}" ${ln(c, 4)}/><path d="M-42 0H42M-38 16H38M-20 -14V36M0 -14V36M20 -14V36" stroke="${k.strawD}" stroke-width="3"/></g>`],
  newyear: (c, k) => ['', `<path d="M186 54L226 -26L262 46C238 56 210 58 186 54Z" fill="${k.gold}" ${ln(c, 4.5)}/>
<path d="M200 26L246 16M212 2L238 -4" stroke="${k.red}" stroke-width="7" stroke-linecap="round"/>
<circle cx="226" cy="-28" r="10" fill="${k.red}" ${ln(c, 4)}/>
${burst(76, 48, 40, [k.gold, k.red, k.teal])}${burst(346, 92, 30, [k.teal, k.gold, k.magenta])}${burst(66, 200, 22, [k.magenta, k.gold])}`],
};

const NAMES = {
  newyear: 'with a party hat and fireworks', carnival: 'with a feathered carnival mask and confetti', easter: 'with bunny ears and a basket of painted eggs', valentine: 'holding a heart balloon',
  junina: 'with a straw hat next to a small bonfire', halloween: 'in a witch hat with a carved pumpkin and two bats', christmas: 'in a knit hat and a striped scarf in the snow',
};

export function seasonQuillSVG(id, mode = 'light') {
  const c = PAL[mode];
  const k = K[mode];
  const sid = `s${id[0]}${mode[0]}`;
  const tentacle = (pts, w0, w1) => `<path d="${taper(pts, (t) => w0 + (w1 - w0) * t, { n: 24, capStart: false })}" fill="${c.body}" stroke="${c.line}" stroke-width="4" stroke-linejoin="round"/>`;
  const curls = tentacle([[176, 240], [168, 272], [150, 290], [132, 284]], 30, 10) + tentacle([[244, 240], [252, 272], [270, 290], [288, 284]], 30, 10);
  const [back, front] = COSTUME[id](c, k);
  void spline;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 -48 360 384" width="360" height="384" role="img" aria-labelledby="${sid}-t">
<title id="${sid}-t">Quill, the fontsketch octopus, ${NAMES[id]}</title>
<defs>${sticker(`${sid}-s`, c.rim, 5, c.shadow, [30, -48, 360, 384])}</defs>
<g filter="url(#${sid}-s)">${back}${curls}${head(c)}${front}</g>
</svg>`;
}

// ---------- seasonal icons, 48 by 48, in the feature icon style ----------
const L = (c, w = 2.6) => `stroke="${c.line}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const ICONS = {
  halloween: [['Pumpkin', (c, k) => `<path d="M24 12c0-4 2-6 5-7" fill="none" stroke="${k.green}" stroke-width="3" stroke-linecap="round"/><ellipse cx="24" cy="28" rx="18" ry="14" fill="${k.orange}" ${L(c)}/><ellipse cx="24" cy="28" rx="8" ry="14" fill="none" ${L(c, 2)}/><path d="M15 26l3-5 3 5ZM27 26l3-5 3 5Z" fill="${c.line}"/>`],
    ['Bat', (c) => `${bat(24, 26, 30, c.line)}<circle cx="38" cy="10" r="5" fill="${c.fill}" ${L(c, 2)}/>`],
    ['Witch hat', (c, k) => `<path d="M4 38C10 34 38 34 44 38C40 42 8 42 4 38Z" fill="${c.fill}" ${L(c)}/><path d="M14 37C18 26 22 14 30 6C30 14 32 26 34 37Z" fill="${c.fill}" ${L(c)}/><path d="M15 32C21 34 27 34 33 32L34 37C27 38 21 38 14 37Z" fill="${k.orange}" ${L(c, 2)}/>`]],
  christmas: [['Tree', (c, k) => `<path d="M24 4L36 20H30L40 34H8L18 20H12Z" fill="${k.green}" ${L(c)}/><path d="M20 34h8v8h-8Z" fill="${k.brown}" ${L(c)}/><circle cx="20" cy="26" r="2.4" fill="${c.acc}"/><circle cx="29" cy="17" r="2.2" fill="${k.gold}"/><circle cx="31" cy="29" r="2.2" fill="${k.gold}"/>`],
    ['Snowflake', (c) => `<path d="M24 4V44M7 14L41 34M7 34L41 14" ${L(c, 3)}/><path d="M19 8l5 5 5-5M19 40l5-5 5 5M8 21l7-1-3-6M40 27l-7 1 3 6M8 27l7 1-3 6M40 21l-7-1 3-6" fill="none" stroke="${c.acc}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`],
    ['Gift', (c, k) => `<rect x="7" y="18" width="34" height="24" rx="3" fill="${c.fill}" ${L(c)}/><rect x="5" y="12" width="38" height="8" rx="2" fill="${k.red}" ${L(c)}/><path d="M24 12V42" stroke="${k.red}" stroke-width="5"/><path d="M24 12C18 4 12 6 14 10C15 12 20 12 24 12C28 12 33 12 34 10C36 6 30 4 24 12Z" fill="none" ${L(c, 2.4)}/>`]],
  carnival: [['Carnival mask', (c, k) => `<path fill-rule="evenodd" d="M4 22C8 12 20 12 24 18C28 12 40 12 44 22C43 32 34 34 29 30C27 28 25 28 24 28C23 28 21 28 19 30C14 34 5 32 4 22ZM15 17a5 5 0 1 0 .1 0ZM33 17a5 5 0 1 0 .1 0Z" fill="${k.teal}" ${L(c)}/><path d="M42 18C44 10 40 4 36 2" fill="none" stroke="${c.acc}" stroke-width="3" stroke-linecap="round"/>`],
    ['Streamer', (c, k) => `<path d="M6 8C20 4 14 20 26 16C38 12 32 30 42 26" fill="none" stroke="${k.magenta}" stroke-width="4" stroke-linecap="round"/><path d="M6 24C18 22 14 36 26 34C36 32 34 44 42 42" fill="none" stroke="${k.gold}" stroke-width="4" stroke-linecap="round"/><rect x="34" y="6" width="6" height="4" fill="${c.acc}"/><rect x="10" y="38" width="6" height="4" fill="${k.teal}"/>`],
    ['Confetti', (c, k) => `<g ${L(c, 1.8)}><rect x="8" y="10" width="9" height="6" rx="1" fill="${k.gold}" transform="rotate(20 12 13)"/><rect x="28" y="6" width="9" height="6" rx="1" fill="${k.teal}" transform="rotate(-25 32 9)"/><rect x="18" y="26" width="9" height="6" rx="1" fill="${k.magenta}" transform="rotate(35 22 29)"/><rect x="32" y="32" width="9" height="6" rx="1" fill="${c.acc}" transform="rotate(-10 36 35)"/><circle cx="10" cy="36" r="4" fill="${c.fill}"/><circle cx="38" cy="20" r="3.5" fill="${k.gold}"/></g>`]],
  junina: [['Bonfire', (c, k) => `<path d="M6 42L42 34M6 34L42 42" stroke="${k.brown}" stroke-width="5" stroke-linecap="round"/>${flame(24, 26, 10, c, k)}`],
    ['Paper flags', (c, k) => `<path d="M2 8C16 16 32 16 46 8" fill="none" ${L(c, 2)}/><path d="M8 11L10 28L15 23L18 13Z" fill="${c.acc}" ${L(c, 2)}/><path d="M20 14L21 31L26 26L28 14Z" fill="${k.teal}" ${L(c, 2)}/><path d="M32 13L32 30L37 25L40 11Z" fill="${k.gold}" ${L(c, 2)}/>`],
    ['Corn', (c, k) => `<path d="M24 6C32 6 34 20 32 30C30 36 18 36 16 30C14 20 16 6 24 6Z" fill="${k.butter}" ${L(c)}/><path d="M20 12h8M18 18h12M18 24h12M19 30h10M24 8v26" stroke="${k.strawD}" stroke-width="1.6"/><path d="M16 30C10 32 8 40 10 44C16 42 20 38 22 34ZM32 30C38 32 40 40 38 44C32 42 28 38 26 34Z" fill="${k.green}" ${L(c, 2)}/>`]],
  valentine: [['Heart', (c, k) => `<path d="${heart(24, 22, 17)}" fill="${k.rose}" ${L(c)}/><path d="M13 16c2-3 5-4 8-3" fill="none" stroke="${k.pink}" stroke-width="3" stroke-linecap="round"/>`],
    ['Love letter', (c, k) => `<rect x="5" y="12" width="38" height="26" rx="3" fill="${c.paper}" ${L(c)}/><path d="M5 14L24 28L43 14" fill="none" ${L(c)}/><path d="${heart(24, 30, 6)}" fill="${k.rose}" ${L(c, 1.8)}/>`],
    ['Two hearts', (c, k) => `<path d="${heart(17, 22, 11)}" fill="${c.fill}" ${L(c)}/><path d="${heart(31, 28, 11)}" fill="${k.rose}" ${L(c)}/>`]],
  easter: [['Painted egg', (c, k) => egg(24, 26, 14, k.sky, k.butter, c)],
    ['Bunny', (c, k) => `<path d="M17 20C12 8 12 2 16 2C20 2 22 10 21 19ZM31 20C36 8 36 2 32 2C28 2 26 10 27 19Z" fill="${k.snow}" ${L(c, 2.4)}/><circle cx="24" cy="30" r="13" fill="${k.snow}" ${L(c)}/><circle cx="19" cy="28" r="2" fill="${c.line}"/><circle cx="29" cy="28" r="2" fill="${c.line}"/><path d="M22 33l2 2 2-2" fill="${k.pink}" ${L(c, 1.8)}/>`],
    ['Flower', (c, k) => `<g fill="${k.lilac}" ${L(c, 2)}><circle cx="24" cy="12" r="7"/><circle cx="35" cy="20" r="7"/><circle cx="31" cy="32" r="7"/><circle cx="17" cy="32" r="7"/><circle cx="13" cy="20" r="7"/></g><circle cx="24" cy="23" r="6" fill="${k.butter}" ${L(c, 2)}/>`]],
  newyear: [['Fireworks', (c, k) => burst(24, 24, 20, [c.acc, k.gold, k.teal], 2.6)],
    ['Clock at midnight', (c) => `<circle cx="24" cy="26" r="17" fill="${c.paper}" ${L(c)}/><path d="M24 26V13M24 26L21 15" ${L(c, 3)}/><path d="M24 10v2M38 26h2M24 40v2M8 26h2" ${L(c, 2)}/><circle cx="24" cy="26" r="2.5" fill="${c.acc}"/>`],
    ['Star', (c, k) => `<path d="M24 4L29 18L44 18L32 27L37 42L24 33L11 42L16 27L4 18L19 18Z" fill="${k.gold}" ${L(c)}/>`]],
};

export function seasonIconSVG(id, i, mode = 'light') {
  const c = ICON_THEME[mode];
  const [title, fn] = ICONS[id][i];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${title}">${fn(c, K[mode]).replace(/\n/g, '')}</svg>`;
}
export const iconCount = (id) => ICONS[id].length;

// ---------- hero accent: a garland across the top of the hero ----------
const ITEM = {
  halloween: (x, y, i, c, k) => (i % 2 ? `<path d="M${x} ${y}v14" stroke="${k.string}" stroke-width="1.5"/>${bat(x, y + 22, 26, k.batInk)}` : `<path d="M${x} ${y}v10" stroke="${k.string}" stroke-width="1.5"/>${pumpkin(x, y + 26, 14, c, k)}`),
  christmas: (x, y, i, c, k) => `<path d="M${x} ${y}v8" stroke="${k.string}" stroke-width="1.5"/><rect x="${x - 4}" y="${y + 6}" width="8" height="6" rx="1" fill="${k.gold}" ${ln(c, 2)}/><circle cx="${x}" cy="${y + 22}" r="11" fill="${[k.red, k.green, k.gold][i % 3]}" ${ln(c, 2.5)}/><path d="M${x - 6} ${y + 18}q3 -4 7 -4" stroke="${k.snow}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>`,
  carnival: (x, y, i, c, k) => `<path d="M${x} ${y}c${8} 12 ${-8} 22 0 34c8 12 -6 20 0 30" fill="none" stroke="${[k.magenta, k.gold, k.teal][i % 3]}" stroke-width="4" stroke-linecap="round"/><rect x="${x + 8}" y="${y + 18}" width="8" height="5" rx="1" fill="${[k.gold, k.teal, k.magenta][i % 3]}" transform="rotate(${i * 37 % 60 - 30} ${x + 12} ${y + 20})"/>`,
  junina: (x, y, i, c, k) => `<path d="M${x - 14} ${y}L${x - 12} ${y + 34}L${x} ${y + 26}L${x + 12} ${y + 34}L${x + 14} ${y}Z" fill="${[k.red, k.teal, k.gold, k.green, k.magenta][i % 5]}" ${ln(c, 2)}/>`,
  valentine: (x, y, i, c, k) => `<path d="M${x} ${y}v10" stroke="${k.string}" stroke-width="1.5"/><path d="${heart(x, y + 22, 11)}" fill="${i % 2 ? k.pink : k.rose}" ${ln(c, 2.5)}/>`,
  easter: (x, y, i, c, k) => `<path d="M${x} ${y}v8" stroke="${k.string}" stroke-width="1.5"/>${egg(x, y + 24, 10, [k.sky, k.butter, k.mint, k.lilac, k.pink][i % 5], [k.snow, k.rose, k.lilac][i % 3], c)}`,
  newyear: (x, y, i, c, k) => `<path d="M${x} ${y}v${12 + (i % 3) * 8}" stroke="${k.string}" stroke-width="1.5"/><path d="M${x} ${y + 12 + (i % 3) * 8}l3 7h7l-6 4 2 7-6 -4-6 4 2-7-6-4h7Z" fill="${[k.gold, k.snow, k.gold][i % 3]}" ${ln(c, 2)}/>`,
};

export function seasonAccentSVG(id, mode = 'light') {
  const c = PAL[mode];
  const k = K[mode];
  const W = 1200;
  // two sagging strings, items hung along them
  const sag = (x) => 8 + 34 * Math.sin((x / W) * Math.PI * 2 - Math.PI / 2) * 0.5 + 17;
  let d = 'M0 8';
  for (let x = 20; x <= W; x += 20) d += `L${x} ${sag(x).toFixed(1)}`;
  let items = '';
  const n = id === 'junina' ? 26 : 16;
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * W;
    items += ITEM[id](Math.round(x), Math.round(sag(x)), i, c, k);
  }
  const extra = id === 'newyear' ? burst(140, 90, 26, [k.gold, k.red, k.teal], 2.5) + burst(1060, 84, 30, [k.teal, k.gold, k.magenta], 2.5) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 130" width="${W}" height="130" aria-hidden="true"><path d="${d}" fill="none" stroke="${k.string}" stroke-width="2" opacity=".8"/>${items}${extra}</svg>`;
}
