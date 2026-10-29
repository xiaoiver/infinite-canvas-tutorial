---
outline: deep
description: 'Sobreponha renderização 3D real de mesh à tela infinita 2D existente: espaço 3D unificado, Camera3D e MeshPipeline3D.'
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
import SvgExtrusion from '../../components/SvgExtrusion.vue'
import IconExtrusion from '../../components/IconExtrusion.vue'
</script>

# Lição 39 - Renderização de Mesh 3D {#lesson-39-3d-mesh-rendering}

Antes da [Lição 30 - Pós-processamento e grafo de renderização], tudo na tela passava pelo pipeline 2D: câmera ortográfica, SDFs, preenchimentos por triangulação de path e assim por diante. Esta lição adiciona um ramo de mesh 3D sem substituir esse renderizador 2D: os vértices carregam normais, projeção perspectiva/ortográfica, teste de profundidade e composição com camadas 2D na mesma tela.

## Framer, Spline, Rive e Bevy {#framer-spline-rive-bevy}

As ideias centrais da fusão 2D/3D no Framer e no Spline podem ser resumidas em dois caminhos técnicos — cada produto escolhe uma arquitetura diferente conforme o seu posicionamento.

A capacidade 3D do Framer é, na essência, um invólucro aprimorado em torno das transformações 3D de CSS, e não um pipeline real de renderização 3D. Isso significa que não há importação de modelos 3D externos (GLB/OBJ), nem iluminação, sombras ou sistema de materiais de verdade — os efeitos 3D ficam limitados a casos simples, como virar cartões e camadas de paralaxe. Veja: [How to Turn 2D Elements into Interactive 3D Objects in Framer]

![fonte: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

O Spline é um editor 3D de verdade, cuja arquitetura se aproxima de um motor de jogo. O Spline permite criar [UI Scenes] independentes (telas 2D) e usá-las como texturas em objetos UI Frame de uma cena 3D. [Working with 2D and 3D objects]

![fonte: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

O Rive ainda é, fundamentalmente, uma ferramenta 2D. A “sensação de 3D” vem de transformações 2.5D, deformação de mesh e truques semelhantes — não de um pipeline 3D completo.

A nossa abordagem se aproxima de [2D Rendering in Bevy]: as formas 2D vivem no plano **z = 0** e os modelos 3D compartilham o mesmo mundo; quando você faz pan/zoom na câmera 2D, a câmera 3D pode acompanhar de forma opcional. Veja a implementação no [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271).

## Visão geral da arquitetura {#architecture}

```plaintext
Same WebGL/WebGPU context
  └─ MeshPipeline render graph
       ├─ Pass: 3D (MeshPipeline3D.drawMeshes)
       ├─ Pass: 3D Gizmo (RenderGizmo3D.drawGizmos, on top of meshes)
       ├─ Pass: grid / 2D vector (existing BatchManager)
       └─ Pass: post-processing → present
```

-   **`Renderer3DPlugin`**: registra os componentes 3D e agenda `MeshPipeline3D` (cache de GPU), **`CameraSync`** (acoplamento com a câmera 2D), **`Pick3D`** (seleção/arraste) e **`RenderGizmo3D`** (desenho do gizmo de transformação).
-   **`MeshPipeline3D`**: não apresenta a própria swapchain; dentro do passe principal de `MeshPipeline`, ele **desenha o 3D primeiro e depois o 2D**, compartilhando os anexos de cor e de profundidade.
-   O **`Mesh.ts`** existente ainda é **preenchimento vetorial 2D** — não o confunda com o `Mesh3D` 3D.

Configuração do plugin:

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## Componentes principais {#components}

| Componente        | Papel                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`; quando `linked`, `CameraSync` acompanha o pan/zoom 2D                                  |
| **`Mesh3D`**      | `positions`, `normals`, `indices` opcionais (mesh de triângulos)                                                                      |
| **`Material3D`**  | PBR metallic-roughness: `baseColor`, `metallic`, `roughness` e intensidade do ambiente; campos legados permanecem por compatibilidade |
| **`Light3D`**     | `ambient` / `directional` / `point` / `spot`; veja [Exemplo de iluminação da cena](/example/lighting)                                 |
| **`Transform3D`** | translação, rotação de Euler, escala                                                                                                  |
| **`Selected3D`**  | estado de seleção 3D: modo do gizmo, eixo/plano ativo, ponto de referência do arraste etc. (veja [Gizmo de transformação 3D](#gizmo)) |
| **`Mat4`**        | utilitários de matriz 4×4 (`perspective` / `ortho` / `lookAt`)                                                                        |

Gere entidades pelo `commands.spawn` do ECS, por exemplo:

```ts
import {
    Camera3D,
    Mesh3D,
    Material3D,
    Transform3D,
} from '@infinite-canvas-tutorial/ecs';

commands.spawn(
    new Camera3D({
        eye: [3, 3, 5],
        center: [0, 0, 0],
        clearColor: true,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        baseColor: [0.25, 0.55, 0.95, 1],
        ambient: 0.45,
        diffuse: 0.75,
        specular: 0.4,
        shininess: 48,
    }),
    new Transform3D({
        translation: [0, 0, 0],
        rotation: [0.3, 0.6, 0],
        scale: [1, 1, 1],
    }),
);
```

## Espaço 3D unificado (câmera vinculada) {#unified-space}

Para **fazer pan/zoom na tela e mover o 2D e o 3D juntos**, defina `linked: true` em `Camera3D`.

A cada quadro, `CameraSync` lê o `ComputedCamera` 2D `(x, y, zoom)` e escreve `eye` / `center` / `baseDistance` da câmera 3D:

-   Zoom: `baseDistance = canvas.height / 2`, `eye.z = baseDistance / zoom`, acompanhando a altura visível de `mat3.projection` 2D em z = 0
-   **Ortográfica vinculada** (`projection: 'orthographic'`): `eye = [x, -y, distance]`, `center = [x, -y, 0]` (o Y da tela 2D aponta para baixo, o Y do mundo 3D aponta para cima — invertido por `canvasWorldToWorld3D`)
-   **Perspectiva vinculada** (`projection: 'perspective'`): `eye = [x, y, distance]`, `center = [x, y, 0]` (igual aos nós 2D — **coordenadas da tela, Y para baixo**)

### Vinculada + ortográfica {#linked-orthographic}

`MeshPipeline3D` usa diretamente a `viewProjectionMatrix` 2D (incluindo a inversão de Y, o pan e o zoom), o que mantém `extrude3d` e os retângulos 2D estritamente alinhados.

O exemplo [Cubo (ortográfico)](/example/cube) usa **vinculada + ortográfica** (`translation: [200, 100, 40]`).

<Cube />

### Vinculada + perspectiva {#linked-perspective}

No modo perspectiva, a posição na tela vem da **VP 2D completa** (pan, zoom e inversão de Y acompanham o 2D); a profundidade usa uma matriz de perspectiva em `Transform3D.translation.z` para o encurtamento. A âncora é `(x, y, z)` de `translation`, então o objeto cai no mesmo `(x, y)` que no 2D.

[Cubo (perspectiva)](/example/cube-perspective) usa a configuração **vinculada + perspectiva** acima; quando você arrasta a tela, o cubo deve fazer pan e zoom junto com as camadas 2D.

<CubePerspective />

## Seleção por raycast {#raycast-picking}

A seleção 3D e a interação com o gizmo ficam a cargo do sistema **`Pick3D`** (também usado a partir de **`Select`** quando a ferramenta Selecionar está ativa). No pointer down, o pixel da viewport sob o cursor é testado contra os controles do gizmo e os triângulos de `Mesh3D`. Não há passe de picking na GPU — tudo roda na CPU em `ray-casting.ts` e `pick3d-probe.ts`.

### Pipeline {#pipeline}

```plaintext
viewport (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene (same matrices as rendering)
       └─ probePick3DAtViewport(…)
            ├─ 1. gizmo parts on Selected3D entities (screen-space / ray, per part)
            └─ 2. all Mesh3D on this canvas → keep closest hit (smallest t)
```

**Prioridade**: entidades já selecionadas são sondadas primeiro nos **controles do gizmo**; só se nenhum acertar é que a sonda testa as meshes da cena. Entre as meshes, vence o acerto com a **menor distância** ao longo do raio (ou a maior profundidade na perspectiva vinculada).

### Raycast padrão (ortográfica / câmera livre) {#standard-raycast-orthographic-free-camera}

Nos modos que não são perspectiva vinculada, o picking espelha os editores 3D clássicos:

1. **`screenToRay`**: pixels da viewport → NDC → desprojeta near/far com **`inv(view × projection)`** para obter um raio no espaço do mundo.
2. **`rayMeshIntersection`**: transforma os vértices da mesh com a matriz de modelo da entidade e, em seguida:
    - **Fase ampla**: raio contra a **AABB** transformada (método das fatias).
    - **Fase estreita**: teste raio–triângulo de **Möller–Trumbore** em cada triângulo; conserva o `t` mais próximo.

```ts
// packages/ecs/src/utils/ray-casting.ts (simplified)
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

A **ortográfica vinculada** (`linked + orthographic`) reutiliza o mesmo caminho: `MeshPipeline3D` alimenta a `viewProjectionMatrix` 2D na cena de picking, então os cliques permanecem alinhados aos retângulos 2D e a `extrude3d`.

### Perspectiva vinculada: triângulos em espaço de tela {#linked-perspective-screen-space-triangles}

A **perspectiva vinculada** **não** usa um raio de mundo para acertos na mesh. A posição na tela é conduzida pela VP 2D completa; a profundidade vem de uma matriz de perspectiva separada em `translation.z`. Para acompanhar o vertex shader, **`pickMeshLinkedPerspective`** projeta cada triângulo no espaço da viewport com os mesmos uniforms, testa se o cursor está dentro do **triângulo 2D projetado** (`pointInTriangle2D`) e escolhe a **profundidade mais à frente** naquele pixel. As partes do gizmo nesse modo reutilizam o mesmo auxiliar (com um viés Z opcional na tela para os controles).

Isso mantém “o que você vê é o que você seleciona” ao fazer pan/zoom na tela infinita com um cubo em perspectiva.

### Restrições de arraste {#drag-constraints}

Um pressionamento no gizmo cria uma `GizmoSession` com a pose inicial e uma projeção fixa.
Para câmeras comuns, o movimento do ponteiro intersecta um raio com o plano de restrição
ativo. Câmeras vinculadas invertem a projeção exibida do controle, inclusive o deslocamento Z
na tela. A translação segue o eixo ou o plano selecionado; a rotação segue
o eixo local do anel. Amostras inválidas ou degeneradas deixam a pré-visualização inalterada.

A sessão atualiza os componentes de runtime durante o movimento. Ao soltar, uma fonte
declarativa publica uma edição do documento e uma entrada de desfazer. Escape, cancelamento do ponteiro
ou sair da tela restaura a pose inicial sem registrar uma edição.

Mudar a câmera ativa, a projeção/visão dela ou o tamanho da tela cancela um
gesto em andamento. Edições externas na pose da fonte, na geometria ou na transformação
de um ancestral também o cancelam: a pré-visualização de runtime volta ao **documento atual**,
então um pointer release antigo não pode sobrescrever uma edição de API ou um desfazer. Edições sem relação,
como nomes e cores, podem se fundir com um arraste que continua normalmente. Mudanças
em outra tela não o interrompem. Pressione um controle de novo para começar na nova visão.

O layout computado também faz parte do contexto do gesto. O Yoga pode mudar a posição
ou o tamanho de uma fonte sem mudar esses campos do documento; essas mudanças, inclusive
transformações de ancestrais, cancelam a pré-visualização. O cancelamento preserva o novo layout
e restaura apenas as coordenadas que ainda pertencem à pré-visualização. Escape em um layout
que de resto não mudou volta à posição inicial computada, mesmo quando ela difere
do documento. As próprias escritas de pré-visualização da sessão não a invalidam.

`GizmoSourceFrame` captura um instantâneo da geometria local da fonte e dos ancestrais, evitando
interrupções falsas por atualizações atrasadas da matriz de mundo. Enquanto uma sessão de ponteiro possui
a pré-visualização da fonte, a sincronização do companion não escreve essa fonte de novo.
Integrações que manipulam um companion diretamente conservam a sincronização reversa.

Quadros inalterados não reescrevem transformações nem materiais do companion, e edições de pose ou
de material reutilizam a geometria de CPU gerada. Mudanças na configuração da geometria
invalidam esse cache de forma independente.

`MeshPipeline3D` também reutiliza buffers de GPU de vértice, normal, UV, índice e uniform por mesh
durante edições de pose/material. Só escritas em `Mesh3D` invalidam a geometria;
ao editar arrays diretamente, adquira o componente com `entity.write(Mesh3D)`
primeiro. O cache consome essas escritas depois da sincronização do companion, conserva
elas entre desenhos pulados e envia a substituição uma vez no próximo desenho.
Meshes com arrays de geometria idênticos compartilham a geometria enviada dentro de uma
tela, enquanto cada mesh conserva o próprio uniform de modelo e os bindings de desenho. Uma
edição de geometria in-place envia uma nova geração; as outras instâncias conservam o
instantâneo anterior da GPU até serem atualizadas ou removidas.
Cada tela possui o próprio cache e os uniforms de cena. Remover uma mesh ou movê-la para
outra tela libera os buffers antigos, e descartar a tela libera os
recursos dela antes do device. Alocações que falham são revertidas e podem ser
tentadas de novo sem substituir a entrada de cache completa anterior.

As matrizes de modelo e de normal só são recalculadas quando a pose muda. Os envios
do uniform de modelo também pulam quadros inalterados e mudanças só de câmera; edições de material
e cargas de textura concluídas atualizam os uniforms sem reconstruir essas
matrizes. Edições in-place em arrays de transformação/cor são comparadas por valor.

Os uniforms de cena ficam em cache por tela. Mudanças de câmera e da visão 2D vinculada atualizam
as matrizes da cena; mudanças de luz reempacotam a iluminação sem reconstruir essas matrizes.
Desenhos inalterados reutilizam tanto os dados da cena quanto os bindings de desenho de cada mesh. Prontidão
ou substituição de textura, reconstruções de geometria e substituição de recurso de GPU invalidam
os bindings afetados. Os bindings são liberados antes dos buffers e das texturas que
referenciam. Envios de cena e alocações de binding que falham continuam podendo ser tentados de novo.

A lista de camadas 3D acompanha mudanças de geometria, metadados, escopo e associação do ECS,
em vez de varrer cada mesh a cada quadro ocioso. A associação da seleção é acompanhada
à parte, então passar o mouse sobre os controles do gizmo não reconstrói a lista. As entradas de camada
conservam referências estáveis de entidade para seleção posterior, inclusive depois de desfazer/refazer.

Veja [Gizmo de transformação 3D](#gizmo) para as cores dos controles, os eixos e o fluxo completo do ponteiro.

## Gizmo de transformação 3D {#gizmo}

Com a **ferramenta Selecionar** (`penbarSelected === Pen.SELECT`), clicar em uma mesh 3D adiciona **`Selected3D`** à entidade e desenha controles de **translação** no centro dela: setas vermelha/verde/azul mais widgets de plano semitransparentes. Arrastar um controle grava de volta em **`Transform3D.translation`**. É semelhante ao `Selected` + `RenderTransformer` 2D, mas por um caminho separado de picking e desenho 3D.

### Fluxo de interação {#gizmo-flow}

```plaintext
pointer down (Select tool)
  └─ Pick3D: probe gizmo first, then Mesh3D
       ├─ hit gizmo → capture pose/projection, create GizmoSession
       └─ hit mesh → select; miss → clear selection

pointer move (held)
  └─ GizmoSession.update → constrained runtime preview

pointer up
  └─ finish(true) → publish source pose once, record history

Escape / pointer cancel / leave
  └─ finish(false) → restore pose, clear gesture state
```

### Coordenadas e significado dos controles {#gizmo-axes}

De forma consistente com o [Espaço 3D unificado](#unified-space), o gizmo usa **coordenadas da tela (Y para baixo)**, e não o Y para cima no estilo do Blender:

| Cor      | Eixo | Direção (visão típica da tela vinculada)    | O arraste atualiza |
| -------- | ---- | ------------------------------------------- | ------------------ |
| Vermelho | +X   | direita                                     | `translation.x`    |
| Verde    | +Y   | para baixo                                  | `translation.y`    |
| Azul     | +Z   | **profundidade** (`z+` para dentro da tela) | `translation.z`    |

-   **Setas**: transladam ao longo de um único eixo.
-   **Planos** (quadrados semitransparentes `xy` / `xz` / `yz`): movem dois componentes de uma vez (por exemplo, `xy` = só X e Y, sem Z).

-   **Modo combinado `transform` (padrão, no estilo do Spline)**: mostra setas/planos de translação **e** anéis de rotação ao mesmo tempo; o controle que você agarra executa essa operação (`activePartKind`: `translate` | `rotate`) — sem troca de modo `W` / `E`.
-   Arrastar **seta / plano** → atualiza `Transform3D.translation`; arrastar **anel** → atualiza `Transform3D.rotation` (ângulos de Euler locais, iguais aos da mesh).
-   Os anéis acompanham a orientação atual do objeto; as setas permanecem nos eixos de mundo da tela (X à direita, Y para baixo, Z em profundidade).
-   O picking usa o acerto **mais próximo** em espaço de tela; quando há sobreposição, as setas ficam por cima, então a translação vence. `scale` fica reservado para depois.

### Edição de retângulos extrudados {#extrude-editing}

Um `rect` com `extrude3d` usa o mesmo gizmo que uma mesh declarativa. As opções
serializáveis agora incluem elevação e uma rotação 3D local:

```ts
const node: RectSerializedNode = {
    id: 'extruded-card',
    type: 'rect',
    zIndex: 0,
    x: 100,
    y: 80,
    width: 160,
    height: 100,
    extrude3d: { depth: 80, z: 20, rotation: [0.2, 0.3, 0] },
    fills: [{ type: 'solid', value: '#3377dd' }],
};
```

-   A translação XY grava o `x`/`y` do retângulo de origem nas coordenadas do pai,
    inclusive pais rotacionados, escalados ou espelhados. Uma transformação singular do pai rejeita
    a pré-visualização porque a inversa dela não existe.
-   A translação Z muda `extrude3d.z`, preservando `depth`. Com rotação 3D zero,
    `z` é a elevação do plano da frente; o centro do companion fica em `z - depth / 2`.
-   A rotação do anel grava `extrude3d.rotation`: ângulos de Euler XYZ em radianos, relativos
    à rotação 2D já existente da origem no espaço do mundo. Ela deixa a `rotation`
    2D da origem intacta. Para uma forma rotacionada comum, o companion compõe
    `Rz(sourceAngle) × Rx(x) × Ry(y) × Rz(z)`.

Soltar confirma uma vez; o cancelamento restaura a pré-visualização. Desfazer/refazer e recarregar
o documento restauram a mesma pose. Desativar a extrusão ou substituir o companion
dela interrompe o gesto e restaura o documento atual em vez de recriar
um companion obsoleto.

`extrude3d: true` ainda significa uma profundidade de 100, e um número ainda especifica a profundidade.
Valores objeto usam por padrão profundidade 100, elevação 0 e rotação `[0, 0, 0]`. Uma atualização
substitui o valor inteiro da opção: campos omitidos voltam a esses padrões. Ainda
não há controles de escala; use as dimensões do retângulo e `depth` para mudar o tamanho.
A extrusão de retângulo segue os cantos locais através de rotação e escala. Cantos
arredondados, reflexões e cisalhamento de pais transformados são incorporados à mesh,
então a pegada permanece alinhada à origem 2D editável. Uma transformação
singular do pai não consegue produzir uma mesh nova.

### Extrusão de um Path fechado {#extrude-path}

Um Path fechado com um preenchimento sólido pode usar a mesma opção `extrude3d`. As faces
da frente e de trás seguem os contornos preenchidos, inclusive furos; editar `d` ou
`fillRule` reconstrói a mesh. A translação a reutiliza. O cisalhamento de pais
transformados é incorporado à mesh, então mudanças nessa transformação linear a reconstroem.

```ts
const vector: PathSerializedNode = {
    id: 'extruded-vector',
    type: 'path',
    zIndex: 0,
    x: 100,
    y: 80,
    d: 'M100 80 L200 80 L200 180 L100 180 Z M125 105 L125 155 L175 155 L175 105 Z',
    fillRule: 'evenodd',
    fills: [{ type: 'solid', value: '#3377dd' }],
    extrude3d: { depth: 40, z: 0, sideColor: '#facc15' },
};
```

Todos os subpaths precisam estar fechados. Paths abertos, camadas de traço, preenchimentos múltiplos ou
não sólidos, contornos não manifold e transformações singulares permanecem visíveis em 2D. O
Path conserva o nó original do documento e suporta edições de gizmo, desfazer e recarregar.

### Transformar ícones em 3D {#icon-to-3d}

<IconExtrusion />

No App, selecione um Icon e abra **3D → Converter ícone para 3D**. Escolha uma profundidade e
um preset de material (fosco, brilhante ou metal). A conversão expande os traços SVG,
inclusive caps e joins, em contornos fechados. Partes preenchidas e furos viram
Paths editáveis dentro de um grupo. Selecione o grupo para mudar a profundidade ou o material de
todas as partes; selecione um Path para editar o contorno ou o chanfro. Desfazer restaura o IconFont.
A conversão é um instantâneo da geometria do ícone.

Depois de registrar um conjunto de ícones com `registerIconifyIconSet`, o código pode usar a mesma
conversão:

```ts
const result = iconFontToExtrudedPaths(iconNode, {
    depth: 40,
    bevelSize: 2,
    metallic: 1,
    roughness: 0.25,
});
if (result) api.updateNodes([result.group, ...result.paths]);
```

`metallic` e `roughness` são parâmetros PBR entre 0 e 1. Esses presets usam
o pipeline de iluminação existente. Vidro transparente e refração ainda não
são suportados. Filtros SVG, gradientes e pinturas não suportadas podem exigir uma limpeza
manual do contorno antes da extrusão.

`sideColor` é uma cor CSS opcional para as paredes; a frente e o verso conservam o
preenchimento de origem. Omiti-la faz todas as faces usarem a cor de preenchimento da origem. A cor
lateral é uma mudança de pintura, então editá-la reutiliza a geometria de mesh existente.

Os elementos SVG `<path>`, `<polygon>`, `<rect>`, `<circle>` e `<ellipse>`, além de
elementos `<polyline>` fechados, podem ser importados como fontes de extrusão preenchida com
`svgElementsToExtrudedNodes`. O auxiliar preserva as outras formas importadas em 2D;
profundidade inválida é rejeitada em vez de ser silenciosamente trocada por um padrão.

```ts
import { svgElementsToExtrudedNodes } from '@infinite-canvas-tutorial/ecs';

const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
const nodes = svgElementsToExtrudedNodes(
    svg.documentElement as unknown as SVGSVGElement,
    40,
);
api.updateNodes(nodes);
```

No App online, selecione um retângulo ou um Path para abrir o controle **3D** na
barra de ferramentas superior. Ative a extrusão e, em seguida, edite a profundidade e o chanfro. O menu do projeto
também oferece **Importar SVG como 3D**, que centraliza a arte visível na
tela, mesmo quando ela ocupa só parte da viewport do SVG, e conserva
camadas não suportadas em 2D. Use **Exportar como → GLB (3D)** para
baixar todas as meshes extrudadas prontas do projeto. O App também permite definir um
perfil de chanfro (1–8 segmentos) e uma cor lateral hexadecimal opcional; deixe a
cor lateral em branco para usar o preenchimento da forma.
Para um Path que não consegue produzir uma mesh, o App desativa a ação de extrusão
e mostra os requisitos de contorno fechado, preenchimento e traço.

**Suporte de importação:** contornos fechados com preenchimento sólido e traços sólidos compatíveis podem ser convertidos em formas 3D editáveis. Gradientes, padrões e outras camadas não extrudáveis permanecem em 2D. Furos, transformações de grupo, referências locais e recortes compatíveis são preservados; referências externas, máscaras e filtros não são convertidos em 3D.

A demonstração permite explorar traços, recortes e referências repetidas. Consulte os [detalhes de compatibilidade SVG](/pt-BR/guide/svg-extrusion-reference).

Defina `extrude3d.bevelSize` (em unidades da tela) para um chanfro nas duas extremidades das
extrusões de Path e Rect. A demonstração expõe isso como **Chanfro**. Furos, várias
ilhas e cantos côncavos são suportados quando o deslocamento para dentro preserva a
topologia preenchida. Se os contornos colidem ou uma região estreita colapsa, a forma
conserva as arestas vivas. Mudar a profundidade ou o tamanho reconstrói a mesh companion
e mantém a origem editável.
Formas com mais de 4096 vértices nos limites de preenchimento resolvidos também
permanecem vivas para limitar o trabalho da mesh.

Defina `extrude3d.bevelSegments` como `1` para um chanfro reto (o padrão), ou
`2`–`8` para um perfil de quarto de círculo arredondado. Mais segmentos deixam a silhueta
mais suave e acrescentam triângulos à mesh. O controle **Perfil do chanfro** da demonstração permite
comparar perfis retos e arredondados em formas SVG importadas.

O botão **Baixar GLB** do exemplo exporta as meshes 3D geradas como um
arquivo binário glTF autocontido. Use `api.exportGlb` para baixar todas as formas extrudadas
prontas, ou passe nós para exportar só uma seleção (inclusive filhos de grupos
selecionados):

```ts
await api.exportGlb();
const glb = await api.exportGlb({
    nodes: [api.getNodeById('extruded-vector')!],
    download: false,
}); // Uint8Array
```

A exportação converte coordenadas da tela com Y para baixo em coordenadas glTF com Y para cima e conserva
a pose 3D atual, o preenchimento sólido e a cor lateral opcional. Ela exporta apenas
companions de mesh prontos; formas SVG 2D não suportadas não são incluídas. Texturas de cor base
são embutidas como PNG ou JPEG (outros formatos decodificáveis são convertidos para PNG).
As URLs de textura precisam permitir fetches CORS. O `api.export({ format:
ExportFormat.GLB })` síncrono continua disponível para exportações sem textura.
Para exportações de mesh de mais baixo nível, chame `exportMeshesToGlb(sources, await loadGlbImages(sources))`.

Use **Amostra de ViewBox + cisalhamento** para inspecionar o contorno transformado e o
furo evenodd dele e, em seguida, desligue a extrusão para comparar a pegada 2D.
Use **Amostra de recorte slice** para ver um furo, duas peças separadas e uma borda
curva cortada pela viewport do SVG.

<SvgExtrusion />

## Iluminação {#lighting}

Compare luz ambiente, direcional, pontual e spot na cena abaixo. Ajuste o metal e a rugosidade da esfera, troque o mapa de ambiente e experimente as sombras ou o spot móvel.

Uma cena aceita até oito luzes diretas, e até duas luzes elegíveis podem projetar sombras. Use `material3d.emissiveFactor` / `emissiveStrength` para emissão, `material3d.unlit` para material sem iluminação e `alphaMode` para recortes ou transparência.

Consulte a [referência de iluminação](/pt-BR/guide/lighting-reference) para parâmetros e limites e o [exemplo de iluminação](/example/lighting) para a API e os controles.

<Lighting />

## Modelo glTF {#gltf}

Carregue um glTF/GLB externo por meio da geometria declarativa `mesh3d` (`geometry: { type: 'gltf', url: '…' }`). A amostra **Duck** da Khronos usa um par `.gltf` + `.bin` em `/data/`; as meshes são centralizadas e normalizadas para limites unitários e, em seguida, escaladas com `scale3d`.

Os fatores de cor base do glTF usam RGB linear, enquanto o ECS armazena as cores base do material como sRGB. A importação converte entre os dois; a exportação GLB converte de volta para RGB linear, para que as cores do material permaneçam estáveis em uma ida e volta.

O importador também preserva `doubleSided`, `normalTexture`, `occlusionTexture` e atributos `TANGENT` de autoria do glTF. Mapas de normal alteram a normal de iluminação; a oclusão afeta apenas a luz indireta. O [modelo PBR interativo](/example/gltf-duck#pbr-material) explica quando o mapeamento de normal usa tangentes de autoria ou as deriva dos UVs.

As cores de vértice `COLOR_0` do glTF (float ou byte/short sem sinal normalizado, RGB ou RGBA) multiplicam a cor base do material no espaço linear. O [modelo interativo de cor de vértice](/example/gltf-duck#vertex-colors) mostra o resultado com e sem iluminação de cena. A exportação preserva as cores como RGBA float.

O importador aceita listas de triângulos, triangle strips (`mode: 5`) e triangle fans (`mode: 6`), com ou sem índices. Ele os converte em listas de triângulos para renderização e exportação GLB. Transformações de nó espelhadas também corrigem o winding dos triângulos, para que superfícies de um lado só permaneçam visíveis.

Accessors esparsos do glTF são suportados para posições, normais, UVs, cores, tangentes e índices de triângulo. Dados de base ausentes começam em zero; os valores esparsos substituem apenas os elementos listados. A mesh importada é exportada como buffers GLB densos comuns.

<GltfDuck />

## Leitura adicional {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html) (referência de camadas de plugin)

[Lição 30 - Pós-processamento e grafo de renderização]: /pt-BR/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
