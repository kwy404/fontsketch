// A small Markdown reader for the guide sources: front matter, headings,
// paragraphs, lists, tables, tips and fenced code. Code blocks go through
// the frame() callback so they can be highlighted at build time.
import { esc } from './layout.mjs';

/** Parses the simple YAML front matter used by the guides. */
export function frontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src.replace(/\r\n/g, '\n'));
  if (!m) throw new Error('missing front matter');
  const meta = {};
  let list = null;
  let item = null;
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue;
    const top = /^([a-z0-9_]+):\s*(.*)$/.exec(line);
    if (top) {
      const [, key, value] = top;
      if (value === '') {
        list = meta[key] = [];
        item = null;
      } else {
        list = null;
        meta[key] = /^\[.*\]$/.test(value) ? value.slice(1, -1).split(',').map((v) => v.trim()).filter(Boolean) : value;
      }
      continue;
    }
    const start = /^\s+-\s+([a-z_]+):\s*(.*)$/.exec(line);
    if (start && list) {
      item = { [start[1]]: start[2] };
      list.push(item);
      continue;
    }
    const cont = /^\s+([a-z_]+):\s*(.*)$/.exec(line);
    if (cont && item) item[cont[1]] = cont[2];
  }
  return { meta, body: m[2] };
}

export const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Inline Markdown: code, bold, italic and links. link(href) maps special hrefs. */
export function inline(text, link) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, h) => {
    const { href, external } = link(h.replace(/&amp;/g, '&'));
    return `<a href="${esc(href)}"${external ? ' rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

/**
 * Renders the body to HTML. Returns { html, toc, words }.
 * @param {string} body
 * @param {{ link: (h: string) => { href: string, external?: boolean }, frame: (code: string, lang: string) => string }} ctx
 */
export function render(body, ctx) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let words = 0;
  let i = 0;
  const count = (t) => {
    words += t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  };
  let open = false;
  const closeSection = () => {
    if (open) out.push('</section>');
    open = false;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(ctx.frame(code.join('\n'), fence[1] || 'text'));
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const id = slugify(h[2]);
      count(h[2]);
      if (level === 2) {
        closeSection();
        toc.push({ id, text: h[2] });
        out.push(`<section id="${id}" class="prose-sec"><h2>${inline(h[2], ctx.link)}</h2>`);
        open = true;
      } else out.push(`<h3 id="${id}">${inline(h[2], ctx.link)}</h3>`);
      i++;
      continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const bodyRows = rows.slice(2).map(cells);
      bodyRows.forEach((r) => r.forEach(count));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c, ctx.link)}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, ctx.link)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      count(q.join(' '));
      out.push(`<aside class="tip"><p>${inline(q.join(' '), ctx.link)}</p></aside>`);
      continue;
    }
    if (/^(-|\d+\.)\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^(-|\d+\.)\s+/.test(lines[i])) {
        let t = lines[i++].replace(/^(-|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*(-|\d+\.)\s/.test(lines[i])) t += ` ${lines[i++].trim()}`;
        items.push(t);
      }
      items.forEach(count);
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t, ctx.link)}</li>`).join('')}</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|```|\||>|-\s|\d+\.\s)/.test(lines[i])) para.push(lines[i++]);
    const t = para.join(' ');
    count(t);
    out.push(`<p>${inline(t, ctx.link)}</p>`);
  }
  closeSection();
  return { html: out.join('\n'), toc, words };
}
