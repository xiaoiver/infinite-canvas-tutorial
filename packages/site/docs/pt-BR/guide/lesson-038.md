---
outline: deep
description: 'Tokens de design, variáveis, temas, geração componentizada e integração de fontes de ícones no Pencil. Exporte SVG, Iconify e o caminho do design ao código.'
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
import ComponentsInstances from '../../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../../components/DesignToCodeInterfaces.vue'
</script>

# Lição 38 - Do design ao código {#lesson-38-from-design-to-code}

## Variáveis e temas {#variables-and-themes}

O Pencil suporta um sistema completo de tokens de design com valores condicionais para vários temas. Veja [Variables and Themes]. As variáveis reduzem a codificação de valores fixos: o modelo não precisa emitir valores de cor específicos (menos erros de `#RRGGBB`) nem aprender a tabela de tokens do seu design system — ele só precisa dos nomes semânticos das variáveis, e o renderizador os resolve.

```ts
api.setAppState({
    variables: {
        'color.background': { type: 'color', value: '#FFFFFF' },
        'text.title': { type: 'number', value: 72 },
    },
});
api.updateNodes([
    {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fill: '$color.background',
        stroke: '$color.background',
    },
]);
```

Quando o modelo projeta para o modo escuro, ele não precisa de duas paletas completas — apenas de referências como `$color.bg`, enquanto o `theme` do nó controla o valor resolvido.

```json
"variables": {
  "color.bg": {
    "type": "color",
    "value": [
      { "value": "#FFFFFF", "theme": { "mode": "light" } },
      { "value": "#000000", "theme": { "mode": "dark" } }
    ]
  }
}
```

O modelo também não precisa calcular valores em pixels nem ligar breakpoints responsivos. Ele declara a intenção de forma declarativa, e o motor de layout calcula a geometria. Veja [Lição 33 - Motor de layout].

### Tipos de variável {#variable-types}

O Figma suporta quatro tipos de variável. Veja [Guide to variables in Figma]

-   Cor (`#000000`)
-   Número
-   String, por exemplo `fontFamily` ou o conteúdo do texto
-   Booleano

![fonte: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![fonte: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### Painel de propriedades e seletor de variáveis {#property-panel-and-variable-picker}

Com um nó selecionado, o painel de propriedades Spectrum pode vincular variáveis de design de `AppState.variables` a **preenchimento / cor do traço / largura do traço / tamanho da fonte**: escolha um nome no menu suspenso para gravar `$token`. Quando está vinculado, aparece um selo roxo, e você pode **desvincular** em uma ação (grava de volta o literal resolvido atual e registra no histórico). O seletor de cor e o controle deslizante de largura do traço sempre mostram valores **resolvidos**, então um `$...` cru nunca é usado como cor CSS inválida.

### Exportar SVG {#export-svg}

Existem várias estratégias de exportação; o padrão são literais resolvidos:

```ts
export type DesignVariablesSvgExportMode =
    /** Resolve $ → literal */
    | 'resolved'
    /** Keep `$token` strings (attributes may be non-standard; good for post-processing) */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` */
    | 'css-var';
```

Você também pode usar o modo de variáveis CSS: os globais são declarados em `:root`, para que você possa ajustá-los no devtools. Veja [Using CSS custom properties (variables)]

```html
<svg>
    <defs>
        <style>
            :root {
                --color-background: #2563eb;
                --color-stroke: red;
                --text-title: 72px;
            }
        </style>
    </defs>
    <rect
        fill="var(--color-background)"
        stroke="var(--color-stroke)"
        stroke-width="2"
        width="100"
        height="100"
        id="node-r1"
    />
</svg>
```

## Ícone {#icon}

Os ícones importam ao gerar interfaces. O [Lucide] já é amplamente usado na geração de código React, e o Pencil suporta gráficos embutidos semelhantes:

```ts
export interface IconFont extends Entity, Size, CanHaveEffects {
    type: 'icon_font';
    /** Name of the icon in the icon font */
    iconFontName?: StringOrVariable;
    /** Icon font to use. Valid fonts are 'lucide', 'feather', 'Material Symbols Outlined', 'Material Symbols Rounded', 'Material Symbols Sharp', 'phosphor' */
    iconFontFamily?: StringOrVariable;
    /** Variable font weight, only valid for icon fonts with variable weight. Values from 100 to 700. */
    weight?: NumberOrVariable;
    fill?: Fills;
}
```

No OpenPencil, `iconLookup` é uma função injetável, o que significa:

-   **Flexibilidade**: qualquer fonte de ícones (Iconify, Lucide, personalizada)
-   **Carga do modelo**: o modelo só produz `iconFontName: "SearchIcon"`; o runtime resolve os paths

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // Resolve SVG path → Skia path → scale → draw
}
```

Nossas definições:

```ts
export interface IconFontAttributes {
  /** Name of the icon in the font family */
  iconFontName?: StringOrVariable;
  /**
   * Font family, e.g. 'lucide', 'feather', 'Material Symbols Outlined', 'phosphor', etc.
   */
  iconFontFamily?: StringOrVariable;
}

export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>;
```

### Registrar ícone em tempo de execução {#register-icon-at-runtime}

Usamos a forma do ícone de [IconifyJSON] para carregar Lucide, Material e outros conjuntos em tempo de execução por meio de JSON que inclui SVG:

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

Os corpos dos ícones aceitam atributos SVG com aspas simples ou duplas. Paths, retângulos,
círculos, elipses e linhas podem usar tags autocontidas ou tags de fechamento explícitas;
os atributos fill e stroke de `<g>` aninhados são herdados pelas suas formas.

O JSON do ícone é mapeado para o nosso grafo de cena do mesmo modo que antes: um ícone Search vira um `Group` com filhos `Path` e `Circle`, de forma bem parecida com transformar SVG nas nossas formas.

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

Também mapeamos largura, altura e `strokeWidth` no grafo convertido:

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### Exibir no painel de camadas {#display-in-the-layer-panel}

O Iconify fornece Web Components para exibição. Veja [Iconify Icon web component]. Nós os usamos para as miniaturas na lista de camadas:

```ts
import 'iconify-icon';

if (this.node.type === 'iconfont') {
    const iconName = this.#normalizeIconifyName(
        this.node as IconFontSerializedNode,
    );
    thumbnail = iconName
        ? html`<iconify-icon icon=${iconName}></iconify-icon>`
        : html`<sp-icon-group></sp-icon-group>`;
}
```

### Exportar SVG {#export-svg-2}

### Renderizar com layout {#render-component-with-layout}

Junto com a [Lição 33 - Motor de layout], você pode montar um botão que inclui um ícone:

```ts
const button1 = {
    id: 'icon-button',
    type: 'rect',
    fill: 'grey',
    display: 'flex',
    width: 200,
    height: 100,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    cornerRadius: 10,
    gap: 10,
} as const;

const searchIcon = {
    id: 'icon-button-search',
    parentId: 'icon-button',
    type: 'iconfont',
    iconFontName: 'search',
    iconFontFamily: 'lucide',
};

const text = {
    id: 'icon-button-text',
    parentId: 'icon-button',
    type: 'text',
    content: 'Button',
};
```

<IconButton />

Queremos um `Button` com várias **variantes** — no mesmo espírito do [Shadcn UI] — para não precisar escrever a mesma estrutura repetidas vezes:

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## Componentes e slots {#components-and-slots}

Em arquivos `.pen`, o sistema `ref` + `descendants` é, na prática, um modelo de herança de componentes voltado para IA: o modelo não precisa entender a pilha de baixo nível (retângulo arredondado + texto + padding). Ele pode apontar para um `round-button` existente no design system e substituir o rótulo. É a mesma ideia de “herdar e depois substituir” que existe no código. Veja [Components and Instances].

```json
{
    "id": "round-button",
    "type": "g",
    "reusable": true,
    "cornerRadius": 9999,
    "children": [
        {
            "id": "label",
            "type": "text",
            "content": "Submit",
            "fill": "#000000"
            ...
        }
    ]
}

{
    "id": "save-round-button",
    "type": "ref",
    "ref": "round-button",
    "descendants": { "label": { "content": "Save" } }
}
```

<ComponentsInstances />

## Design ↔ código {#design-to-code}

[Design ↔ Code]

A ideia central de [Design ↔ Code] é que design para código **não** é um chute de IA de pixel para código. Como o formato `.ic` já codifica primitivas amigáveis ao código — layout flex, variáveis de design, componentes `reusable`/`ref`, nomes semânticos e fontes de ícones — o grafo de cena **é** uma IR feita para código. Assim, o núcleo é um **transpilador determinístico**, e a IA só ajuda na camada de nomes e de limpeza da estrutura.

### Pipeline {#design-to-code-pipeline}

Espelhamos o pipeline de exportação SVG, mas inserimos uma **IR de código** independente de framework, de modo que adicionar um novo framework de destino seja apenas mais um emissor:

```text
.ic SceneGraph
  → expandRefSerializedNodes   // reuse existing ref/reusable handling
  → CodeIR                     // element tree + structured style + token refs + component defs
  → Emitter                    // react-tailwind | html-css | ...
```

O nó da IR de código conserva: um **papel** (contêiner / texto / ícone / imagem / forma), **referências `$token` pré-resolvidas**, **estilo flex** estruturado e **relações de componente** `reusable`/`ref`.

### Ponto de entrada {#design-to-code-entry}

`API.exportCode` é a contraparte de `renderToSVG`. Sem argumentos, ele transpila a cena inteira; passe nós para transpilar uma seleção.

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // or 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

Você também pode chamar a função pura diretamente:

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### Mapeamento de conceitos {#design-to-code-mapping}

| Conceito `.ic`                                       | Saída de código                                       |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `rect`/`g` + `display: flex`                         | `<div>` + utilitários de flex (`flex items-center …`) |
| Direção do flex, alinhamento, tamanho, gaps e padding | Utilitários de flex do Tailwind / CSS                |
| `x` / `y` do filho dentro de um contêiner que não é flex | Posicionamento absoluto em relação a esse contêiner |
| `cornerRadius` / `fills` / `strokes` / `dropShadow`  | `rounded-* / bg-* / border / shadow-*`                |
| `rect` com preenchimento de imagem                   | `<img src>` com `object-fit` / `object-position`      |
| `rect` com um preenchimento de gradiente CSS         | `background-image` em CSS                             |
| `ellipse`                                            | `border-radius: 50%` em CSS                           |
| `path` folha com preenchimento e traço sólidos       | `<path>` SVG inline com geometria vetorial            |
| `line` / `polyline` folha com traço sólido           | `<path>` SVG inline com geometria vetorial aberta     |
| `rect` / `ellipse` + `clipMode: clip`                | `overflow: hidden` em CSS no elemento de recorte      |
| `rotation` / `scaleX` / `scaleY`                     | `transform` em CSS em torno do canto superior esquerdo local |
| `blendMode` no nível do nó                           | `mix-blend-mode` em CSS                               |
| `visibility: hidden` / `visible`                     | visibilidade CSS sem remover o espaço de layout       |
| `text` + `content`                                   | nó de texto; conteúdo `$token` conhecido → valor do texto |
| linha, estilo, cor e espessura da decoração de texto | `text-decoration` em CSS                              |
| `fontVariant` / `fontKerning`                        | `font-variant` / `font-kerning` em CSS                |
| `wordWrap` / `wordWrapWidth`                         | `white-space`, `overflow-wrap` e `max-width`          |
| `maxLines` / `textOverflow`                          | line clamp em CSS ou contagem de linhas recortada     |
| `iconfont` (lucide)                                  | `lucide-react` `<Search />`                           |
| `iconfont` (outras famílias)                         | `@iconify/react` `<Icon icon="family:name" />`        |
| variável `$color.bg`                                 | `bg-[var(--color-bg)]` (css-var) / literal (resolved) |
| raiz `reusable`                                      | uma definição de componente React                     |
| `ref` + substituições em `descendants`               | uma instância de componente com props                 |
| `name`                                               | nome de componente / prop / classe                    |

### Modos de variável {#design-to-code-variable-modes}

Os três modos de variável acompanham a semântica da exportação SVG:

-   `resolved` (padrão): resolve `$token` para literais (por exemplo, `bg-[#FFFFFF]`).
-   `css-var`: emite `var(--token)` para estilos (por exemplo, `bg-[var(--color-bg)]`). A exportação HTML/CSS inclui um bloco `:root { … }`; o React delimita as definições a cada componente exportado, inclusive componentes reutilizáveis renderizados sozinhos. Instâncias aninhadas compartilham o escopo do pai, então exportações separadas podem usar valores diferentes para o mesmo token. Tokens de conteúdo de texto resolvem para os valores atuais porque propriedades customizadas de CSS não podem substituir nós de texto.
-   `preserve-token`: mantém `$token` (encaminhado para um `style` inline para pós-processamento).

### Componentes e instâncias {#design-to-code-components}

Com `componentStructure: 'preserve'` (o padrão, e o diferencial do Pencil), cada raiz `reusable` vira um componente e cada `ref` vira uma instância. Atributos substituíveis (`content`, `fills`, tipografia incluindo `fontVariant` e `fontKerning`, decoração de texto, `opacity`, `visibility`, `cornerRadius`, `width`/`height` explícitos, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, gaps de flex, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes` e campos de sombra projetada) observados entre as instâncias são elevados a props, com o valor do template como padrão. Valores numéricos de `lineHeight` são alturas em pixels no `.ic`, então a saída React acrescenta `px` em vez de tratá-los como multiplicadores sem unidade. O `fontKerning` booleano vira `normal` ou `none` em CSS. Arrays de espaçamento viram strings abreviadas de CSS, os campos de text-decoration se combinam em uma prop, e os campos de sombra se combinam em uma prop `boxShadow`. Uma decoração com espessura zero é renderizada como `none`, acompanhando a tela:

As exportações de texto usam uma altura de linha sem unidade `1.2` quando nenhum `lineHeight` explícito está definido, mantendo o espaçamento flex do navegador próximo às métricas de texto da tela. Um `lineHeight` numérico explícito ainda é exportado em pixels. Quebras de linha explícitas são preservadas com `white-space: pre`. Quando `wordWrap` está ativado com um `wordWrapWidth` positivo, a saída usa `pre-wrap`, `overflow-wrap: anywhere` e essa largura como máximo. Um `maxLines` positivo adiciona line clamp em CSS para `ellipsis` (o padrão) ou um limite de line-height recortado para `clip`. Editar a largura de quebra de um texto reutilizável que já está quebrado vira uma prop do componente. Ligar ou desligar a quebra, ou mudar as configurações de truncamento, expande a instância para que o layout exportado acompanhe a edição. A tela atualmente não aplica a configuração `whiteSpace` na medição de texto; strings personalizadas de marcador em `textOverflow` não têm equivalente no CSS padrão.

Para uma imagem reutilizável, mudar apenas a URL da imagem vincula a substituição de `fills` da instância à prop `<img src>` do componente. Mudar o tipo de preenchimento, o encaixe, a posição ou a opacidade do preenchimento expande a instância para que o elemento e os estilos gerados reflitam a edição. Uma imagem folha combina a opacidade do seu único preenchimento com a opacidade do nó em `<img>`. Um único preenchimento de imagem em uma elipse é exportado como um `<img>` arredondado. Retângulos e elipses preenchidos com imagem que têm filhos usam um wrapper posicionado e colocam um `<img>` decorativo atrás desses filhos; o wrapper carrega a opacidade do nó, enquanto `<img>` carrega a opacidade do preenchimento, o encaixe e a posição.

Um retângulo com um preenchimento de gradiente CSS linear, radial ou cônico habilitado exporta esse gradiente como `background-image`. Editar apenas o valor do gradiente em uma instância vira uma prop do componente. Retângulos e elipses com vários preenchimentos sólidos, de gradiente suportado, de imagem ou de padrão exportam fundos empilhados na ordem de pintura. Um único padrão também é exportado como fundo CSS. A sintaxe `conic-gradient(circle at …)` da tela é convertida para o CSS `conic-gradient(at …)`. Camadas de imagem suportam `fill`, `contain`, `cover`, `none`, `scale-down` e posição, mantendo o conteúdo filho acima da pintura. Os padrões conservam o tamanho natural do ladrilho e a configuração de repetição. Para pinturas que precisam de opacidade independente, `scale-down` de imagem ou uma transformação 2D de padrão suportada, o gerador emite camadas decorativas recortadas atrás dos filhos. Os modos de mesclagem de camada suportados por CSS permanecem locais à pilha de preenchimento. As transformações de padrão suportam `matrix`, `translate`, `scale`, `rotate`, `skewX` e `skewY` em retângulos e elipses com dimensões explícitas; a tela também decodifica imagens de padrão baseadas em URL e aplica essas transformações. Editar uma pilha ou um padrão em uma instância reutilizável a expande. Outros formatos de gradiente, sintaxes de transformação de padrão não suportadas e modos de mesclagem sem equivalente em CSS, como `linearBurn` e `linearDodge`, ainda precisam de tratamento separado.

Um único preenchimento sólido com opacidade abaixo de 1 é exportado por meio de `color-mix` em CSS, preservando o alfa do preenchimento sem escurecer os elementos filhos. A opacidade do nó continua sendo um `opacity` separado em CSS. Editar um preenchimento translúcido em uma instância reutilizável expande essa instância para que a pintura gerada conserve a opacidade.

A rotação do nó (armazenada em radianos) e `scaleX` / `scaleY` são exportadas como uma transformação CSS `rotate(...) scale(...)` com origem `0 0`, acompanhando a ordem da transformação local da tela. Editar a transformação de uma instância expande essa instância para que a geometria alterada entre na exportação.

Retângulos e elipses com `clipMode: clip` agora recortam os filhos no HTML e no código React gerados. Retângulos arredondados conservam o raio dos cantos, e elipses usam `border-radius: 50%`. Mudar o modo de recorte de uma instância reutilizável expande essa instância para que o estado de recorte seja preservado. Máscaras `erase` e `soft` não têm um equivalente direto de overflow em CSS e não são exportadas como recorte.

Em um contêiner que não é flex, os filhos usam o `x` / `y` local da tela como posições CSS `left` / `top`. Filhos flex permanecem no fluxo flex normal. O Yoga define o `flexShrink` padrão deles como `0`, então a exportação define `flex-shrink: 0`, a menos que o nó especifique outro valor. Uma instância de componente preservada dentro de um contêiner que não é flex recebe um wrapper posicionado; mover um filho dentro de uma instância expande essa instância para reter a edição. Quando vários nós de nível superior têm tamanhos explícitos, a exportação também adiciona um quadro relativo e mantém o espaçamento deles, inclusive os limites rotacionados e espelhados. Raízes sem tamanhos mensuráveis conservam o fluxo normal do documento.

A `visibility` no nível do nó vira `visibility` em CSS, então nós ocultos conservam o espaço de layout. O estado padrão `inherited` usa a herança do CSS. Mudar a visibilidade de uma instância reutilizável vira uma prop do componente, inclusive edições nos descendentes.

Paths com dados `d` válidos são exportados como SVG inline em vez de um placeholder retangular. Quando um Path tem filhos, o SVG fica atrás deles em um wrapper posicionado, conservando o contorno vetorial e as coordenadas locais de cada filho. Camadas de preenchimento feitas de cores sólidas, gradientes lineares ou radiais e imagens são exportadas como paths SVG separados na ordem da tela, preservando a opacidade de cada camada. Modos de mesclagem suportados por CSS se aplicam dentro de um grupo SVG isolado, então eles se misturam apenas com as camadas de preenchimento inferiores. Traços ativos desses tipos de pintura conservam a pintura, a opacidade, marcadores de extremidade em linha, triângulo ou losango, a regra de preenchimento, a largura, o cap, o join, o limite de miter e as configurações de tracejado. Paths, linhas e polylines com vários traços exportam cada traço na ordem da tela, com geometria compartilhada e mesclagem de camadas suportada por CSS. Paths fechados também conservam o alinhamento interno ou externo do traço recortando ou mascarando cada camada; paths abertos permanecem alinhados ao centro. Gradientes e pinturas de imagem seguem o viewBox do path. Preenchimentos de imagem de path suportam `fill`, `contain`, `cover`, `none` e `scale-down`, inclusive posições percentuais intermediárias. Alinhamentos comuns de `fill` / `contain` / `cover` usam padrões SVG; outros encaixes e posições usam um `foreignObject` SVG recortado com `object-fit` / `object-position` em CSS. Traços de imagem usam padrões SVG para `fill`, `contain` ou `cover` nas posições 0%, 50% ou 100%. Um único traço de imagem com outro encaixe ou posição usa uma imagem HTML posicionada e uma máscara de geometria SVG, preservando cap, join, marcadores de extremidade e alinhamento interno ou externo no Chromium e no WebKit. Traços de imagem em camadas com esses encaixes ou posições também conservam a ordem de pintura da tela, os modos de mesclagem CSS suportados, a opacidade e os marcadores de extremidade, junto com as camadas de traço SVG. Use uma URL de imagem durável ou uma data URL no código exportado. Uma sombra projetada acompanha a arte SVG sem sombrear os filhos de um Path. Substituições de pintura, geometria, marcador, alinhamento de traço ou sombra de um path em uma instância reutilizável expandem essa instância para que o SVG reflita a edição. Modos de mesclagem sem equivalente em CSS, como `linearBurn` e `linearDodge`, gradientes cônicos e mesh, e outros filtros de path precisam de tratamento SVG separado.

Linhas e polylines folha usam o mesmo pipeline SVG. Suas extremidades locais ou a lista de pontos viram um path aberto sem preenchimento. O viewBox do SVG segue a origem local da geometria e centraliza um eixo de largura ou altura zero, para que paths deslocados e traços finos horizontais ou verticais permaneçam visíveis no código gerado. O traço pode usar uma única pintura ativa sólida, de gradiente linear, de gradiente radial ou de imagem. Pontas de seta em linha, triângulo e losango usam marcadores SVG locais com a pintura do traço. Edições de geometria, pintura ou marcador em uma instância reutilizável de linha ou polyline também expandem essa instância. Outros efeitos de linha ainda precisam de tratamento separado.

O `blendMode` no nível do nó vira `mix-blend-mode` em CSS, inclusive uma prop do componente quando uma instância o altera. `light` mapeia para `lighten` em CSS; modos sem equivalente em CSS seguem a exportação SVG e são renderizados como `normal`. O `blendMode` próprio de uma camada de preenchimento se mistura com os outros preenchimentos daquele nó e não é tratado como `mix-blend-mode` no nível do nó.

```tsx
interface RoundButtonProps {
    label?: string;
}

export function RoundButton({ label = 'Submit' }: RoundButtonProps) {
    return (
        <div className="flex items-center justify-center w-[120px] h-[40px] rounded-[9999px]">
            <span>{label}</span>
        </div>
    );
}

export function Design() {
    return <RoundButton label="Save" />;
}
```

`componentStructure: 'flatten'` é a alternativa: ele expande cada instância via `expandRefSerializedNodes` em DOM concreto, sem definições de componente. O emissor HTML/CSS sempre achata, já que HTML não tem o conceito de componente.

### Exemplos práticos de interface {#practical-interface-examples}

Os exemplos a seguir carregam um painel de análise, uma página de preços SaaS e uma tela de checkout para celular na **tela do editor IC**. As três cenas usam layouts flex aninhados e variáveis semânticas de cor; o checkout usa uma prancheta estreita de 390 × 844. Selecione e edite nós na tela e, em seguida, atualize, copie ou baixe o código gerado a partir do documento atual da tela com `API.exportCode`. Com HTML/CSS selecionado, use **Pré-visualização HTML** para ver a página gerada no tamanho da prancheta, em um frame isolado. Troque de design para carregar outra cena editável.

Os exemplos passam a `API.exportCode` um mapa `semanticElements` indexado por ID de nó. Ele transforma retângulos e textos selecionados da tela em landmarks HTML, títulos e controles `<button type="button">` nas duas exportações. O mapa pertence à configuração de exportação desta demonstração; conecte as ações dos botões e a navegação na sua aplicação.

A página de preços usa um template de cartão de plano `reusable` e três instâncias `ref`. O editor expande as instâncias para renderizá-las e editá-las; esta demonstração reconcilia edições de texto, cor, tipografia e decoração de texto, opacidade, tamanho explícito e restrições de tamanho, espaçamento, alinhamento flex e dimensionamento de itens, borda sólida e sombra projetada de volta em substituições da instância, para os downloads de React e `.ic`. O cartão Growth demonstra uma borda de destaque. Valores numéricos de `flexBasis` e de restrições de tamanho viram valores em pixels nos estilos HTML/CSS e React. Se a estrutura de um cartão ou uma propriedade não suportada mudar, a exportação usa os nós expandidos para que o resultado ainda corresponda à tela.

As três exportações React também são renderizadas em um teste de navegador com React 19 e Tailwind CSS 4. O teste confere as posições-chave do texto em relação à pré-visualização HTML, para que esses exemplos continuem executáveis à medida que o gerador muda.

<DesignToCodeInterfaces />

Baixe o arquivo `.ic` para continuar editando o design no [aplicativo online](https://app.infinitecanvas.cc/) por **Importar de… > .ic**. Baixe o arquivo HTML e abra-o diretamente em um navegador. Para React, escolha **Baixar projeto React** para obter um ZIP inicial de Vite, React 19 e Tailwind CSS 4 a partir da tela atual. Extraia-o e, em seguida, execute `pnpm install` e `pnpm dev`; o componente exportado fica em `src/App.tsx`. O starter inclui a fonte Inter localmente quando o design a usa. Imagens `blob:` temporárias da tela atual são copiadas para `public/assets` e referenciadas por caminhos locais; data URLs permanecem inline e URLs remotas continuam remotas. O `src/responsive.css` adiciona layouts para telas estreitas nesses três exemplos, preservando o componente no tamanho da prancheta em `src/App.tsx`. Você também pode baixar apenas o arquivo `.tsx` para um projeto existente. O gerador atualmente emite marcação de apresentação; conecte navegação, ações de checkout, pagamentos e dados ao vivo à lógica da sua aplicação depois da exportação.

### Linha de comando {#cli}

O repositório também inclui uma CLI offline para arquivos `.ic` (Node.js 20+). Exporte o design a partir do editor com **Exportar como… > .ic** e salve-o como `design.ic`. A partir da raiz do repositório, compile as dependências do workspace nesta ordem e, em seguida, execute:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @infinite-canvas-tutorial/device-api build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/ecs build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/cli build
node packages/cli/dist/cli.js validate design.ic
node packages/cli/dist/cli.js inspect design.ic --json
node packages/cli/dist/cli.js codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
node packages/cli/dist/cli.js codegen design.ic --framework html-css --output design.html
```

`inspect --json` informa contagens de nós e de raízes, nós reutilizáveis, variáveis e contagens de URLs de assets. Omitir `--output` imprime o código gerado na stdout; documentos ou opções inválidos retornam um status de saída diferente de zero com uma mensagem de erro. A CLI produz o mesmo componente React ou fragmento HTML/CSS que o gerador de código do editor. Ela usa as variáveis e o tema do documento, não acessa um projeto online e rejeita imagens `blob:` temporárias que não sobrevivem fora do navegador. Use data URLs ou URLs de imagem duráveis nos documentos exportados.

### Inverso: código → design {#design-to-code-reverse}

A direção inversa (analisar a AST de JSX/HTML de volta para nós `.ic`) é mais difícil e mais ambígua, então fica para uma segunda fase. O primeiro marco recomendado é uma **ida e volta idempotente** do código que este transpilador emite (design → código → design sem perda de informação) antes de estender a código arbitrário escrito à mão.

## Leitura adicional {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[Lição 33 - Motor de layout]: /pt-BR/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
