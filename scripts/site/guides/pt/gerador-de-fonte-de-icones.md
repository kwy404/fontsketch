---
slug: gerador-de-fonte-de-icones
lang: pt
pair: icon-font-generator
title: Gerador de Fonte de Ícones, de SVG para Fonte com CSS
description: Gerador de fonte de ícones grátis. Transforme uma pasta de ícones SVG em TTF e WOFF2 com classes CSS usando um só comando e códigos da área de uso privado.
h1: Gerador de fonte de ícones, de uma pasta de SVGs para uma fonte web
keyword: gerador de fonte de ícones
art: icon-font
alt: Grade de ícones SVG simples como casa, lupa e coração se transformando num único arquivo de fonte com nomes de classes CSS
time: PT15M
howto: Como gerar uma fonte de ícones a partir de SVGs com o fontsketch
steps:
  - name: Prepare os ícones SVG
    text: Desenhe todos os ícones na mesma prancheta quadrada, converta traços em contornos preenchidos e remova cores, máscaras e transformações.
  - name: Junte tudo numa pasta
    text: Salve todos os ícones como arquivos SVG numa única pasta, com nomes descritivos.
  - name: Verifique o Node
    text: Tenha o Node 18 ou mais recente instalado e rode npx fontsketch --help para ver os comandos disponíveis.
  - name: Gere a fonte de ícones
    text: Rode npx fontsketch icons ./icons --out ./dist para gerar TTF, WOFF2 e um arquivo CSS com uma classe por ícone.
  - name: Use no seu site
    text: Copie a saída para o projeto, inclua o CSS e use as classes geradas no HTML.
  - name: Cuide da acessibilidade
    text: Esconda dos leitores de tela os ícones decorativos e dê um rótulo de texto aos ícones que têm significado.
faq:
  - q: Como transformar ícones SVG em fonte?
    a: Coloque os arquivos SVG numa pasta e rode a linha de comando do fontsketch com o comando icons. Ela gera arquivos TTF e WOFF2 e um CSS que associa cada ícone a uma classe que você usa no HTML.
  - q: Quais códigos Unicode uma fonte de ícones usa?
    a: Os ícones ficam na Área de Uso Privado do Unicode, que começa em U+E000. Esses códigos não têm significado padrão, então nunca conflitam com letras de verdade e os ícones só aparecem onde o seu CSS mandar.
  - q: Por que meus ícones de linha saíram preenchidos ou sumiram?
    a: Fontes só guardam formas preenchidas, e um traço (stroke) não tem espessura dentro de uma fonte. Converta os traços em contornos no programa vetorial antes de gerar a fonte e confira se os furos fazem parte de caminhos compostos.
  - q: Fonte de ícones ainda vale a pena ou é melhor usar SVG?
    a: As duas opções funcionam. A fonte de ícones é simples de usar em qualquer página e herda cor e tamanho do texto, enquanto o SVG inline permite várias cores e facilita a acessibilidade. Para ícones de interface de uma cor só, a fonte continua sendo uma opção prática.
  - q: Fonte de ícones pode ter mais de uma cor?
    a: Não do jeito tradicional. Cada glifo recebe uma única cor da propriedade color do CSS. Para ícones coloridos, use SVG.
related: [transformar-svg-em-fonte, criar-fonte-online-gratis, como-criar-uma-fonte]
---
Um gerador de fonte de ícones transforma uma pasta de ícones SVG numa fonte com CSS, para que cada ícone apareça com uma classe e seja estilizado como texto. Com o fontsketch basta um comando, `npx fontsketch icons ./icons --out ./dist`, que gera TTF e WOFF2 com os ícones na Área de Uso Privado do Unicode e as classes CSS.

## Como funciona uma fonte de ícones

Uma fonte associa caracteres a desenhos. Numa fonte de ícones, em vez de letras, os caracteres apontam para ícones. Como ninguém quer que apareça um coração quando alguém digita uma letra comum, essas fontes usam a **Área de Uso Privado** (Private Use Area) do Unicode, que começa em U+E000. Esses códigos não têm significado oficial, então os ícones só aparecem quando o CSS pede.

O CSS faz duas coisas:

1. Declara a fonte com `@font-face`.
2. Cria uma classe para cada ícone, que insere o código correspondente num pseudoelemento `::before`.

Uma classe típica de ícone tem esta cara. Os nomes exatos do seu projeto estão no CSS gerado, então abra o arquivo para conferir:

```css
.icon::before {
  font-family: "icons";
  font-style: normal;
  font-weight: normal;
  line-height: 1;
}
.icon-home::before { content: "\e001"; }
```

## Prepare os ícones SVG

Fontes de ícones são exigentes com os arquivos de entrada. Arquivo limpo, glifo limpo.

### Use uma grade padrão

Desenhe todos os ícones na mesma prancheta quadrada, por exemplo 24 por 24 ou 16 por 16 unidades, com a mesma margem interna. Ícones feitos em pranchetas de tamanhos diferentes acabam com tamanhos visuais diferentes na fonte. Alinhe as bordas principais a unidades inteiras da grade para que os ícones fiquem nítidos no tamanho pensado.

### Preencha, não use traço

Fontes só guardam contornos preenchidos. Ícones de linha costumam ser feitos com traço no programa vetorial; converta esses traços em contornos antes de exportar. Senão o traço fica sem espessura na fonte e o ícone some ou vira um borrão.

### Uma cor, sem efeitos

Tire preenchimentos de cores diferentes, degradês, transparência, máscaras e filtros. A fonte guarda só a forma, e a cor vem do CSS.

### Caminho composto para os furos

Um anel ou a lente de uma lupa precisam de um furo no meio. Faça a forma externa e a interna num único caminho composto. Um círculo branco empilhado sobre um preto vira um disco sólido na fonte.

### Aplique transformações e limpe

Aplique as transformações, desagrupe o que for desnecessário e apague camadas ocultas. Abra um arquivo num editor de texto: o ideal é ver um ou poucos elementos `path` e nada mais.

Essas regras são as mesmas usadas para letras; o guia [transformar SVG em fonte](guide:transformar-svg-em-fonte) explica cada uma com mais detalhes.

## Gere a fonte pela linha de comando

A CLI faz parte do pacote fontsketch e precisa do Node 18 ou mais recente. Para ver o que ela oferece:

```bash
npx fontsketch --help
```

Para gerar a fonte de ícones a partir de uma pasta de SVGs:

```bash
npx fontsketch icons ./icons --out ./dist
```

A pasta de saída recebe os arquivos TTF e WOFF2 e um CSS com uma classe por ícone. Coloque o comando nos scripts de build do projeto para que a fonte seja gerada de novo sempre que um ícone mudar, e versione os SVGs de origem, não só o resultado, para que qualquer pessoa do time consiga recriar a fonte.

Dê nomes descritivos aos arquivos, como `seta-esquerda.svg` ou `carrinho.svg`. Nomes claros deixam o CSS gerado e o HTML mais fáceis de ler.

## Use a fonte de ícones no projeto

Copie o WOFF2 e o CSS para o projeto e inclua a folha de estilo:

```html
<link rel="stylesheet" href="/dist/icons.css">

<button type="button">
  <span class="icon icon-carrinho" aria-hidden="true"></span>
  Adicionar ao carrinho
</button>
```

Os nomes de classe do exemplo são ilustrativos; use os que estão no CSS gerado. Os ícones se comportam como texto: `font-size` muda o tamanho e `color` muda a cor, inclusive no hover.

Para carregamento, o arquivo que os navegadores usam é o WOFF2. Em fontes de ícones é comum usar `font-display: block`, porque mostrar caracteres substitutos no lugar dos ícones parece defeito.

## Acessibilidade

Fontes de ícones inserem caracteres, e leitores de tela podem tentar ler esses caracteres. Duas regras resolvem a maioria dos casos:

- **Ícones decorativos** ao lado de um texto visível: coloque `aria-hidden="true"` no elemento do ícone, como no botão acima.
- **Ícones com significado** sem texto visível, como um botão só com a lupa: esconda o ícone e dê um nome acessível ao botão com `aria-label` ou com texto visualmente oculto.

```html
<button type="button" aria-label="Buscar">
  <span class="icon icon-busca" aria-hidden="true"></span>
</button>
```

Lembre também que algumas pessoas substituem as fontes das páginas para ler melhor. Para elas, uma fonte de ícones pode aparecer como quadradinhos vazios, mais um motivo para acompanhar ícones importantes com texto.

## Tamanho, alinhamento e cache

- Use `display: inline-block` e `line-height: 1` para o ícone não esticar a linha.
- Ajuste `vertical-align` olhando o ícone ao lado do texto do seu site.
- Use tamanhos múltiplos da grade: ícones desenhados em 24 unidades ficam mais nítidos em 24 px e 48 px.
- Ao adicionar ou trocar ícones, mude o nome do arquivo ou acrescente uma versão na URL do CSS, porque navegadores guardam fontes em cache por muito tempo.
- Não reaproveite um código Unicode para outro ícone entre versões. Uma fonte antiga em cache com um CSS novo mostraria o ícone errado.

## Fonte de ícones ou SVG?

| Necessidade | Melhor opção |
| --- | --- |
| Ícones de uma cor, estilizados como texto | Fonte de ícones |
| Uso simples, só com classes CSS | Fonte de ícones |
| Ícones coloridos ou com degradê | SVG |
| Animar partes de um ícone | SVG |
| Controle máximo de acessibilidade | SVG |

Muitos projetos usam as duas coisas: fonte de ícones para os ícones comuns da interface e SVG inline para ilustrações.

Ícones normalmente aparecem em poucos tamanhos fixos. Desenhar na grade certa dá resultado mais nítido do que depender de hinting, e exportar sem hinting deixa o arquivo menor.

## Checklist da fonte de ícones

- Todos os ícones na mesma prancheta quadrada, com a mesma margem
- Traços convertidos em contornos preenchidos
- Uma cor só, sem degradês, máscaras ou filtros
- Furos feitos com caminho composto
- Transformações aplicadas e arquivos limpos
- Geração da fonte incluída nos scripts de build
- Ícones decorativos escondidos dos leitores de tela e ícones com significado rotulados

## Próximos passos

Rode `npx fontsketch --help` e depois aponte o comando icons para a sua pasta de SVGs. Se precisar ajustar um glifo à mão, abra a fonte no [editor do fontsketch](app:). Quer criar uma fonte de letras em vez de ícones? Comece por [como criar uma fonte](guide:como-criar-uma-fonte) ou pelo guia [criar fonte online grátis](guide:criar-fonte-online-gratis).
