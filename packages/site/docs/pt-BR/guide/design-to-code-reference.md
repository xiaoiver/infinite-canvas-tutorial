---
title: Detalhes de exportação de design para código
outline: deep
---

# Detalhes de exportação de design para código

Volte à [lição 38](/pt-BR/guide/lesson-038#design-to-code) para ver a API e os exemplos.

## Mapeamento de conceitos {#concept-mapping}

| Conceito `.ic`                                           | Saída de código                                              |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `rect`/`g` + `display: flex`                             | `<div>` + utilitários de flex (`flex items-center …`)        |
| Direção do flex, alinhamento, tamanho, gaps e padding    | Utilitários de flex do Tailwind / CSS                        |
| `x` / `y` do filho dentro de um contêiner que não é flex | Posicionamento absoluto em relação a esse contêiner          |
| `cornerRadius` / `fills` / `strokes` / `dropShadow`      | `rounded-* / bg-* / border / shadow-*`                       |
| `rect` com preenchimento de imagem                       | `<img src>` com `object-fit` / `object-position`             |
| `rect` com um preenchimento de gradiente CSS             | `background-image` em CSS                                    |
| `ellipse`                                                | `border-radius: 50%` em CSS                                  |
| `path` folha com preenchimento e traço sólidos           | `<path>` SVG inline com geometria vetorial                   |
| `line` / `polyline` folha com traço sólido               | `<path>` SVG inline com geometria vetorial aberta            |
| `rect` / `ellipse` + `clipMode: clip`                    | `overflow: hidden` em CSS no elemento de recorte             |
| `rotation` / `scaleX` / `scaleY`                         | `transform` em CSS em torno do canto superior esquerdo local |
| `blendMode` no nível do nó                               | `mix-blend-mode` em CSS                                      |
| `visibility: hidden` / `visible`                         | visibilidade CSS sem remover o espaço de layout              |
| `text` + `content`                                       | nó de texto; conteúdo `$token` conhecido → valor do texto    |
| linha, estilo, cor e espessura da decoração de texto     | `text-decoration` em CSS                                     |
| `fontVariant` / `fontKerning`                            | `font-variant` / `font-kerning` em CSS                       |
| `wordWrap` / `wordWrapWidth`                             | `white-space`, `overflow-wrap` e `max-width`                 |
| `maxLines` / `textOverflow`                              | line clamp em CSS ou contagem de linhas recortada            |
| `iconfont` (lucide)                                      | `lucide-react` `<Search />`                                  |
| `iconfont` (outras famílias)                             | `@iconify/react` `<Icon icon="family:name" />`               |
| variável `$color.bg`                                     | `bg-[var(--color-bg)]` (css-var) / literal (resolved)        |
| raiz `reusable`                                          | uma definição de componente React                            |
| `ref` + substituições em `descendants`                   | uma instância de componente com props                        |
| `name`                                                   | nome de componente / prop / classe                           |

## Componentes e regras de exportação

Com `componentStructure: 'preserve'` (o padrão, e o diferencial do Pencil), cada raiz `reusable` vira um componente e cada `ref` vira uma instância. Atributos substituíveis (`content`, `fills`, tipografia incluindo `fontVariant` e `fontKerning`, decoração de texto, `opacity`, `visibility`, `cornerRadius`, `width`/`height` explícitos, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, gaps de flex, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes` e campos de sombra projetada) observados entre as instâncias são elevados a props, com o valor do template como padrão.

Valores numéricos de `lineHeight` são alturas em pixels no `.ic`, então a saída React acrescenta `px` em vez de tratá-los como multiplicadores sem unidade. O `fontKerning` booleano vira `normal` ou `none` em CSS.

Arrays de espaçamento viram strings abreviadas de CSS, os campos de text-decoration se combinam em uma prop, e os campos de sombra se combinam em uma prop `boxShadow`. Uma decoração com espessura zero é renderizada como `none`, acompanhando a tela:

### Texto

As exportações de texto usam uma altura de linha sem unidade `1.2` quando nenhum `lineHeight` explícito está definido, mantendo o espaçamento flex do navegador próximo às métricas de texto da tela. Um `lineHeight` numérico explícito ainda é exportado em pixels.

Quebras de linha explícitas são preservadas com `white-space: pre`. Quando `wordWrap` está ativado com um `wordWrapWidth` positivo, a saída usa `pre-wrap`, `overflow-wrap: anywhere` e essa largura como máximo.

Um `maxLines` positivo adiciona line clamp em CSS para `ellipsis` (o padrão) ou um limite de line-height recortado para `clip`. Editar a largura de quebra de um texto reutilizável que já está quebrado vira uma prop do componente.

Ligar ou desligar a quebra, ou mudar as configurações de truncamento, expande a instância para que o layout exportado acompanhe a edição. A tela atualmente não aplica a configuração `whiteSpace` na medição de texto; strings personalizadas de marcador em `textOverflow` não têm equivalente no CSS padrão.

### Imagens e preenchimentos

Para uma imagem reutilizável, mudar apenas a URL da imagem vincula a substituição de `fills` da instância à prop `<img src>` do componente. Mudar o tipo de preenchimento, o encaixe, a posição ou a opacidade do preenchimento expande a instância para que o elemento e os estilos gerados reflitam a edição.

Uma imagem folha combina a opacidade do seu único preenchimento com a opacidade do nó em `<img>`. Um único preenchimento de imagem em uma elipse é exportado como um `<img>` arredondado.

Retângulos e elipses preenchidos com imagem que têm filhos usam um wrapper posicionado e colocam um `<img>` decorativo atrás desses filhos; o wrapper carrega a opacidade do nó, enquanto `<img>` carrega a opacidade do preenchimento, o encaixe e a posição.

Um retângulo com um preenchimento de gradiente CSS linear, radial ou cônico habilitado exporta esse gradiente como `background-image`. Editar apenas o valor do gradiente em uma instância vira uma prop do componente.

Retângulos e elipses com vários preenchimentos sólidos, de gradiente suportado, de imagem ou de padrão exportam fundos empilhados na ordem de pintura. Um único padrão também é exportado como fundo CSS.

A sintaxe `conic-gradient(circle at …)` da tela é convertida para o CSS `conic-gradient(at …)`. Camadas de imagem suportam `fill`, `contain`, `cover`, `none`, `scale-down` e posição, mantendo o conteúdo filho acima da pintura.

Os padrões conservam o tamanho natural do ladrilho e a configuração de repetição. Para pinturas que precisam de opacidade independente, `scale-down` de imagem ou uma transformação 2D de padrão suportada, o gerador emite camadas decorativas recortadas atrás dos filhos.

Os modos de mesclagem de camada suportados por CSS permanecem locais à pilha de preenchimento. As transformações de padrão suportam `matrix`, `translate`, `scale`, `rotate`, `skewX` e `skewY` em retângulos e elipses com dimensões explícitas; a tela também decodifica imagens de padrão baseadas em URL e aplica essas transformações.

Editar uma pilha ou um padrão em uma instância reutilizável a expande. Outros formatos de gradiente, sintaxes de transformação de padrão não suportadas e modos de mesclagem sem equivalente em CSS, como `linearBurn` e `linearDodge`, ainda precisam de tratamento separado.

Um único preenchimento sólido com opacidade abaixo de 1 é exportado por meio de `color-mix` em CSS, preservando o alfa do preenchimento sem escurecer os elementos filhos. A opacidade do nó continua sendo um `opacity` separado em CSS. Editar um preenchimento translúcido em uma instância reutilizável expande essa instância para que a pintura gerada conserve a opacidade.

### Transformações e layout

A rotação do nó (armazenada em radianos) e `scaleX` / `scaleY` são exportadas como uma transformação CSS `rotate(...) scale(...)` com origem `0 0`, acompanhando a ordem da transformação local da tela. Editar a transformação de uma instância expande essa instância para que a geometria alterada entre na exportação.

Retângulos e elipses com `clipMode: clip` agora recortam os filhos no HTML e no código React gerados. Retângulos arredondados conservam o raio dos cantos, e elipses usam `border-radius: 50%`. Mudar o modo de recorte de uma instância reutilizável expande essa instância para que o estado de recorte seja preservado. Máscaras `erase` e `soft` não têm um equivalente direto de overflow em CSS e não são exportadas como recorte.

Em um contêiner que não é flex, os filhos usam o `x` / `y` local da tela como posições CSS `left` / `top`. Filhos flex permanecem no fluxo flex normal.

O Yoga define o `flexShrink` padrão deles como `0`, então a exportação define `flex-shrink: 0`, a menos que o nó especifique outro valor. Uma instância de componente preservada dentro de um contêiner que não é flex recebe um wrapper posicionado; mover um filho dentro de uma instância expande essa instância para reter a edição.

Quando vários nós de nível superior têm tamanhos explícitos, a exportação também adiciona um quadro relativo e mantém o espaçamento deles, inclusive os limites rotacionados e espelhados. Raízes sem tamanhos mensuráveis conservam o fluxo normal do documento.

A `visibility` no nível do nó vira `visibility` em CSS, então nós ocultos conservam o espaço de layout. O estado padrão `inherited` usa a herança do CSS. Mudar a visibilidade de uma instância reutilizável vira uma prop do componente, inclusive edições nos descendentes.

### Formas vetoriais

Paths com dados `d` válidos são exportados como SVG inline em vez de um placeholder retangular. Quando um Path tem filhos, o SVG fica atrás deles em um wrapper posicionado, conservando o contorno vetorial e as coordenadas locais de cada filho.

Camadas de preenchimento feitas de cores sólidas, gradientes lineares ou radiais e imagens são exportadas como paths SVG separados na ordem da tela, preservando a opacidade de cada camada. Modos de mesclagem suportados por CSS se aplicam dentro de um grupo SVG isolado, então eles se misturam apenas com as camadas de preenchimento inferiores.

Traços ativos desses tipos de pintura conservam a pintura, a opacidade, marcadores de extremidade em linha, triângulo ou losango, a regra de preenchimento, a largura, o cap, o join, o limite de miter e as configurações de tracejado. Paths, linhas e polylines com vários traços exportam cada traço na ordem da tela, com geometria compartilhada e mesclagem de camadas suportada por CSS.

Paths fechados também conservam o alinhamento interno ou externo do traço recortando ou mascarando cada camada; paths abertos permanecem alinhados ao centro. Gradientes e pinturas de imagem seguem o viewBox do path.

Preenchimentos de imagem de path suportam `fill`, `contain`, `cover`, `none` e `scale-down`, inclusive posições percentuais intermediárias. Alinhamentos comuns de `fill` / `contain` / `cover` usam padrões SVG; outros encaixes e posições usam um `foreignObject` SVG recortado com `object-fit` / `object-position` em CSS.

Traços de imagem usam padrões SVG para `fill`, `contain` ou `cover` nas posições 0%, 50% ou 100%. Um único traço de imagem com outro encaixe ou posição usa uma imagem HTML posicionada e uma máscara de geometria SVG, preservando cap, join, marcadores de extremidade e alinhamento interno ou externo no Chromium e no WebKit.

Traços de imagem em camadas com esses encaixes ou posições também conservam a ordem de pintura da tela, os modos de mesclagem CSS suportados, a opacidade e os marcadores de extremidade, junto com as camadas de traço SVG. Use uma URL de imagem durável ou uma data URL no código exportado.

Uma sombra projetada acompanha a arte SVG sem sombrear os filhos de um Path. Substituições de pintura, geometria, marcador, alinhamento de traço ou sombra de um path em uma instância reutilizável expandem essa instância para que o SVG reflita a edição.

Modos de mesclagem sem equivalente em CSS, como `linearBurn` e `linearDodge`, gradientes cônicos e mesh, e outros filtros de path precisam de tratamento SVG separado.

Linhas e polylines folha usam o mesmo pipeline SVG. Suas extremidades locais ou a lista de pontos viram um path aberto sem preenchimento.

O viewBox do SVG segue a origem local da geometria e centraliza um eixo de largura ou altura zero, para que paths deslocados e traços finos horizontais ou verticais permaneçam visíveis no código gerado. O traço pode usar uma única pintura ativa sólida, de gradiente linear, de gradiente radial ou de imagem.

Pontas de seta em linha, triângulo e losango usam marcadores SVG locais com a pintura do traço. Edições de geometria, pintura ou marcador em uma instância reutilizável de linha ou polyline também expandem essa instância.

Outros efeitos de linha ainda precisam de tratamento separado.

O `blendMode` no nível do nó vira `mix-blend-mode` em CSS, inclusive uma prop do componente quando uma instância o altera. `light` mapeia para `lighten` em CSS; modos sem equivalente em CSS seguem a exportação SVG e são renderizados como `normal`. O `blendMode` próprio de uma camada de preenchimento se mistura com os outros preenchimentos daquele nó e não é tratado como `mix-blend-mode` no nível do nó.

## Exemplos práticos {#practical-interface-examples}

Os exemplos da lição 38 carregam um painel de análise, uma página de preços SaaS e uma tela de checkout para celular na **tela do editor IC**. As três cenas usam layouts flex aninhados e variáveis semânticas de cor; o checkout usa uma prancheta estreita de 390 × 844. Selecione e edite nós na tela e, em seguida, atualize, copie ou baixe o código gerado a partir do documento atual da tela com `API.exportCode`. Com HTML/CSS selecionado, use **Pré-visualização HTML** para ver a página gerada no tamanho da prancheta, em um frame isolado. Troque de design para carregar outra cena editável.

Os exemplos passam a `API.exportCode` um mapa `semanticElements` indexado por ID de nó. Ele transforma retângulos e textos selecionados da tela em landmarks HTML, títulos e controles `<button type="button">` nas duas exportações. O mapa pertence à configuração de exportação desta demonstração; conecte as ações dos botões e a navegação na sua aplicação.

A página de preços usa um template de cartão de plano `reusable` e três instâncias `ref`. O editor expande as instâncias para renderizá-las e editá-las; esta demonstração reconcilia edições de texto, cor, tipografia e decoração de texto, opacidade, tamanho explícito e restrições de tamanho, espaçamento, alinhamento flex e dimensionamento de itens, borda sólida e sombra projetada de volta em substituições da instância, para os downloads de React e `.ic`.

O cartão Growth demonstra uma borda de destaque. Valores numéricos de `flexBasis` e de restrições de tamanho viram valores em pixels nos estilos HTML/CSS e React.

Se a estrutura de um cartão ou uma propriedade não suportada mudar, a exportação usa os nós expandidos para que o resultado ainda corresponda à tela.

As três exportações React também são renderizadas em um teste de navegador com React 19 e Tailwind CSS 4. O teste confere as posições-chave do texto em relação à pré-visualização HTML, para que esses exemplos continuem executáveis à medida que o gerador muda.

Baixe o arquivo `.ic` para continuar editando o design no [aplicativo online](https://app.infinitecanvas.cc/) por **Importar de… > .ic**. Baixe o arquivo HTML e abra-o diretamente em um navegador.

Para React, escolha **Baixar projeto React** para obter um ZIP inicial de Vite, React 19 e Tailwind CSS 4 a partir da tela atual. Extraia-o e, em seguida, execute `pnpm install` e `pnpm dev`; o componente exportado fica em `src/App.tsx`.

O starter inclui a fonte Inter localmente quando o design a usa. Imagens `blob:` temporárias da tela atual são copiadas para `public/assets` e referenciadas por caminhos locais; data URLs permanecem inline e URLs remotas continuam remotas.

O `src/responsive.css` adiciona layouts para telas estreitas nesses três exemplos, preservando o componente no tamanho da prancheta em `src/App.tsx`. Você também pode baixar apenas o arquivo `.tsx` para um projeto existente.

O gerador atualmente emite marcação de apresentação; conecte navegação, ações de checkout, pagamentos e dados ao vivo à lógica da sua aplicação depois da exportação.
