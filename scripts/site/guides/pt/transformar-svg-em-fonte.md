---
slug: transformar-svg-em-fonte
lang: pt
pair: make-a-font-from-svg
title: Transformar SVG em Fonte, Passo a Passo e Grátis
description: Aprenda a transformar SVG em fonte no navegador. Prepare os caminhos, importe cada letra, ajuste métricas e espaçamento e exporte em TTF, OTF ou WOFF2 grátis.
h1: Como transformar arquivos SVG em fonte
keyword: transformar svg em fonte
art: svg-to-glyph
alt: Letra R em SVG com seus pontos de caminho sendo encaixados numa grade de glifo com linha de base e altura das maiúsculas
time: PT40M
howto: Como converter arquivos SVG em fonte com o fontsketch
steps:
  - name: Prepare os arquivos SVG
    text: Converta traços e textos em contornos preenchidos, aplique as transformações e remova máscaras, degradês e camadas ocultas.
  - name: Use a mesma prancheta para todas as letras
    text: Desenhe todas as letras numa prancheta da mesma altura, com a linha de base sempre na mesma posição.
  - name: Importe no fontsketch
    text: Abra o editor e importe cada arquivo SVG, ou cole o caminho SVG, no caractere correspondente.
  - name: Alinhe às métricas
    text: Confira se cada glifo está apoiado na linha de base e se bate com a altura de x ou das maiúsculas no eme de 1000 unidades.
  - name: Limpe os contornos e espace
    text: Remova sobreposições, corrija a direção dos contornos e ajuste as margens laterais e o kerning.
  - name: Exporte a fonte
    text: Baixe TTF ou OTF para o computador ou WOFF2 com o CSS @font-face pronto para a web.
faq:
  - q: Como converter SVG em fonte de graça?
    a: Importe os arquivos SVG no fontsketch, um por caractere, ajuste métricas e espaçamento e exporte em TTF, OTF, WOFF ou WOFF2. É gratuito e roda no navegador, sem enviar os arquivos para servidor.
  - q: Por que minha letra em SVG aparece fininha ou some na fonte?
    a: Fontes só guardam formas preenchidas. Se a letra foi desenhada com traço (stroke) e sem preenchimento, converta o traço em contorno no seu programa vetorial antes de exportar o SVG.
  - q: Por que o miolo da letra O ficou preenchido?
    a: O contorno interno está na mesma direção do externo, ou as duas formas foram desenhadas separadas. Use a correção de direção dos contornos no fontsketch e, na origem, junte as formas num caminho composto.
  - q: Dá para transformar ícones SVG em fonte?
    a: Dá. Para ícones, a linha de comando do fontsketch transforma uma pasta inteira de SVGs numa fonte de ícones com TTF, WOFF2 e classes CSS, o que é mais rápido que importar um por um.
  - q: Qual tamanho devo usar nos SVGs?
    a: O tamanho absoluto importa menos que a consistência. Use a mesma altura de prancheta em todas as letras e, se possível, faça 1000 unidades do SVG corresponderem ao eme inteiro da fonte.
related: [gerador-de-fonte-de-icones, como-criar-uma-fonte, criar-fonte-online-gratis]
---
Para transformar SVG em fonte, prepare cada letra como um caminho preenchido numa prancheta padronizada, importe os SVGs num editor de fontes, alinhe à linha de base e às métricas, ajuste o espaçamento e exporte. No fontsketch isso acontece no navegador: você importa arquivos SVG ou cola caminhos, limpa os contornos e baixa TTF, OTF, WOFF ou WOFF2.

## Por que começar pelo SVG

Se você já faz lettering ou desenha letras num programa vetorial, o SVG é o caminho mais direto para uma fonte. Os caminhos já são curvas, então não há vetorização nem perda de detalhe. Um contorno de fonte e um caminho SVG são parentes próximos: os dois descrevem formas com retas e curvas bézier. As diferenças estão no sistema de coordenadas e em algumas regras sobre o que uma fonte aceita.

## Prepare bem os arquivos

A maioria dos problemas na conversão de SVG para fonte vem do arquivo de origem. Dez minutos aqui economizam uma hora depois.

### Só formas preenchidas sobrevivem

Um glifo é um conjunto de contornos fechados e preenchidos. Não existe espessura de traço dentro de uma fonte. Se a sua letra foi feita com traço (stroke) e sem preenchimento, a fonte enxerga uma linha de espessura zero e a letra some ou vira um fio. No programa vetorial, use o comando que converte traço em contorno (algo como contornar traçado ou traço para caminho) antes de exportar.

O mesmo vale para texto editável: converta em contornos.

### Tire o que a fonte ignora

- **Degradês, cores e transparência**: fontes são de uma cor só, então tudo isso é descartado.
- **Máscaras de recorte**: a parte escondida pode voltar. Faça a operação de forma de verdade.
- **Camadas ocultas e guias**: apague antes de exportar.
- **Imagens embutidas**: um bitmap dentro do SVG não é vetor. Vetorize ou redesenhe.

### Aplique as transformações

Programas vetoriais costumam guardar rotação, escala e grupos aninhados como transformações. Expandir ou aplicar as transformações deixa coordenadas simples e evita surpresas.

### Use caminho composto para os miolos

Letras como o, a, e, B e R têm espaços internos, chamados contraformas. No SVG, a forma externa e o furo precisam fazer parte do mesmo caminho composto. Um círculo branco por cima de um preto parece certo na tela, mas vira duas bolas sólidas na fonte.

## Padronize a prancheta

Fontes medem tudo em **unidades por eme**, e o fontsketch usa 1000. Fica muito mais fácil se os seus SVGs seguirem a mesma lógica:

- Crie uma prancheta com 1000 unidades de altura para cada letra, ou um modelo compartilhado.
- Decida onde fica a linha de base, por exemplo a 800 unidades do topo, deixando 200 para as descendentes.
- Desenhe todas as letras apoiadas nessa linha.
- Mantenha a altura de x e a altura das maiúsculas como guias no modelo.

O segredo é a **consistência**. Se uma letra sai de uma prancheta de 500 pixels e outra de uma de 1200, elas chegam em escalas diferentes.

> Dica: no SVG as coordenadas crescem para baixo e na fonte crescem para cima. Você não precisa inverter nada. Basta manter a linha de base no mesmo lugar em todas as pranchetas.

## Configure a exportação no programa vetorial

Algumas escolhas na hora de exportar deixam os arquivos limpos e previsíveis:

- **Um arquivo por letra**, ou uma prancheta por letra, em vez do alfabeto inteiro num SVG só.
- **Atributos de apresentação ou estilos inline** em vez de folhas de estilo externas.
- **Precisão decimal razoável**, duas ou três casas. Mais que isso só aumenta o arquivo.
- **Tamanho fixo**, sem dimensões responsivas ou em porcentagem.
- **Nome do arquivo pelo caractere**, como `a.svg`, `A_maiuscula.svg` ou `cedilha.svg`. Lembre que alguns sistemas tratam a.svg e A.svg como o mesmo nome.

Abra um arquivo exportado num editor de texto. Uma letra limpa costuma ser um único elemento `path` com o atributo `d`, talvez dois ou três em letras com partes separadas, como i e j. Se aparecerem grupos dentro de grupos, transformações, máscaras ou imagens, volte e simplifique.

## Importe no fontsketch

Abra o [editor do fontsketch](app:), selecione o caractere e importe o SVG daquela letra, ou cole os dados do caminho. O contorno vira um glifo editável, com todas as ferramentas de desenho disponíveis.

Depois de importar, confira cada glifo:

- Está apoiado exatamente na linha de base?
- As minúsculas chegam na altura de x?
- As maiúsculas chegam na altura das maiúsculas?
- As letras redondas, como o e c, ultrapassam levemente, umas 10 a 15 unidades?

Se um grupo inteiro de letras estiver deslocado do mesmo jeito, corrija o modelo e exporte de novo em vez de mexer glifo por glifo.

## Limpe os contornos

Mesmo SVGs bem feitos se beneficiam de uma revisão rápida:

- **Remoção de sobreposição** une formas que se cruzam, como a barra do t sobre a haste. Contornos sobrepostos podem gerar defeitos em tamanhos pequenos e aumentam o arquivo.
- **Correção da direção dos contornos** garante que contornos externos e contraformas girem em sentidos opostos, para que os furos continuem furos.
- **Simplificar** reduz o número de pontos. Programas vetoriais às vezes exportam dezenas de nós redundantes; menos pontos significam curvas mais suaves.

## Espaçamento, acentos e kerning

Arquivos SVG não trazem informação de espaçamento, então isso é feito no fontsketch. Ajuste as margens laterais até uma sequência como *Hamburgefonstiv* ficar equilibrada, e depois crie pares de kerning para o que ainda parecer estranho. O guia [como criar uma fonte](guide:como-criar-uma-fonte) explica o método de espaçamento com n, o, H e O.

Para os acentos, importe ou desenhe os sinais uma vez só, e o fontsketch monta é, ã, ô e ç a partir de componentes.

## Exporte a fonte

| Destino | Formato |
| --- | --- |
| Programas no Windows ou Mac | TTF ou OTF |
| Sites | WOFF2, com o CSS gerado pelo fontsketch |
| Navegadores antigos | WOFF |

Se o que você tem é uma pasta de ícones e não um alfabeto, use a linha de comando descrita no [gerador de fonte de ícones](guide:gerador-de-fonte-de-icones), que cuida dos códigos Unicode e das classes CSS para você.

## Checklist de preparação

- Traços e textos convertidos em contornos
- Sem degradês, máscaras, camadas ocultas ou imagens embutidas
- Transformações aplicadas
- Contraformas feitas com caminho composto
- Mesma prancheta e mesma linha de base em todas as letras
- Depois de importar: sobreposições removidas, direções corrigidas, pontos simplificados

## Próximos passos

Importe as primeiras letras no [editor do fontsketch](app:) e confira a linha de base antes de converter o resto. Se você ainda não tem letras vetoriais, veja as outras formas de criar glifos em [criar fonte online grátis](guide:criar-fonte-online-gratis).
