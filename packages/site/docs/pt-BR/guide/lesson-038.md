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

Nós da tela são convertidos em elementos de layout, texto, imagem ou SVG. `reusable` e `ref` correspondem a componentes e instâncias React; variáveis são exportadas conforme o modo escolhido. Consulte o [mapeamento completo](/pt-BR/guide/design-to-code-reference#concept-mapping).

### Modos de variável {#design-to-code-variable-modes}

Os três modos de variável acompanham a semântica da exportação SVG:

-   `resolved` (padrão): resolve `$token` para literais (por exemplo, `bg-[#FFFFFF]`).
-   `css-var`: emite `var(--token)` para estilos (por exemplo, `bg-[var(--color-bg)]`). A exportação HTML/CSS inclui um bloco `:root { … }`; o React delimita as definições a cada componente exportado, inclusive componentes reutilizáveis renderizados sozinhos. Instâncias aninhadas compartilham o escopo do pai, então exportações separadas podem usar valores diferentes para o mesmo token. Tokens de conteúdo de texto resolvem para os valores atuais porque propriedades customizadas de CSS não podem substituir nós de texto.
-   `preserve-token`: mantém `$token` (encaminhado para um `style` inline para pós-processamento).

### Componentes e instâncias {#design-to-code-components}

Com `componentStructure: 'preserve'` (padrão), cada `reusable` é exportado como componente React e cada `ref` como instância. Alterações compatíveis de texto, estilo e layout viram props; outras expandem a instância para preservar sua aparência.

Consulte as regras para texto, imagens, preenchimentos, Path, recorte e mistura nos [detalhes de exportação](/pt-BR/guide/design-to-code-reference).

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

Experimente um painel de dados, uma página de preços e uma tela de checkout móvel na tela do editor IC. Edite os nós e gere, copie ou baixe código da tela atual. Selecione HTML/CSS e use **HTML preview** para conferir o resultado. A página de preços usa um cartão reutilizável.

<DesignToCodeInterfaces />

Baixe `.ic` para continuar editando no [aplicativo online](https://app.infinitecanvas.cc/) ou abra o HTML no navegador. Para React, baixe o projeto, extraia o ZIP e execute `pnpm install` e `pnpm dev`. O código gerado é a camada de apresentação; conecte navegação, pagamentos e dados na sua aplicação. Consulte os [detalhes de exportação](/pt-BR/guide/design-to-code-reference#practical-interface-examples).

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
