<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/banner-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/banner.svg" alt="Banner do fontsketch: Quill, o polvo calígrafo, ao lado do nome fontsketch escrito na própria fonte manuscrita" width="100%">
</picture>

# fontsketch: crie uma fonte com a sua letra, grátis e no navegador

**Desenhe, importe ou escaneie a sua letra e exporte uma fonte TTF, OTF, WOFF ou WOFF2 de verdade. Sem upload e sem cadastro.**

[![versão no npm](https://img.shields.io/npm/v/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![downloads por mês](https://img.shields.io/npm/dm/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![downloads no total](https://img.shields.io/npm/dt/fontsketch.svg)](https://www.npmjs.com/package/fontsketch)
[![CI](https://github.com/kwy404/fontsketch/actions/workflows/ci.yml/badge.svg)](https://github.com/kwy404/fontsketch/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/kwy404/fontsketch/blob/main/LICENSE)
[![tamanho minificado e gzip](https://img.shields.io/bundlephobia/minzip/fontsketch)](https://bundlephobia.com/package/fontsketch)

[English](https://github.com/kwy404/fontsketch/blob/main/README.md) | Português (Brasil)

[Abrir o editor](https://kwy404.github.io/fontsketch/app/) · [Site](https://kwy404.github.io/fontsketch/pt/) · [Guias](https://kwy404.github.io/fontsketch/pt/guias/) · [Galeria](https://kwy404.github.io/fontsketch/gallery/) · [npm](https://www.npmjs.com/package/fontsketch)

</div>

O fontsketch é um **editor de fontes no navegador**, gratuito e de código aberto, e também um compilador de fontes para Node. Escreva as letras com o mouse, o dedo ou uma caneta, importe arquivos SVG ou imprima uma folha manuscrita, preencha e tire uma foto com o celular: o fontsketch endireita a página, vetoriza cada letra e transforma tudo numa fonte que você instala no computador ou usa no seu site. Ele gera o binário da fonte por conta própria, com kerning, letras acentuadas, hinting TrueType automático e eixos de peso variáveis, e roda inteiro no seu aparelho.

O mesmo motor vem como biblioteca e CLI, então você também pode **transformar SVG em fonte**, rodar um **gerador de fonte de ícones** no CI ou criar fontes por código.

## Sumário

- [Recursos](#recursos)
- [Três jeitos de criar uma fonte](#três-jeitos-de-criar-uma-fonte)
- [Capturas de tela](#capturas-de-tela)
- [Começo rápido](#começo-rápido)
- [Linha de comando: fontes de ícones a partir de SVG](#linha-de-comando-fontes-de-ícones-a-partir-de-svg)
- [API para Node e navegador](#api-para-node-e-navegador)
- [Use a sua fonte em um site](#use-a-sua-fonte-em-um-site)
- [Navegadores compatíveis](#navegadores-compatíveis)
- [Perguntas frequentes](#perguntas-frequentes)
- [Mais de kwy404](#mais-de-kwy404)
- [Autor](#autor)
- [Licença](#licença)

## Recursos

<table>
<tr>
<td width="33%" valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/draw.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/draw.svg" width="40" alt="Ícone de traço de pincel"></picture><br><b>Desenho a mão livre</b><br>Traços com uma caneta macia viram contornos suaves e editáveis.</td>
<td width="33%" valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/pen-tool.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/pen-tool.svg" width="40" alt="Ícone de pena com alças bezier"></picture><br><b>Caneta bezier</b><br>Pontos de canto e suaves, alças, guias e espaçamento lateral.</td>
<td width="33%" valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/import-svg.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/import-svg.svg" width="40" alt="Ícone de importar SVG"></picture><br><b>Importar SVG</b><br>Solte arquivos SVG ou cole caminhos direto em um glifo.</td>
</tr>
<tr>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/image-trace.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/image-trace.svg" width="40" alt="Ícone de vetorizar imagem"></picture><br><b>Vetorizar imagens</b><br>Transforme lettering em PNG ou JPG em contornos vetoriais.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/handwriting-sheet.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/handwriting-sheet.svg" width="40" alt="Ícone de folha manuscrita para imprimir"></picture><br><b>Folha manuscrita</b><br>Modelos A4 e Carta (PDF e SVG) com marcadores nos cantos.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/camera.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/camera.svg" width="40" alt="Ícone de câmera do celular"></picture><br><b>Foto do celular</b><br>Perspectiva, luz e células detectadas no aparelho, com nota de confiança por letra.</td>
</tr>
<tr>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/kerning.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/kerning.svg" width="40" alt="Ícone de par de kerning"></picture><br><b>Kerning</b><br>Pares e classes, exportados como kerning OpenType.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/hinting.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/hinting.svg" width="40" alt="Ícone de grade de pixels"></picture><br><b>Hinting</b><br>Hinting TrueType automático, hastes manuais ou nenhum.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/variable-font.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/variable-font.svg" width="40" alt="Ícone de controle de peso variável"></picture><br><b>Fontes variáveis</b><br>Eixo de peso a partir de masters compatíveis, em um só arquivo.</td>
</tr>
<tr>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/export.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/export.svg" width="40" alt="Ícone de exportar fonte"></picture><br><b>Exportação</b><br>TTF, OTF (CFF), WOFF e WOFF2, com o CSS <code>@font-face</code>.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/icon-font.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/icon-font.svg" width="40" alt="Ícone de grade de ícones"></picture><br><b>Fontes de ícones</b><br>Uma CLI que transforma uma pasta de ícones SVG em fonte com classes CSS.</td>
<td valign="top"><picture><source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/dark/autosave.svg"><img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/icons/light/autosave.svg" width="40" alt="Ícone de salvamento automático"></picture><br><b>Salvamento automático</b><br>Projetos salvos no navegador e em arquivos <code>.fontsketch.json</code>.</td>
</tr>
</table>

As letras acentuadas são montadas automaticamente com componentes (a + til = ã), cobrindo Latin-1 Supplement e Latin Extended-A. Português, espanhol, francês, alemão e polonês funcionam sem trabalho extra.

## Três jeitos de criar uma fonte

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/scan-to-font-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/scan-to-font.svg" alt="Foto de uma folha manuscrita sendo endireitada, limpa, separada em células e vetorizada em glifos" width="100%">
</picture>

1. **Desenhe.** Abra o [editor](https://kwy404.github.io/fontsketch/app/) e escreva cada letra com o mouse, o dedo ou uma caneta stylus. Os traços viram contornos limpos que você refina com a caneta bezier. O editor abre com a Quill Hand, uma fonte manuscrita completa, como modelo, ou você começa de uma página em branco.
2. **Importe.** Solte arquivos SVG ou cole caminhos em qualquer glifo, vetorize um PNG ou JPG do seu lettering ou abra uma fonte TTF, OTF, WOFF ou WOFF2 existente e continue editando.
3. **Folha manuscrita.** Imprima o modelo em A4 ou Carta, preencha cada célula com uma caneta escura e tire uma foto com o celular. O fontsketch encontra os quatro marcadores dos cantos, corrige a perspectiva, iguala a iluminação, separa as células e vetoriza cada letra, com uma nota de confiança para você saber o que revisar.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/nib-strokes-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/nib-strokes.svg" alt="Traços feitos com pena de bico chato, pena pontuda, pincel e marcador de traço uniforme" width="100%">
</picture>

## Capturas de tela

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/studio-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/studio.png" alt="O estúdio do fontsketch no site: a letra a desenhada com as guias de altura x e linha de base, ao lado de uma frase ao vivo na fonte Quill Hand" width="100%">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/editor-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/editor.png" alt="O editor de fontes do fontsketch no navegador: grade de letras, a letra A no canvas com as linhas de métrica e as ferramentas de espaçamento, contorno e componentes" width="100%">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/templates-dark.png">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/screenshots/templates.png" alt="Tela inicial do editor: editar a Quill Hand, começar uma fonte em branco, escolher um modelo ou importar fonte, desenhos SVG, imagem ou folha manuscrita" width="100%">
</picture>

## Começo rápido

**No navegador:** abra [kwy404.github.io/fontsketch/app](https://kwy404.github.io/fontsketch/app/). Não precisa instalar nada e seus arquivos não saem do seu aparelho.

**Com npm** (Node 18 ou mais recente):

```bash
npm install fontsketch
```

**Por CDN** com uma tag script (a global é `fontsketch`):

```html
<script src="https://cdn.jsdelivr.net/npm/fontsketch@0.1.0/dist/fontsketch.min.js"></script>
```

## Linha de comando: fontes de ícones a partir de SVG

Transforme uma pasta de ícones SVG numa fonte de ícones. Cada arquivo vira um glifo na Private Use Area (a partir de U+E000), e você recebe arquivos WOFF2, WOFF e TTF, uma folha de estilo com uma classe por ícone e uma página `index.html` de prévia:

```bash
npx fontsketch from-svg ./icons --family Icons -o ./dist
```

```html
<link rel="stylesheet" href="dist/icons.css">
<i class="icon icon-home" aria-hidden="true"></i>
```

Todos os comandos:

| Comando | O que faz |
| --- | --- |
| `fontsketch build <project.fontsketch.json> [-o dir] [--formats ttf,woff2] [--hinting auto\|manual\|none] [--variable] [--outlines truetype\|cff] [--legacy-kern] [--no-css]` | Compila um projeto salvo no editor (ou qualquer arquivo de fonte) em arquivos de fonte e uma folha de estilo `@font-face` |
| `fontsketch from-svg <pasta> --family <nome> [-o dir] [--formats woff2,woff,ttf] [--start E000] [--prefix icon]` | Gerador de fonte de ícones: pasta de SVG para fonte, classes CSS e página de prévia. Um arquivo como `home-uE001.svg` mantém esse código |
| `fontsketch info <fonte> [--json]` | Formato, nomes, métricas, tabelas e recursos de um arquivo TTF, OTF, WOFF ou WOFF2 |
| `fontsketch instance <fonte> --wght 700 [-o arquivo] [--format ttf]` | Instância estática de uma fonte variável em qualquer posição do eixo |

## API para Node e navegador

O pacote funciona no Node 18+ e nos navegadores, sem dependências em tempo de execução. No Node, `import ... from 'fontsketch'` também registra o zlib nativo para WOFF e WOFF2.

```js
import { writeFileSync } from 'node:fs';
import { createFont, addGlyph, circleContour, reverseContour, exportFont, cssFontFace } from 'fontsketch';

const font = createFont({ family: 'Minha Letra', designer: 'Eu' });
addGlyph(font, {
  name: 'o',
  advanceWidth: 520,
  contours: [circleContour(260, 250, 230), reverseContour(circleContour(260, 250, 130))],
});

writeFileSync('minha-letra.woff2', exportFont(font, { format: 'woff2', hinting: 'auto' }));
console.log(cssFontFace(font, '/fonts/minha-letra.woff2'));
```

As fontes são objetos simples, prontos para JSON: 1000 unidades por em, eixo Y para cima, contornos quadráticos TrueType (pontos `{ x, y, on }`), pares e classes de kerning e, opcionalmente, `axes` e `masters` para fontes variáveis. Projetos salvos pelo editor (`.fontsketch.json`) são carregados com `deserialize`.

### Fontes

| Função | Descrição |
| --- | --- |
| `createFont(meta?)` | Fonte nova com `.notdef` e `space`. `meta`: `family`, `style`, `designer`, `license`, `unitsPerEm`, `ascender`, `descender`, `xHeight`, `capHeight` e outros |
| `addGlyph(font, glyph)` | Adiciona ou troca um glifo `{ name, unicodes?, advanceWidth, contours, components?, anchors? }`. O Unicode vem do nome de produção, como `a`, `Atilde` ou `uni0416` |
| `removeGlyph(font, name)` | Remove um glifo e os pares de kerning dele |
| `glyphNameFor(char)` / `unicodeFor(name)` | Nomes de glifo de produção e códigos |
| `compose(font, char)` / `composeAll(font, { chars?, overwrite? })` | Monta letras acentuadas com componentes de base e acento, para Latin-1 Supplement e Latin Extended-A (`PORTUGUESE` lista o conjunto do português) |
| `serialize(font)` / `deserialize(json)` | O formato de projeto `.fontsketch.json` |
| `validateFont(font)` | Lista legível dos problemas que o compilador recusaria |

### Exportar e importar

| Função | Descrição |
| --- | --- |
| `exportFont(font, options?)` | Compila para bytes. `format`: `'ttf'`, `'otf'`, `'woff'` ou `'woff2'`; `hinting`: `'auto'`, `'manual'` ou `'none'`; `variable`: `true` para uma fonte variável a partir de `axes` e `masters`; `outlines`: `'truetype'` ou `'cff'` dentro de WOFF e WOFF2 |
| `exportFontAsync(font, options?)` | O mesmo, carregando antes o codec Brotli para WOFF2 no navegador |
| `parseFont(bytes)` / `parseFontAsync(bytes)` | Lê TTF, OTF, WOFF e WOFF2 de volta para um objeto de fonte editável |
| `cssFontFace(font, url, options?)` | Regra `@font-face` pronta. `url` aceita uma lista de arquivos; opções `family`, `display`, `weight`, `style`, `unicodeRange`, `variable` |
| `unicodeRange(font)` | O `unicode-range` CSS de uma fonte |
| `svgToContours(svg, options?)` | Converte SVG em contornos de glifo ajustados ao em: `{ contours, advanceWidth, warnings }` |

### Fontes variáveis e hinting

| Função | Descrição |
| --- | --- |
| `checkCompatibility(font)` | Mensagens claras para cada glifo de master que não é compatível ponto a ponto com o padrão |
| `interpolate(font, location)` | Uma fonte estática numa posição como `{ wght: 650 }` |
| `namedInstances(font)` | Instâncias de Thin a Black para o eixo de peso |
| `detectZones(font)` / `findStems(contours, axis, maxWidth)` | As zonas e hastes que o hinting automático alinha com a grade de pixels |

### Geometria

`simplify`, `fitCurves`, `fitContour`, `cubicToQuadratic`, `contourFromCubics`, `correctDirection`, `reverseContour`, `removeOverlaps`, `strokeToOutline`, `circleContour`, `transformContours`, `roundContours`, `bounds`, `contourArea` e `pathFromPoints` (caminho SVG para prévias).

### Leitura de letra à mão

Em `fontsketch/scan`, no navegador e no Node. Aceita qualquer objeto no formato `ImageData` (`{ width, height, data }`) ou, no navegador, um `ImageBitmap`, imagem ou canvas. `fontsketch/scan/worker` faz a mesma leitura dentro de um Web Worker.

```js
import { createFont, addGlyph, exportFont } from 'fontsketch';
import { createTemplate, scanSheet } from 'fontsketch/scan';

const sheet = createTemplate({ chars: ['essential', 'portuguese'], pageSize: 'A4' });
// imprima sheet.pdf (bytes) ou sheet.svgPages, escreva à mão e tire uma foto

const result = scanSheet(photo, { template: sheet.template });
const font = createFont({ family: 'Minha Letra' });
for (const glyph of Object.values(result.glyphs)) {
  if (!glyph.empty && glyph.confidence > 0.5) addGlyph(font, glyph);
}
result.rescan('g', { threshold: 0.6 }); // refaz uma letra com outro limiar de tinta
const woff2 = exportFont(font, { format: 'woff2' });
```

| Função | Descrição |
| --- | --- |
| `createTemplate(options?)` | Folha para imprimir com marcadores nos cantos, código da página e linhas guia: `{ pdf, svg, svgPages, template, pages }`. `chars` aceita um texto ou nomes de `CHARSETS` (`essential`, `lowercase`, `uppercase`, `digits`, `punctuation`, `basicLatin`, `portuguese`); também `pageSize` (`'A4'` ou `'Letter'`), `title` e `metrics` |
| `scanSheet(image, { template, threshold?, chars? })` | Acha os marcadores em qualquer rotação, corrige perspectiva e iluminação, remove as guias e vetoriza cada célula: `{ glyphs, warnings, page, rescan(char, options) }`. Cada letra traz `contours`, `advanceWidth`, `confidence` e seus próprios `warnings` |
| `scanSheets(images, options)` | Várias fotos de um modelo com várias páginas, em qualquer ordem, juntas, avisando as páginas que faltam |
| `importImage(image, options?)` | Uma letra, ou um alfabeto inteiro escrito em linhas, a partir de uma foto sem modelo |
| `importSvg(svg, options?)` | Letras a partir de arte em SVG |

### Funções para Node

Disponíveis em `fontsketch` no Node e em `fontsketch/node`:

| Função | Descrição |
| --- | --- |
| `buildProject(project, { out, formats, hinting, variable, outlines, css })` | O mesmo que `fontsketch build`, devolvendo os arquivos gerados |
| `fromSvgFolder(dir, { family, out, formats, start, prefix })` | O mesmo que `fontsketch from-svg`: `{ font, files, icons }` |
| `fontInfo(bytes)` | Formato, nomes, métricas e tabelas de um arquivo de fonte |
| `makeInstance(input, location, options?)` | Instância estática de uma fonte variável |
| `readFontFile(path)` | Lê qualquer arquivo de fonte ou de projeto para um objeto de fonte |

## Use a sua fonte em um site

Exporte em WOFF2 e carregue com `@font-face`. O mesmo CSS funciona em HTML puro, React, Vue, Angular e Next.js.

```css
@font-face {
  font-family: 'Minha Letra';
  src: url('/fonts/minha-letra.woff2') format('woff2');
  font-display: swap;
}

h1 {
  font-family: 'Minha Letra', cursive;
}
```

No **Next.js**, o próprio framework pode servir o arquivo com `next/font/local`:

```js
import localFont from 'next/font/local';

export const minhaLetra = localFont({ src: './fonts/minha-letra.woff2', display: 'swap' });
```

Depois use `className={minhaLetra.className}` em qualquer elemento. Em projetos **React**, **Vue** e **Angular**, coloque a regra `@font-face` na folha de estilo global e use o nome da família.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/glyph-anatomy-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/kwy404/fontsketch@main/assets/illustrations/glyph-anatomy.svg" alt="Anatomia do glifo: ascendente, altura das maiúsculas, altura x, linha de base e descendente em volta das letras Hgx" width="100%">
</picture>

## Navegadores compatíveis

| | Chrome e Edge | Firefox | Safari |
| --- | --- | --- | --- |
| Editor, desenho e exportação | 100+ | 100+ | 15.4+ |
| Foto da folha manuscrita | 100+ | 100+ | 15.4+ |
| Fontes exportadas | qualquer navegador e sistema que leia TTF, OTF, WOFF ou WOFF2 | | |

A biblioteca roda no Node 18.18 ou mais recente e em qualquer navegador moderno. No Node, o WOFF2 usa o Brotli nativo do zlib. No navegador, `exportFontAsync` e `parseFontAsync` carregam uma versão pequena do Brotli em WebAssembly sob demanda, só quando você exporta ou abre WOFF2.

## Perguntas frequentes

### Como criar uma fonte com a minha letra de graça?

Imprima a folha manuscrita do fontsketch, preencha cada célula com uma caneta escura, tire uma foto com o celular e solte no [editor](https://kwy404.github.io/fontsketch/app/). Ele vetoriza cada letra e exporta TTF, OTF ou WOFF2. Passo a passo: [criar fonte com minha letra](https://kwy404.github.io/fontsketch/pt/guias/criar-fonte-com-minha-letra/).

### Dá para criar uma fonte online grátis sem instalar nada?

Sim. O fontsketch é um editor de fontes no navegador: sem cadastro, sem instalação, sem marca d'água e sem upload. Veja [criar fonte online grátis](https://kwy404.github.io/fontsketch/pt/guias/criar-fonte-online-gratis/).

### Como transformar SVG em fonte?

Importe caminhos SVG nos glifos do editor ou rode `npx fontsketch from-svg ./icons --family Icons -o ./dist` para gerar uma fonte de ícones a partir de uma pasta. Veja [transformar SVG em fonte](https://kwy404.github.io/fontsketch/pt/guias/transformar-svg-em-fonte/) e o [gerador de fonte de ícones](https://kwy404.github.io/fontsketch/pt/guias/gerador-de-fonte-de-icones/).

### Quais formatos posso exportar?

TTF (contornos TrueType), OTF (contornos CFF), WOFF e WOFF2, além do trecho `@font-face` pronto. Fontes variáveis com eixo de peso saem a partir de masters compatíveis.

### Posso usar a minha fonte no Cricut Design Space, Canva, Word ou Photoshop?

Sim. Instale o TTF ou OTF no Windows ou no macOS e a fonte aparece em todos os programas que listam as fontes do sistema. Veja [design your own font for Cricut](https://kwy404.github.io/fontsketch/guides/design-your-own-font-for-cricut/) (em inglês).

### De quem são as fontes que eu crio?

Suas. O fontsketch tem licença MIT e não coloca licença nem marca d'água nas suas fontes. Escolha a licença que quiser para elas.

## Mais de kwy404

- [Monsoon](https://kwy404.github.io/monsoon/): framework CSS usado direto do CDN, sem build.
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): atributos HTML reativos para páginas simples.
- [breakhound](https://kwy404.github.io/breakhound/): encontra bugs em qualquer biblioteca JavaScript, sem escrever testes.
- [cookieowl](https://kwy404.github.io/cookieowl/): consentimento de cookies para LGPD e GDPR que bloqueia rastreadores de verdade.
- [installkite](https://kwy404.github.io/installkite/): transforma qualquer site em um PWA instalável e offline.
- [a11ymedic](https://kwy404.github.io/a11ymedic/): verificador de acessibilidade que explica cada problema e a correção.
- [graphemely](https://kwy404.github.io/graphemely/): utilitários de string seguros com emoji.
- [numberparrot](https://kwy404.github.io/numberparrot/): converte números e moedas localizados.
- [edgegoat](https://kwy404.github.io/edgegoat/): entradas de casos extremos para testes em JavaScript.
- [vueleap](https://kwy404.github.io/vueleap/): migra de Vue 2 para Vue 3 com um comando.

## Autor

Criado por **Alexandre Kohler** ([GitHub](https://github.com/kwy404) e [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

O [site](https://kwy404.github.io/fontsketch/pt/) foi feito com [Monsoon](https://kwy404.github.io/monsoon/), e as partes interativas com [Voodoo.js](https://kwy404.github.io/Voodoo.js/).

## Licença

[MIT](https://github.com/kwy404/fontsketch/blob/main/LICENSE). Copyright (c) 2026 Alexandre Kohler. As fontes que você cria com o fontsketch são suas.
