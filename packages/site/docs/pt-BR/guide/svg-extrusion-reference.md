---
title: Compatibilidade de importação e extrusão SVG
outline: deep
---

# Compatibilidade de importação e extrusão SVG

Volte à [demonstração da lição 39](/pt-BR/guide/lesson-039#icon-to-3d) para experimentar no editor.

## Compatibilidade SVG

O conversor aceita contornos fechados com um preenchimento sólido. Um traço SVG sólido em
`<path>`, `<line>`, `<polyline>`, `<polygon>`, `<rect>`, `<circle>` ou `<ellipse>` é
expandido em um Path fechado e editável.

Linhas e paths abertos só de traço podem,
portanto, ser extrudados. Quando uma forma tem preenchimento e traço, o traço vira
um Path separado acima da origem preenchida; os dois conservam a transformação do grupo SVG e
podem ser exportados para GLB.

Caps redondos e quadrados e joins round, bevel e miter
são preservados. O placeholder `stroke="none"` do SVG é ignorado.

O conversor
preserva `fill-rule`, inclusive furos `evenodd`, e herda pintura e largura
de traço dos grupos SVG. Retângulos preenchidos simples continuam nós Rect editáveis; retângulos
arredondados, elipses e polylines fechadas viram Paths editáveis.
Declarações `style` inline de preenchimento, traço, opacidade, regra de preenchimento e geometria
de traço substituem os atributos de apresentação.

`fill="currentColor"` e
`stroke="currentColor"` resolvem contra o `color` mais próximo na forma, no grupo,
na instância `<use>` ou na raiz do SVG; na ausência de cor, o padrão é preto. Um traço fornecido
por `style` também pode ser expandido.

Folhas de estilo CSS externas não são analisadas.
Para a extrusão, retângulos arredondados preservam valores independentes de `rx` e `ry` do SVG
como arcos elípticos de canto. Um raio ausente assume o outro, e cada
raio é limitado à metade da dimensão correspondente.

O importador 2D comum de Rect
ainda armazena um único raio de canto.
Padrões de tracejado SVG de comprimento positivo que podem ser resolvidos, inclusive padrões de comprimento ímpar e
`stroke-dashoffset`, são expandidos em contornos sólidos editáveis separados.
Um tracejado de comprimento zero com cap redondo cria um ponto extrudado. Um
`non-scaling-stroke` conserva a largura especificada através das transformações de grupo SVG e
da escala de `viewBox`: o importador projeta primeiro a linha de centro e depois a expande
em um contorno 3D editável.

Essa largura fica incorporada no momento da importação, então o zoom
posterior do editor escala a mesh 3D normalmente. Traços que não escalam sob clip paths
ou viewports fatiadas, gaps de comprimento zero, tracejados de comprimento zero com outros caps,
gradientes, servidores de pintura e formas SVG não suportadas permanecem em 2D.

## Padrões e gradientes

Preenchimentos `<pattern>` autocontidos com ladrilhos em pixels inteiros e `patternUnits="userSpaceOnUse"`
são importados como preenchimentos 2D repetidos.

O ladrilho pode conter formas SVG básicas; o ladrilho aceita `<use>` local, herança, gradientes lineares ou radiais e imagens PNG, JPEG, WebP ou AVIF incorporadas. Origens numéricas `x` / `y` são suportadas; referências e imagens externas e referências circulares não são suportadas.

As funções
`patternTransform` suportadas (`matrix`, `translate`, `scale`, `rotate` e `skew`)
continuam editáveis no preenchimento importado.
À medida que a tela aumenta o zoom, os ladrilhos de padrão SVG são redesenhados a partir da fonte vetorial.
O espaçamento dos ladrilhos permanece fixo nas coordenadas da tela, com o tamanho do raster limitado
ao limite da textura.
Preenchimentos `<radialGradient>` circulares em retângulos também são conservados em 2D quando usam
`userSpaceOnUse`, centro e raio numéricos explícitos e um ponto focal
centralizado. Outros gradientes radiais autocontidos em retângulos, círculos, elipses,
paths e polígonos, inclusive gradientes elípticos, pontos focais deslocados e
transformações de gradiente, usam um preenchimento de imagem SVG rasterizada.

A forma continua editável,
enquanto as paradas do gradiente são incorporadas nessa imagem em vez de controles de pintura
editáveis à parte.
Os preenchimentos de imagem SVG são redesenhados a partir da fonte vetorial conforme você aumenta o zoom, até o
limite de tamanho da textura, então as bordas permanecem mais nítidas em ampliações maiores.
Se um traço não consegue gerar uma mesh fechada válida, o nó 2D original é conservado.
Contornos de traço expandidos conservam seis casas decimais enquanto as coordenadas são
normalizadas, então detalhes muito finos não colapsam antes da verificação final da mesh.

## Referências e viewports

Referências locais `<use href="#id">` e `xlink:href` legadas a formas ou
grupos suportados criam instâncias independentes, inclusive referências para a frente e repetidas.
Deslocamentos em pixels da instância, transformação e preenchimento herdado são aplicados antes da extrusão;
cada instância recebe o próprio ID editável. Referências circulares e não resolvidas
são ignoradas.

`<use>` também pode referenciar um `<symbol>` com `viewBox` quando a
instância ou o símbolo fornece `width` e `height` positivos em pixels. As dimensões
da instância substituem as dimensões do símbolo.

O
`preserveAspectRatio` do símbolo suporta alinhamentos `meet`, `none` e recorte `slice`
de contornos extrudados. Dimensões efetivas ausentes ou inválidas ignoram essa instância
de símbolo.

Referências externas ainda não são importadas.
Elementos `<svg>` aninhados com dimensões explícitas positivas em pixels e um `viewBox`
também criam grupos de viewport editáveis. O `x`/`y`, a transformação e o
`preserveAspectRatio` deles afetam os filhos extrudados.

Um `<use>` local pode referenciar
um desses elementos SVG e substituir as dimensões da viewport de forma independente.
Viewports de SVG aninhado recortam os contornos de extrusão gerados por padrão, inclusive
com `slice`; defina `overflow="visible"` para conservar a geometria que ultrapassa.
Formas totalmente contidas conservam a relação de grupo, então mover o grupo da viewport
também move as meshes 3D delas. Formas que cruzam uma borda viram Paths recortados.

## Recorte e visibilidade

`clip-path="url(#id)"` local e `clip-path` de CSS inline agora também recortam contornos 3D
elegíveis.

Um `<clipPath>` pode conter Paths, polígonos, polylines, retângulos,
círculos, elipses, grupos aninhados e referências `<use>` locais a essas formas.
As formas dele formam uma união; `clip-rule="evenodd"`
pode abrir furos. Recortes em grupos e em instâncias `<use>` repetidas seguem as
transformações deles, e vários recortes ancestrais se intersectam entre si e com as
viewports SVG.

`clipPathUnits="objectBoundingBox"` usa os limites de uma única forma
ou das formas filhas suportadas de um grupo, inclusive as transformações delas. Um contorno recortado vira um Path editável; um contorno inteiramente
dentro do recorte conserva o nó original e a relação de grupo.

Definições de recorte não resolvidas ou
não suportadas permanecem em 2D. Máscaras, filtros, texto dentro de clip paths
e referências de recorte externas não são convertidos para 3D.
Elementos com `display="none"` ou `visibility="hidden"` herdado não produzem
meshes 3D; um descendente pode definir explicitamente `visibility="visible"`.
Passe o `<svg>` raiz para aplicar `width`/`height` em pixels e `viewBox` explícitos,
inclusive `preserveAspectRatio`.

Extrusões preenchidas também preservam `skewX`,
`skewY` e transformações `matrix(...)` cisalhadas de grupos aninhados do SVG. Esses contornos
viram Paths editáveis com segmentos de reta amostrados quando a transformação combinada
contém cisalhamento.

A escala simples de viewBox mantém retângulos e Paths curvos editáveis
na forma original. SVGs sem dimensões explícitas de viewport em pixels conservam
as coordenadas do viewBox.

Formas 2D não suportadas ainda usam o importador SVG
comum, que não preserva o cisalhamento da origem.

Com `preserveAspectRatio="slice"`, os contornos de extrusão preenchida são recortados na
viewport, inclusive furos e formas divididas em ilhas separadas. Formas
totalmente dentro da viewport conservam a forma de Rect ou de Path curvo. Formas 2D
não suportadas ainda seguem o importador comum e não são recortadas por este auxiliar.

## Exemplos e desempenho

Escolha **Amostra de use repetido** na demonstração da lição 39 para inspecionar duas instâncias da mesma
definição com preenchimentos diferentes, ao lado de um retângulo comum.
Escolha **Amostra de viewport de símbolo** para comparar duas instâncias de viewport de um
símbolo com furo. A primeira usa as dimensões do símbolo; a segunda define as próprias.
Escolha **Amostra de viewport de SVG aninhado** para comparar uma viewport SVG inline e uma
segunda instância referenciada com `<use>`; os contornos extrudados delas são recortados
em cada viewport.
Escolha **Amostra de estilo de pintura + currentColor** para comparar cores herdadas e
específicas da instância, uma substituição de preenchimento inline e um traço estilizado.
Escolha **Amostra de caps e joins de traço** para comparar caps redondos e quadrados, uma
forma preenchida com um contorno 3D separado, um traço que não escala sob uma transformação
de grupo, um traço tracejado extrudado e pontos redondos.
Escolha **Amostra de clip paths + use repetido** para inspecionar duas instâncias recortadas
de forma independente, com furos, e uma forma recortada por uma união de limites do objeto.
Escolha **Amostra de limites de grupo + use de recorte** para inspecionar um recorte de limites do objeto em um
grupo transformado cujas duas janelas reutilizam uma definição local.

A pré-verificação SVG confere se cada contorno pode formar uma mesh. A geometria de CPU
resultante é conservada em um cache recente de no máximo 256 meshes e 8 MiB de arrays
de geometria, para poder ser reutilizada quando a atualização assíncrona da tela cria os
companions 3D.

Entradas mais antigas são removidas; a geometria de GPU tem o próprio cache por tela.
Execute `pnpm bench:svg-import:browser` para inspecionar os tempos de importação e de edição do
[SVG do Tigre do Ghostscript](/Ghostscript_Tiger.svg) do repositório e de outras
artes representativas. Você também pode baixar esse SVG e usar **Enviar SVG**
na demonstração da lição 39 para inspecionar as camadas editáveis e comparar níveis de zoom diferentes.
Quando camadas SVG importadas se sobrepõem, as faces da frente extrudadas conservam a ordem
de pintura do SVG, inclusive camadas dentro de grupos aninhados.

Camadas posteriores permanecem visíveis
sobre as anteriores na visão 3D vinculada.
A exportação GLB lista os nós de extrusão na mesma ordem de travessia da frente para trás,
que o nosso importador glTF conserva. Para extrusões opacas e planas em um plano, a
exportação também separa camadas sobrepostas em profundidade em no máximo 5% da
extrusão mais fina.

Isso dá aos visualizadores glTF valores distintos no depth buffer sem
mover as formas editáveis na tela. Cada pilha que não se intersecta é tratada
de forma independente, então uma mesh 3D distante não desativa o espaçamento.

Uma pilha cujos
limites projetados se sobrepõem a uma extrusão inclinada ou transparente, a outra elevação ou a uma
mesh 3D independente conserva as transformações de autoria. Modelos extremamente grandes ou distantes ainda
podem perder pequenas diferenças de profundidade para a precisão do depth buffer do visualizador.
