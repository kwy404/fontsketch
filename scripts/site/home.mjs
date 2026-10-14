// The home page (English and Portuguese): the drawing studio hero, the
// three ways to create, the scroll story, the gallery, features, the
// developer section, guides and FAQ.
import { AUTHOR, NPM, REPO, SITE, VERSION, esc } from './layout.mjs';
import { art, guidePath } from './guides.mjs';
import { iconSprite } from './art/icons.mjs';
import { textD } from './art/text.mjs';

const ICON_ORDER = ['draw', 'pen-tool', 'import-svg', 'image-trace', 'handwriting-sheet', 'camera', 'kerning', 'hinting', 'variable-font', 'export', 'icon-font', 'autosave'];

export const HOME = {
  en: {
    title: 'Turn your handwriting into a font: free font maker in the browser | fontsketch',
    description: 'Turn your handwriting into a font, free and in your browser. Draw, import SVG or scan a handwriting sheet, then export TTF, OTF, WOFF2 and variable fonts.',
    kicker: 'Free font maker in your browser',
    h1a: 'Turn your handwriting',
    h1b: 'into a real font',
    lede: 'Write a letter with your mouse, finger or pen and watch it become a real glyph in a real font. Draw, import SVG or scan a handwriting sheet, then export TTF, OTF, WOFF2 and variable fonts. Nothing is uploaded.',
    stageLabel: 'Drawing stage',
    tools: { pen: 'Draw', points: 'Points', erase: 'Erase', undo: 'Undo', clear: 'Clear glyph', weight: 'Pen weight', next: 'Next letter' },
    hintEdit: 'Drawing on the letter adds strokes. Every copy of it in the sentence updates.',
    hintNew: 'Draw the letter, then press Next letter. Letters you have not drawn yet stay in Quill Hand and are marked.',
    sample: 'Sample text',
    sampleDefault: 'Ação! The quick brown fox jumps over the lazy dog, 1234567890.',
    sampleNew: 'fontsketch makes handwriting fonts',
    fontName: 'Quill Hand',
    statusDefault: 'Default font, 171 glyphs, ready',
    newFont: 'Start a new font',
    backDefault: 'Back to Quill Hand',
    openEditor: 'Open in the editor',
    download: 'Download this font',
    projectFile: 'Project file (.fontsketch.json)',
    strip: 'Glyphs: pick one to edit',
    drawn: 'drawn',
    ways: { kicker: 'Three ways in', h2: 'Draw it, import it or write it on paper', items: [
      ['pen-tool', 'Draw in the browser', 'Freehand brush strokes that turn into clean outlines, plus a bezier pen tool with corner and smooth points, guides for x-height, cap height and baseline, and live side bearings.'],
      ['svg-to-glyph', 'Import SVG and images', 'Drop SVG files or paths, or trace a PNG or JPG of your lettering into vectors. Open an existing TTF, OTF, WOFF or WOFF2 font and keep editing it.'],
      ['scan-to-font', 'Scan a handwriting sheet', 'Print the template, fill it with a pen and take a phone photo. fontsketch finds the markers, flattens the page, evens the light, splits the cells and traces every letter.'],
    ] },
    story: { kicker: 'How it works', h2: 'From a sheet of paper to a font file', scenes: [
      ['Scan', 'A phone photo becomes a type case', 'The four corner markers tell fontsketch how the page was tilted. It flattens the perspective, corrects the uneven light, splits the grid into cells and traces each letter into vector outlines.', ['Flatten the perspective', 'Even out the lighting', 'Split the cells', 'Trace into the type case']],
      ['Weight', 'One drawing, every weight', 'Draw a Regular and a Bold master with the same points and fontsketch exports a variable font with a real weight axis. Scroll to move the axis from Thin to Black.', []],
      ['Hinting', 'Crisp at small sizes', 'Automatic TrueType hinting finds the stems and snaps them to the pixel grid, so a 12 pixel paragraph renders sharp instead of blurry.', []],
      ['Kerning', 'Pairs that fit together', 'Kerning pairs and classes pull awkward combinations like AV, To and Wa together, and every accented copy inherits the pair.', []],
      ['Export', 'TTF, OTF and WOFF2 in one click', 'The compiler writes the font binary in your browser: TrueType outlines, CFF outlines, WOFF and Brotli compressed WOFF2, plus a ready @font-face snippet.', []],
    ] },
    weightNames: ['Thin', 'Light', 'Regular', 'Bold', 'Black'],
    gallery: { kicker: 'Gallery', h2: 'Fonts made with fontsketch', lede: 'Every font below was built with the fontsketch engine, from pen strokes, geometric shapes and SVG icons. Type in any tester, then take the files.', more: 'Open the full gallery' },
    features: { kicker: 'Everything in the box', h2: 'A complete font editor in the browser', items: [
      ['Freehand drawing', 'Pressure aware brush strokes become smooth, editable outlines.'],
      ['Bezier pen tool', 'Corner and smooth points, handles, snapping and guides.'],
      ['Import SVG', 'Paste or drop SVG paths straight into a glyph.'],
      ['Image tracing', 'Trace PNG and JPG lettering into vector contours.'],
      ['Handwriting sheet', 'Printable A4 and Letter templates with corner markers.'],
      ['Phone camera scan', 'Perspective, lighting and cell detection, all on device.'],
      ['Kerning', 'Pairs and classes, with live preview strings.'],
      ['Hinting', 'Automatic TrueType hinting, manual stems, or none.'],
      ['Variable fonts', 'Weight axis from compatible masters, one file.'],
      ['Export', 'TTF, OTF, WOFF and WOFF2 plus @font-face CSS.'],
      ['Icon fonts', 'A CLI that turns a folder of SVG icons into a font.'],
      ['Autosave', 'Projects save in your browser and as .fontsketch.json.'],
    ] },
    dev: { kicker: 'For developers', h2: 'A font compiler you can script', lede: 'The same engine runs in Node 18+ and in the browser, with zero runtime dependencies for TTF and OTF. Build fonts in CI, generate icon fonts, or parse existing fonts.', cli: 'Icon font from a folder of SVGs', api: 'Node and browser API' },
    guides: { kicker: 'Guides', h2: 'Learn type design, one guide at a time', all: 'All guides' },
    faq: { kicker: 'FAQ', h2: 'Questions people ask', items: [
      ['How do I turn my handwriting into a font for free?', 'Print the fontsketch handwriting sheet, fill each cell with a dark pen, take a phone photo and drop it into the editor. It flattens the page, traces every letter and lets you export a TTF, OTF or WOFF2 font. Everything is free and runs in your browser.'],
      ['Can I create a font online without installing anything?', 'Yes. fontsketch is a font editor in the browser. Open the editor, draw or import your glyphs and download the font file. There is no account and no install, and your files never leave your device.'],
      ['Can I make a font from SVG files?', 'Yes. Import SVG paths into any glyph in the editor, or run npx fontsketch icons with a folder of SVG icons to generate an icon font with CSS classes.'],
      ['Which font formats can I export?', 'TTF (TrueType outlines), OTF (CFF outlines), WOFF and WOFF2 for the web, plus a ready @font-face CSS snippet. Variable fonts with a weight axis are exported from compatible masters.'],
      ['Does it support accents like ã, ç and é?', 'Yes. Draw the base letters and the marks once, and fontsketch builds accented letters from components, covering Latin-1 Supplement and Latin Extended-A, so Portuguese, Spanish, French, German and Polish text just works.'],
      ['Who owns the fonts I make?', 'You do. fontsketch is MIT licensed open source and adds no license or watermark to your fonts. Choose any license you like for the fonts you create.'],
    ] },
    cta: { h2: 'Your handwriting deserves a font file', text: 'Open the editor with Quill Hand as a template, or start from a blank page.', btn: 'Open the editor', btn2: 'Read the handwriting guide' },
  },
  pt: {
    title: 'Criar fonte com minha letra: criador de fontes grátis no navegador | fontsketch',
    description: 'Crie uma fonte com a sua letra, grátis e no navegador. Desenhe, importe SVG ou escaneie uma folha manuscrita e exporte TTF, OTF, WOFF2 e fontes variáveis.',
    kicker: 'Criador de fontes grátis no navegador',
    h1a: 'Transforme sua letra',
    h1b: 'em uma fonte de verdade',
    lede: 'Escreva uma letra com o mouse, o dedo ou uma caneta e veja ela virar um glifo de verdade em uma fonte de verdade. Desenhe, importe SVG ou escaneie uma folha manuscrita e exporte TTF, OTF, WOFF2 e fontes variáveis. Nada é enviado para servidores.',
    stageLabel: 'Área de desenho',
    tools: { pen: 'Desenhar', points: 'Pontos', erase: 'Apagar', undo: 'Desfazer', clear: 'Limpar glifo', weight: 'Peso da caneta', next: 'Próxima letra' },
    hintEdit: 'Desenhar sobre a letra adiciona traços. Todas as cópias dela na frase são atualizadas.',
    hintNew: 'Desenhe a letra e toque em Próxima letra. As letras que ainda faltam ficam em Quill Hand e aparecem marcadas.',
    sample: 'Texto de exemplo',
    sampleDefault: 'Ação! Coração, pão e açúcar: a fonte é sua, 1234567890.',
    sampleNew: 'fontsketch cria fontes com a sua letra',
    fontName: 'Quill Hand',
    statusDefault: 'Fonte padrão, 171 glifos, pronta',
    newFont: 'Começar uma fonte nova',
    backDefault: 'Voltar para Quill Hand',
    openEditor: 'Abrir no editor',
    download: 'Baixar esta fonte',
    projectFile: 'Arquivo de projeto (.fontsketch.json)',
    strip: 'Glifos: escolha um para editar',
    drawn: 'desenhadas',
    ways: { kicker: 'Três caminhos', h2: 'Desenhe, importe ou escreva no papel', items: [
      ['pen-tool', 'Desenhe no navegador', 'Traços a mão livre que viram contornos limpos, além de uma caneta bezier com pontos de canto e suaves, guias de altura x, altura das maiúsculas e linha de base.'],
      ['svg-to-glyph', 'Importe SVG e imagens', 'Solte arquivos SVG ou caminhos, ou vetorize um PNG ou JPG do seu lettering. Abra uma fonte TTF, OTF, WOFF ou WOFF2 existente e continue editando.'],
      ['scan-to-font', 'Escaneie uma folha manuscrita', 'Imprima o modelo, preencha com caneta e tire uma foto com o celular. O fontsketch acha os marcadores, endireita a página, corrige a luz, separa as células e vetoriza cada letra.'],
    ] },
    story: { kicker: 'Como funciona', h2: 'Da folha de papel ao arquivo de fonte', scenes: [
      ['Escanear', 'Uma foto vira uma caixa de tipos', 'Os quatro marcadores dos cantos mostram como a página estava inclinada. O fontsketch corrige a perspectiva, iguala a luz, separa a grade em células e vetoriza cada letra.', ['Corrigir a perspectiva', 'Igualar a iluminação', 'Separar as células', 'Vetorizar na caixa de tipos']],
      ['Peso', 'Um desenho, todos os pesos', 'Desenhe um master Regular e um Bold com os mesmos pontos e o fontsketch exporta uma fonte variável com um eixo de peso de verdade. Role para ir de Thin a Black.', []],
      ['Hinting', 'Nítida em tamanhos pequenos', 'O hinting TrueType automático encontra as hastes e alinha com a grade de pixels, e um parágrafo em 12 pixels fica nítido em vez de borrado.', []],
      ['Kerning', 'Pares que se encaixam', 'Pares e classes de kerning aproximam combinações difíceis como AV, To e Wa, e toda cópia acentuada herda o par.', []],
      ['Exportar', 'TTF, OTF e WOFF2 em um clique', 'O compilador gera o binário da fonte no navegador: contornos TrueType, contornos CFF, WOFF e WOFF2 com Brotli, além do trecho @font-face pronto.', []],
    ] },
    weightNames: ['Thin', 'Light', 'Regular', 'Bold', 'Black'],
    gallery: { kicker: 'Galeria', h2: 'Fontes feitas com o fontsketch', lede: 'Cada fonte abaixo foi construída com o motor do fontsketch, a partir de traços de caneta, formas geométricas e ícones SVG. Digite em qualquer teste e baixe os arquivos.', more: 'Ver a galeria completa' },
    features: { kicker: 'Tudo incluso', h2: 'Um editor de fontes completo no navegador', items: [
      ['Desenho a mão livre', 'Traços de pincel viram contornos suaves e editáveis.'],
      ['Caneta bezier', 'Pontos de canto e suaves, alças, encaixe e guias.'],
      ['Importar SVG', 'Cole ou solte caminhos SVG direto em um glifo.'],
      ['Vetorizar imagens', 'Transforme lettering em PNG e JPG em contornos.'],
      ['Folha manuscrita', 'Modelos A4 e Carta para imprimir com marcadores.'],
      ['Foto do celular', 'Perspectiva, luz e células detectadas no aparelho.'],
      ['Kerning', 'Pares e classes, com frases de teste ao vivo.'],
      ['Hinting', 'Hinting TrueType automático, hastes manuais ou nenhum.'],
      ['Fontes variáveis', 'Eixo de peso a partir de masters compatíveis.'],
      ['Exportação', 'TTF, OTF, WOFF e WOFF2 com CSS @font-face.'],
      ['Fontes de ícones', 'Uma CLI que transforma uma pasta de SVGs em fonte.'],
      ['Salvamento automático', 'Projetos salvos no navegador e em .fontsketch.json.'],
    ] },
    dev: { kicker: 'Para desenvolvedores', h2: 'Um compilador de fontes programável', lede: 'O mesmo motor roda no Node 18+ e no navegador, sem dependências em tempo de execução para TTF e OTF. Gere fontes no CI, crie fontes de ícones ou leia fontes existentes.', cli: 'Fonte de ícones a partir de uma pasta de SVGs', api: 'API para Node e navegador' },
    guides: { kicker: 'Guias', h2: 'Aprenda a criar fontes, um guia por vez', all: 'Todos os guias' },
    faq: { kicker: 'Perguntas', h2: 'Perguntas frequentes', items: [
      ['Como criar uma fonte com a minha letra de graça?', 'Imprima a folha manuscrita do fontsketch, preencha cada célula com uma caneta escura, tire uma foto com o celular e solte no editor. Ele endireita a página, vetoriza cada letra e exporta TTF, OTF ou WOFF2. Tudo é grátis e roda no navegador.'],
      ['Dá para criar uma fonte online sem instalar nada?', 'Sim. O fontsketch é um editor de fontes no navegador. Abra o editor, desenhe ou importe os glifos e baixe o arquivo. Não tem cadastro nem instalação, e seus arquivos não saem do seu aparelho.'],
      ['Posso transformar SVG em fonte?', 'Sim. Importe caminhos SVG em qualquer glifo no editor, ou rode npx fontsketch icons com uma pasta de ícones SVG para gerar uma fonte de ícones com classes CSS.'],
      ['Quais formatos posso exportar?', 'TTF (contornos TrueType), OTF (contornos CFF), WOFF e WOFF2 para a web, além do CSS @font-face pronto. Fontes variáveis com eixo de peso saem a partir de masters compatíveis.'],
      ['A fonte tem acentos como ã, ç e é?', 'Sim. Desenhe as letras base e os acentos uma vez e o fontsketch monta as letras acentuadas com componentes, cobrindo Latin-1 Supplement e Latin Extended-A. Português, espanhol e francês funcionam direto.'],
      ['De quem são as fontes que eu crio?', 'Suas. O fontsketch é código aberto com licença MIT e não coloca licença nem marca d\'água nas suas fontes. Escolha a licença que quiser para elas.'],
    ] },
    cta: { h2: 'Sua letra merece virar um arquivo de fonte', text: 'Abra o editor com a Quill Hand como modelo, ou comece de uma página em branco.', btn: 'Abrir o editor', btn2: 'Ler o guia da letra à mão' },
  },
};

/** Sheet SVG for the scan scene (4 by 3 cells with Quill Hand letters). */
function sheetSVG() {
  const letters = 'abcdefghijkl';
  let s = '<svg class="sheet-svg" viewBox="0 0 400 300" aria-hidden="true"><rect width="400" height="300" rx="6" fill="#FFFDF6"/>';
  for (const [x, y] of [[10, 10], [374, 10], [10, 274], [374, 274]]) s += `<rect x="${x}" y="${y}" width="16" height="16" fill="#1C1A4A"/>`;
  [...letters].forEach((ch, i) => {
    const c = i % 4, r = Math.floor(i / 4);
    const x = 40 + c * 82, y = 40 + r * 76;
    s += `<rect x="${x}" y="${y}" width="72" height="66" rx="4" fill="none" stroke="#B9B4E6" stroke-width="1.5"/>`;
    s += `<path d="M${x + 6} ${y + 50}h60" stroke="#E9A08F" stroke-width="1.2" stroke-dasharray="3 3"/>`;
    s += `<path d="${textD(ch, 46, x + 36, y + 50, { anchor: 'middle' })}" fill="#2A2770"/>`;
  });
  return `${s}</svg>`;
}

function cellsHTML() {
  return [...'abcdefghijkl'].map((ch, i) => `<span class="cell" style="--i:${i};--c:${i % 4};--r:${Math.floor(i / 4)}"><svg viewBox="0 0 72 66" aria-hidden="true"><path d="${textD(ch, 46, 36, 50, { anchor: 'middle' })}" fill="currentColor"/></svg></span>`).join('');
}

export function homeBody(lang, ctx) {
  const t = HOME[lang];
  const R = ctx.R;
  const pt = lang === 'pt';
  const glyphStrip = ctx.stripChars;
  const order = ['turn-your-handwriting-into-a-font', 'criar-fonte-com-minha-letra', 'create-a-font-online-free', 'criar-fonte-online-gratis', 'make-a-font-from-svg', 'transformar-svg-em-fonte', 'icon-font-generator', 'gerador-de-fonte-de-icones', 'how-to-make-a-font', 'como-criar-uma-fonte', 'variable-font-tutorial', 'design-your-own-font-for-cricut'];
  const guideList = ctx.guides.filter((g) => g.meta.lang === lang).sort((a, b) => (order.indexOf(a.meta.slug) + 1 || 99) - (order.indexOf(b.meta.slug) + 1 || 99)).slice(0, 6);
  return `${iconSprite()}
<section id="studio" class="hero" aria-labelledby="hero-h">
  <div class="hero-paper" aria-hidden="true"></div>
  <div class="hero-head">
    <p class="kicker">${t.kicker}</p>
    <h1 id="hero-h"><span class="h1-a">${t.h1a}</span> <span class="h1-b">${t.h1b}</span></h1>
    <p class="lede">${t.lede}</p>
  </div>
  <div class="studio" id="studio-app" data-mode="edit" data-lang="${lang}">
    <div class="stage-card">
      <div class="stage-bar" role="toolbar" aria-label="${t.stageLabel}">
        <div class="seg" role="group">
          <button type="button" class="tool is-on" data-tool="pen" aria-pressed="true"><svg class="ic" aria-hidden="true"><use href="#i-pen"/></svg><span>${t.tools.pen}</span></button>
          <button type="button" class="tool" data-tool="points" aria-pressed="false"><svg class="ic" aria-hidden="true"><use href="#i-points"/></svg><span>${t.tools.points}</span></button>
          <button type="button" class="tool" data-tool="erase" aria-pressed="false"><svg class="ic" aria-hidden="true"><use href="#i-eraser"/></svg><span>${t.tools.erase}</span></button>
        </div>
        <div class="seg">
          <button type="button" class="tool" data-act="undo" aria-label="${t.tools.undo}" title="${t.tools.undo}"><svg class="ic" aria-hidden="true"><use href="#i-undo"/></svg></button>
          <button type="button" class="tool" data-act="clear" aria-label="${t.tools.clear}" title="${t.tools.clear}"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg></button>
        </div>
        <label class="weight"><span>${t.tools.weight}</span><input type="range" min="28" max="140" value="66" step="1" data-weight aria-label="${t.tools.weight}"></label>
      </div>
      <div class="stage" tabindex="0" aria-describedby="stage-hint">
        <svg id="stage-svg" class="stage-svg" viewBox="-200 -1000 1300 1300" role="img" aria-label="${t.stageLabel}: a"><g class="guides"></g><g class="ink"></g><g class="live"></g><g class="handles"></g></svg>
        <span class="stage-char" aria-hidden="true">a</span>
        <button type="button" class="next-btn btn btn-sm" data-act="next"><span>${t.tools.next}</span><svg class="ic" aria-hidden="true"><use href="#i-next"/></svg></button>
      </div>
      <p class="stage-hint" id="stage-hint" data-edit="${esc(t.hintEdit)}" data-new="${esc(t.hintNew)}">${t.hintEdit}</p>
    </div>
    <div class="spec-card">
      <div class="spec-head"><span class="font-badge" data-font-name>${t.fontName}</span><span class="spec-status" data-status aria-live="polite">${t.statusDefault}</span></div>
      <p class="specimen" data-specimen lang="${pt ? 'pt-BR' : 'en'}">${esc(t.sampleDefault)}</p>
      <label class="sample-field"><span>${t.sample}</span><input type="text" data-sample value="${esc(t.sampleDefault)}" data-default="${esc(t.sampleDefault)}" data-new="${esc(t.sampleNew)}" spellcheck="false" autocomplete="off"></label>
      <div class="strip-wrap"><p class="strip-label" id="strip-label">${t.strip} <span data-progress></span></p><div class="strip" role="group" aria-labelledby="strip-label">${[...glyphStrip].map((c) => `<button type="button" class="g" data-ch="${esc(c)}" aria-pressed="${c === 'a'}">${esc(c)}</button>`).join('')}</div></div>
      <div class="studio-actions">
        <button type="button" class="btn btn-outline" data-act="new" data-label-new="${esc(t.newFont)}" data-label-back="${esc(t.backDefault)}"><svg class="ic" aria-hidden="true"><use href="#i-sparkle"/></svg><span>${t.newFont}</span></button>
        <button type="button" class="btn btn-primary" data-act="editor"><svg class="ic" aria-hidden="true"><use href="#i-pen"/></svg><span>${t.openEditor}</span></button>
        <details class="dl">
          <summary class="btn btn-secondary"><svg class="ic" aria-hidden="true"><use href="#i-download"/></svg><span>${t.download}</span></summary>
          <div class="dl-menu"><button type="button" data-dl="woff2">WOFF2</button><button type="button" data-dl="ttf">TTF</button><button type="button" data-dl="otf">OTF</button><button type="button" data-dl="woff">WOFF</button><button type="button" data-dl="json">${t.projectFile}</button></div>
        </details>
      </div>
    </div>
  </div>
</section>

<section id="ways" class="band" aria-labelledby="ways-h">
  <div class="band-in">
    <p class="kicker">${t.ways.kicker}</p>
    <h2 id="ways-h">${t.ways.h2}</h2>
    <div class="ways">${t.ways.items.map(([a, h, p], i) => `<article class="way"><span class="way-n">${i + 1}</span>${art(R, a, h)}<h3>${h}</h3><p>${p}</p></article>`).join('')}</div>
  </div>
</section>

<section id="story" class="story" aria-labelledby="story-h">
  <div class="band-in story-intro"><p class="kicker">${t.story.kicker}</p><h2 id="story-h">${t.story.h2}</h2></div>
  ${t.story.scenes.map(([k, h, p, steps], i) => `<div class="scene scene-${i + 1}" data-scene="${i + 1}" style="--p:0">
    <div class="scene-sticky">
      <div class="scene-text"><p class="scene-n"><span>${String(i + 1).padStart(2, '0')}</span>${k}</p><h3>${h}</h3><p>${p}</p>${steps.length ? `<ol class="scene-steps">${steps.map((s, j) => `<li style="--j:${j}">${s}</li>`).join('')}</ol>` : ''}</div>
      <div class="scene-vis">${sceneVisual(i, t, ctx.sizes)}</div>
    </div>
  </div>`).join('\n  ')}
</section>

<section id="gallery" class="band band-alt" aria-labelledby="gallery-h">
  <div class="band-in">
    <p class="kicker">${t.gallery.kicker}</p>
    <h2 id="gallery-h">${t.gallery.h2}</h2>
    <p class="lede">${t.gallery.lede}</p>
    ${ctx.galleryCards}
    <p class="more-link"><a class="btn btn-outline" href="${R}gallery/">${t.gallery.more} <svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg></a></p>
  </div>
</section>

<section id="features" class="band" aria-labelledby="features-h">
  <div class="band-in">
    <p class="kicker">${t.features.kicker}</p>
    <h2 id="features-h">${t.features.h2}</h2>
    <ul class="features">${t.features.items.map(([h, p], i) => `<li><svg class="fic" viewBox="0 0 48 48" aria-hidden="true"><use href="#f-${ICON_ORDER[i]}"/></svg><h3>${h}</h3><p>${p}</p></li>`).join('')}</ul>
  </div>
</section>

<section id="developers" class="band band-ink" aria-labelledby="dev-h">
  <div class="band-in dev">
    <div class="dev-text"><p class="kicker">${t.dev.kicker}</p><h2 id="dev-h">${t.dev.h2}</h2><p class="lede">${t.dev.lede}</p>
      <p class="dev-links"><a class="btn btn-primary" href="${NPM}" rel="noopener"><svg class="ic" aria-hidden="true"><use href="#i-npm"/></svg>npm i fontsketch</a><a class="btn btn-ghost" href="${REPO}" rel="noopener"><svg class="ic" aria-hidden="true"><use href="#i-github"/></svg>GitHub</a></p></div>
    <div class="dev-code"><h3 class="code-h">${t.dev.cli}</h3>${ctx.code.cli}<h3 class="code-h">${t.dev.api}</h3>${ctx.code.api}</div>
  </div>
</section>

<section id="guides" class="band" aria-labelledby="guides-h">
  <div class="band-in">
    <p class="kicker">${t.guides.kicker}</p>
    <h2 id="guides-h">${t.guides.h2}</h2>
    <div class="cards">${guideList.map((g) => `<a class="gcard" href="${R}${guidePath(lang, g.meta.slug)}">${art(R, g.meta.art, '')}<span class="gcard-k">${esc(g.meta.keyword)}</span><span class="gcard-t">${esc(g.meta.h1)}</span></a>`).join('')}</div>
    <p class="more-link"><a class="btn btn-outline" href="${R}${pt ? 'pt/guias/' : 'guides/'}">${t.guides.all} <svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg></a></p>
  </div>
</section>

<section id="faq" class="band band-alt" aria-labelledby="faq-h">
  <div class="band-in narrow">
    <p class="kicker">${t.faq.kicker}</p>
    <h2 id="faq-h">${t.faq.h2}</h2>
    <div class="faq">${t.faq.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  </div>
</section>

<section class="cta" aria-labelledby="cta-h">
  <div class="cta-in">
    <span class="art cta-art"><img class="art-l" src="${R}assets/art/quill.svg" width="452" height="452" alt="Quill, the fontsketch octopus calligrapher, holding a brush, a dip pen, a marker and a pencil" loading="lazy"><img class="art-d" src="${R}assets/art/quill-dark.svg" width="452" height="452" alt="" aria-hidden="true" loading="lazy"></span>
    <div><h2 id="cta-h">${t.cta.h2}</h2><p>${t.cta.text}</p><p class="cta-btns"><a class="btn btn-primary btn-lg" href="${R}app/">${t.cta.btn}</a><a class="btn btn-outline btn-lg" href="${R}${pt ? 'pt/guias/criar-fonte-com-minha-letra/' : 'guides/turn-your-handwriting-into-a-font/'}">${t.cta.btn2}</a></p></div>
  </div>
</section>`;
}

function sceneVisual(i, t, sizes = {}) {
  if (i === 0) {
    return `<div class="scan-stage">
      <div class="photo"><div class="photo-sheet">${sheetSVG()}<span class="photo-light"></span></div></div>
      <div class="cells" aria-hidden="true">${cellsHTML()}</div>
      <div class="case" aria-hidden="true">${Array.from({ length: 12 }, (_, k) => `<span class="slot" data-slot="${k}"></span>`).join('')}</div>
    </div>`;
  }
  if (i === 1) {
    return `<div class="weight-stage"><svg class="weight-svg" viewBox="0 -760 2600 1060" aria-hidden="true"><g class="weight-word"></g></svg>
      <div class="axis"><span class="axis-track"><span class="axis-knob"></span></span><span class="axis-labels">${t.weightNames.map((n) => `<span>${n}</span>`).join('')}</span><output class="axis-val">wght 100</output></div></div>`;
  }
  if (i === 2) return `<div class="hint-stage"><canvas class="hint-canvas" width="560" height="420" aria-hidden="true"></canvas><p class="hint-read"><span class="hint-off">no hinting</span><span class="hint-on">hinted</span></p></div>`;
  if (i === 3) {
    return `<div class="kern-stage">${['AV', 'To', 'Wa', 'Ty'].map((pair, k) => `<div class="kern-pair" style="--k:${k}" data-pair="${pair}"><span class="kp-a">${pair[0]}</span><span class="kp-b">${pair[1]}</span><output class="kp-val">0</output></div>`).join('')}</div>`;
  }
  return `<div class="export-stage">${[['TTF', 'TrueType'], ['OTF', 'CFF'], ['WOFF2', 'Brotli']].map(([f, sub], k) => `<div class="xcard" style="--i:${k}"><div class="xface xback" aria-hidden="true"></div><div class="xface xfront"><span class="xaa">Aa</span><strong>${f}</strong><small>${sub}</small><small class="xsize">${sizes[f.toLowerCase()] ? `${(sizes[f.toLowerCase()] / 1024).toFixed(1)} kB` : ''}</small></div></div>`).join('')}</div>`;
}

export function homeJsonLd(lang) {
  const t = HOME[lang];
  const url = lang === 'pt' ? `${SITE}pt/` : SITE;
  return [
    {
      '@type': 'SoftwareApplication',
      name: 'fontsketch',
      description: t.description,
      url,
      applicationCategory: 'DesignApplication',
      applicationSubCategory: 'Font editor',
      operatingSystem: 'Any (web browser), Node.js 18+',
      softwareVersion: VERSION,
      inLanguage: lang === 'pt' ? 'pt-BR' : 'en',
      image: `${SITE}og.png`,
      screenshot: `${SITE}og.png`,
      downloadUrl: NPM,
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.github, sameAs: [AUTHOR.github, AUTHOR.linkedin] },
      featureList: t.features.items.map(([h]) => h).join(', '),
    },
    { '@type': 'WebSite', name: 'fontsketch', url: SITE, inLanguage: ['en', 'pt-BR'] },
    { '@type': 'FAQPage', inLanguage: lang === 'pt' ? 'pt-BR' : 'en', mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
}
