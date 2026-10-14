---
slug: como-criar-uma-fonte
lang: pt
pair: how-to-make-a-font
title: Como Criar uma Fonte do Zero, Guia Completo
description: Como criar uma fonte do zero, passo a passo. Planeje os caracteres, defina métricas, desenhe letras consistentes, ajuste espaçamento e kerning e exporte.
h1: Como criar uma fonte, da primeira letra ao arquivo pronto
keyword: como criar uma fonte
art: metrics-ruler
alt: As letras H, n, o e p sobre uma régua com linha de base, altura de x, altura das maiúsculas, ascendente e descendente marcadas
time: PT3H
howto: Como criar uma fonte do zero com o fontsketch
steps:
  - name: Defina o objetivo e os caracteres
    text: Decida para que serve a fonte e liste todos os caracteres necessários, incluindo pontuação, algarismos e letras acentuadas.
  - name: Defina as métricas
    text: No eme de 1000 unidades, escolha altura de x, altura das maiúsculas, ascendente e descendente adequadas ao estilo.
  - name: Desenhe as letras de controle
    text: Comece por n, o, H e O para fixar a espessura das hastes, as curvas, a ultrapassagem e as proporções.
  - name: Construa o resto do alfabeto
    text: Derive as outras letras das letras de controle, reaproveitando hastes, bojos e terminais.
  - name: Ajuste espaçamento e kerning
    text: Acerte as margens laterais com sequências como nnonnoon e depois crie pares e classes de kerning.
  - name: Teste em texto de verdade
    text: Exporte, instale e componha parágrafos em vários tamanhos, corrija o que incomodar e repita.
  - name: Exporte os arquivos finais
    text: Gere TTF ou OTF para o computador e WOFF2 com CSS para a web, com o hinting adequado.
faq:
  - q: Quanto tempo leva para criar uma fonte?
    a: Uma fonte com a sua letra pode ficar pronta em menos de uma hora. Uma fonte decorativa bem desenhada com o alfabeto latino básico costuma levar alguns dias, e uma família para texto com vários pesos pode levar meses.
  - q: Preciso saber desenhar para criar uma fonte?
    a: Não muito. Dá para escanear a própria letra, vetorizar um lettering que é seu ou montar letras geométricas com formas simples usando a caneta bézier. O que mais pesa é a consistência e o espaçamento, que você aprende testando.
  - q: Por quais letras devo começar?
    a: Comece por n e o nas minúsculas e H e O nas maiúsculas. Elas definem a espessura das hastes, o peso das curvas, a ultrapassagem e o espaçamento, e a maioria das outras letras nasce delas.
  - q: Quantos caracteres uma fonte precisa ter?
    a: Para português, o alfabeto completo em maiúsculas e minúsculas, algarismos, pontuação e as letras acentuadas. No fontsketch os acentos são montados automaticamente a partir das letras base e dos sinais.
  - q: Dá para criar uma fonte sem pagar por programa?
    a: Dá. O fontsketch é gratuito e de código aberto e cobre desenho, importação, espaçamento, kerning, hinting e exportação em TTF, OTF, WOFF e WOFF2.
related: [criar-fonte-online-gratis, criar-fonte-com-minha-letra, transformar-svg-em-fonte]
---
Para criar uma fonte, defina o objetivo, liste os caracteres, escolha as métricas como altura de x e altura das maiúsculas, desenhe algumas letras de controle, construa o resto a partir delas e depois ajuste espaçamento e kerning, teste e exporte. Tudo isso pode ser feito de graça no fontsketch, um editor de fontes no navegador.

Este guia é o caminho completo para iniciantes. Em vários pontos há links para guias mais detalhados.

## 1. Defina para que serve a fonte

O objetivo orienta todas as decisões seguintes. Uma fonte para textos longos precisa de formas abertas, altura de x generosa e espaçamento tranquilo. Uma fonte para títulos de cartaz pode ser ousada e mais apertada. Uma fonte de caligrafia precisa parecer natural. Uma fonte de ícones segue regras completamente diferentes.

Escreva uma frase descrevendo o uso, por exemplo: *uma fonte arredondada e simpática para os títulos do site da minha confeitaria*. Deixe essa frase à vista enquanto trabalha.

## 2. Planeje o conjunto de caracteres

Liste os caracteres antes de desenhar para não descobrir que faltou o apóstrofo depois de publicar.

| Grupo | Caracteres |
| --- | --- |
| Maiúsculas | A a Z |
| Minúsculas | a a z |
| Algarismos | 0 a 9 |
| Pontuação | ponto, vírgula, dois pontos, aspas, interrogação, exclamação, parênteses, hífen |
| Símbolos | @ & % R$ e barra |
| Acentuadas | montadas a partir das letras base e dos sinais |

Para português você precisa de á, à, â, ã, é, ê, í, ó, ô, õ, ú e ç, além das maiúsculas correspondentes. No fontsketch basta desenhar os sinais (agudo, grave, circunflexo, til, trema, cedilha) e as letras acentuadas são montadas como componentes. A cobertura vai do Latin-1 Supplement ao Latin Extended-A.

## 3. Escolha as métricas

O fontsketch usa **1000 unidades por eme**. Nesse espaço você define:

- **Linha de base** em 0, onde as letras se apoiam
- **Altura de x**, a altura das minúsculas sem hastes, normalmente entre 450 e 550
- **Altura das maiúsculas**, normalmente entre 650 e 720
- **Ascendente**, o topo de b, d, h, k e l, muitas vezes um pouco acima das maiúsculas
- **Descendente**, a base de g, j, p, q e y, em torno de menos 200

Altura de x grande facilita a leitura em tamanhos pequenos. Altura de x pequena dá um ar mais clássico. Ascendente e descendente também influenciam o entrelinhamento padrão em muitos programas, então evite valores extremos.

## 4. Desenhe as letras de controle

Designers de tipos começam por poucas letras que carregam o DNA da fonte inteira:

- **n**: espessura da haste, o arco e a junção do ombro
- **o**: espessura das curvas, ultrapassagem e forma das letras redondas
- **H**: haste e barra das maiúsculas
- **O**: forma redonda das maiúsculas

Acerte essas quatro antes de seguir. Alguns princípios:

- **Hastes**: as verticais das minúsculas devem ter a mesma espessura; as maiúsculas costumam ser um pouco mais pesadas.
- **Correção óptica**: traços horizontais parecem mais grossos que verticais da mesma espessura, por isso as barras são desenhadas um pouco mais finas.
- **Ultrapassagem**: letras redondas e pontudas passam de 10 a 15 unidades da linha de base e da altura de x, senão parecem menores.
- **Contraformas**: os espaços internos das letras devem parecer equilibrados entre si. O leitor percebe o branco tanto quanto o preto.

Você pode desenhar com a caneta bézier, importar SVG, vetorizar imagens ou escanear a sua letra. O guia [criar fonte online grátis](guide:criar-fonte-online-gratis) mostra cada caminho, e se você já tem desenhos vetoriais, veja [transformar SVG em fonte](guide:transformar-svg-em-fonte).

## 5. Construa o resto a partir das partes

A maioria das letras compartilha partes com as letras de controle:

- Do **n**: h, m, u (girado) e r
- Do **o**: c, e, b, d, p e q
- Do **H**: E, F, I, L e T
- Do **O**: C, G e Q

Copie e adapte em vez de redesenhar do zero. A consistência é o que faz uma fonte parecer intencional. Desenhe os algarismos com a mesma lógica de traço, com altura próxima à das maiúsculas.

## 6. Limpe os contornos

Antes do espaçamento, revise cada glifo:

- **Remoção de sobreposição**, para que traços que se cruzam virem um contorno só
- **Correção da direção dos contornos**, para que as contraformas fiquem vazadas
- **Simplificar** contornos vetorizados ou bagunçados, para curvas suaves com poucos pontos
- Pontos nos extremos das curvas, com alças horizontais ou verticais

## 7. Espaçamento vem antes do kerning

Espaçamento é a distância embutida em cada glifo pelas **margens laterais**. Kerning é uma correção para pares específicos. Sempre espace primeiro.

Um método clássico:

1. Ajuste as margens do **n** até *nnnnn* ficar regular.
2. Ajuste o **o** até *nonono* ficar regular. Lados redondos precisam de menos espaço que lados retos.
3. Espace as outras minúsculas entre n e o, por exemplo *nanbncndn*.
4. Repita com **H** e **O** para as maiúsculas: *HHOHHOOH*.

Depois crie pares de kerning para o que o espaçamento não resolve: AV, Te, To, Vo, LT, P seguido de ponto, aspas ao lado de letras. Classes permitem ajustar grupos de uma vez, como todas as minúsculas redondas depois do T. Em português vale testar palavras como *Você*, *Távola*, *Ypê* e *LTDA.*

## 8. Teste em texto de verdade

Olhar o alfabeto diz pouco. Teste em contexto:

- Exporte, instale e componha parágrafos no editor de texto em 12, 16 e 24 pontos.
- Use frases reais em português, com acentos e cedilha.
- Imprima uma página. Problemas que se escondem na tela aparecem no papel.
- Olhe o texto de longe ou apertando os olhos: manchas escuras indicam espaçamento apertado ou traços pesados demais.

Corrija, exporte de novo e repita. Toda fonte passa por várias rodadas assim.

## 9. Exporte

| Uso | Formato |
| --- | --- |
| Instalar no computador | TTF ou OTF (CFF) |
| Sites | WOFF2 com o trecho de CSS @font-face |
| Alternativa para navegadores antigos | WOFF |

Escolha hinting TrueType automático para fontes lidas em tamanhos pequenos no Windows, dicas de haste manuais se quiser controle, ou nenhum hinting para uso em tamanhos grandes. Se o projeto for de ícones, o caminho é outro: veja o [gerador de fonte de ícones](guide:gerador-de-fonte-de-icones).

## Erros comuns de iniciante

- Desenhar cada letra isolada e só testar combinações no final
- Hastes com espessuras diferentes, que deixam o texto manchado
- Esquecer a ultrapassagem nas letras redondas
- Contornos com pontos demais, que geram curvas tremidas
- Espaçamento apertado demais, bonito numa palavra e sufocante num parágrafo
- Esquecer pontuação, algarismos e o R$
- Não fazer backup do arquivo de projeto `.fontsketch.json`

## Checklist do iniciante

- Objetivo escrito
- Lista de caracteres pronta, com pontuação e sinais
- Métricas escolhidas e respeitadas
- Letras de controle n, o, H e O aprovadas primeiro
- Sobreposições removidas, direções corrigidas, contornos simplificados
- Espaçamento testado antes do kerning
- Testado em parágrafos reais, na tela e no papel

## Próximos passos

Abra o [editor do fontsketch](app:), defina as métricas e desenhe n, o, H e O hoje mesmo. Se começar do zero parecer demais, comece pela [sua própria letra](guide:criar-fonte-com-minha-letra) e aprenda espaçamento e kerning com letras que você já tem.
