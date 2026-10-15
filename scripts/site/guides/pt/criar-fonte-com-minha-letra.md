---
slug: criar-fonte-com-minha-letra
lang: pt
pair: turn-your-handwriting-into-a-font
title: Fazer uma fonte com a sua letra
description: Imprima o modelo, preencha, fotografe e deixe o fontsketch vetorizar as letras. Com o que escrever, como tirar a foto e o que ajustar depois.
h1: Fazer uma fonte com a sua letra
topic: Letra à mão
art: scan-to-font
alt: Folha de caligrafia preenchida à mão com marcadores nos cantos sendo fotografada por um celular e virando letras vetoriais na tela
related: [transformar-svg-em-fonte]
---
Para criar uma fonte com a sua letra, imprima a folha modelo do fontsketch, preencha cada quadrinho com um caractere usando caneta escura, tire uma foto com o celular e carregue no navegador. O programa vetoriza cada letra, você ajusta o espaçamento e baixa a fonte em TTF, OTF ou WOFF2. Tudo grátis e sem cadastro.

## Por que transformar a sua letra em fonte

Uma fonte com a sua caligrafia tem muitos usos práticos. Professores montam atividades e apostilas com letra cursiva ou de forma que os alunos reconhecem. Quem trabalha com papelaria personalizada, convites e lembrancinhas ganha uma identidade única. Criadores de conteúdo usam nas thumbnails e nos posts. E muita gente faz simplesmente para guardar a letra de alguém da família.

O melhor é que hoje não precisa de programa caro nem de conhecimento técnico. O [editor do fontsketch](app:) roda direto no navegador, processa a foto no seu próprio computador e não pede conta, e-mail nem cartão.

## O que você vai precisar

- Uma impressora (ou uma papelaria por perto) para imprimir uma página A4
- Uma caneta preta de traço firme, como uma caneta de ponta porosa fina de 0,5 a 0,8 mm ou uma caneta gel
- Um celular com câmera, ou um scanner
- Um computador com navegador atualizado

Evite caneta esferográfica comum e lápis. O traço fica fino, falhado e com pouco contraste, e a vetorização sai cheia de buracos.

## Passo 1: imprima a folha de caligrafia

No fontsketch, abra a opção de folha de caligrafia e baixe o PDF no tamanho A4 (ou Carta, se for o seu caso). Na hora de imprimir, deixe a escala em **100 por cento** e desmarque opções como ajustar à página. A folha tem uma grade de quadrinhos, um para cada caractere, e quatro marcadores pretos nos cantos. Esses marcadores são o que permite ao programa encontrar e endireitar a página na foto, então eles precisam sair bem pretos. Desligue o modo econômico de tinta.

## Passo 2: escreva com calma

Essa é a etapa que define a cara da sua fonte.

- **Escreva no seu tamanho natural**, ocupando cerca de dois terços da altura do quadrinho nas maiúsculas.
- **Mantenha uma linha de base imaginária** na mesma altura em todos os quadrinhos e deixe as pernas de g, j, p, q e y descerem abaixo dela.
- **Mantenha a mesma altura nas minúsculas.** Se o a, o n e o o tiverem alturas diferentes, as palavras vão ficar pulando.
- **Não encoste nas bordas.** Um traço que toca a grade pode ser cortado ou se misturar com ela.
- **Não repasse o traço.** Retocar engrossa a linha de forma irregular. Se errar, use uma folha nova para aquela letra.

Quer uma fonte de **letra cursiva** com as letras ligadas? Faça a saída de cada letra terminar sempre na mesma altura, mais ou menos no meio das minúsculas, para que as ligações se encontrem quando você digitar. Depois é só ajustar o espaçamento.

Não esqueça a pontuação: ponto, vírgula, interrogação, exclamação, aspas e apóstrofo. Uma fonte sem esses sinais obriga o computador a misturar outra fonte no meio do texto. E capriche nos acentos: o til, o agudo, o circunflexo, a crase e a cedilha que você escrever serão reaproveitados em todas as letras acentuadas.

## Passo 3: fotografe do jeito certo

A maioria dos problemas vem da iluminação, não da letra.

- Coloque a folha numa mesa perto de uma janela, com luz natural indireta, sem sol batendo direto.
- Segure o celular paralelo ao papel, bem em cima do centro da folha, para que a sua sombra não caia sobre a grade.
- Desligue o flash, que cria um ponto claro no meio e cantos escuros.
- Enquadre os **quatro marcadores** com uma pequena folga e ocupe o máximo possível da tela com a folha.
- Toque na tela para focar nas letras e segure firme.

Se tiver scanner, digitalize em tons de cinza a 300 dpi.

## Passo 4: deixe o fontsketch vetorizar

Arraste a foto para o editor. Tudo acontece localmente, em sequência:

1. Os marcadores dos cantos são encontrados.
2. A perspectiva é corrigida, então uma foto levemente torta vira uma página reta.
3. A iluminação é equilibrada.
4. A imagem é binarizada, ou seja, vira tinta preta sobre papel branco.
5. A grade é separada em quadrinhos, cada um associado ao seu caractere.
6. Cada letra é vetorizada em contornos e recebe uma **nota de confiança**.

## Passo 5: revise e limpe as letras

Comece pelas letras com a nota de confiança mais baixa. As correções mais comuns:

- Apagar pontinhos de sujeira que viraram contornos minúsculos.
- Usar **simplificar** para reduzir o número de pontos e suavizar as curvas.
- Usar a **remoção de sobreposição** em letras onde os traços se cruzam, como t, f e x.
- Corrigir a **direção dos contornos** para que os buracos internos do o, do a e do e fiquem vazados.

Se uma letra não ficou boa, redesenhe com o pincel ou com a caneta bézier. Misturar algumas letras desenhadas com as escaneadas é normal.

## Passo 6: espaçamento, acentos e kerning

O fontsketch trabalha com 1000 unidades por eme. Confira as **métricas**: ascendente, descendente, altura de x e altura das maiúsculas devem combinar com a sua escrita.

Depois acerte o espaçamento. Cada letra tem uma margem esquerda e uma direita. Teste com sequências como *nonononon* e *HOHOHOH*: se o ritmo parecer regular, a base está boa. Por fim, crie pares de kerning para combinações que ainda parecem estranhas, como Te, To, Vo e Av.

Com os sinais prontos, as letras acentuadas são montadas automaticamente a partir de componentes, como a mais til formando ã. A cobertura inclui os blocos Latin-1 Supplement e Latin Extended-A, então português, espanhol, francês e alemão estão garantidos.

## Passo 7: exporte e use

| Onde vai usar | Formato |
| --- | --- |
| Word, PowerPoint e programas de design | TTF ou OTF |
| Site ou blog | WOFF2 com o trecho de CSS @font-face |
| Navegadores muito antigos | WOFF |

Para instalar no Windows, clique com o botão direito no arquivo TTF e escolha **Instalar**. No Mac, dê dois cliques e clique em **Instalar Fonte** no Catálogo de Fontes. Feche e abra de novo o programa onde vai usar a fonte.

## Checklist rápido

- Folha impressa em 100 por cento, marcadores bem pretos
- Caneta preta de traço firme, letras dentro dos quadrinhos
- Foto com luz uniforme, sem flash e com os quatro marcadores
- Letras com nota baixa revisadas
- Pontuação e sinais de acentuação incluídos
- Espaçamento testado com palavras reais
- Arquivo de projeto `.fontsketch.json` salvo como backup

## Próximos passos

Abra o [fontsketch](app:) e imprima a sua primeira folha. Se você já tem letras desenhadas no computador, veja como [montar uma fonte a partir de SVG](guide:transformar-svg-em-fonte).
