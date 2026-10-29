---
outline: deep
description: 'Implemente o Transformer de formas, com redimensionamento e rotação. Aprenda sobre pontos de âncora, conversão de sistemas de coordenadas, personalização do cursor CSS e expansão da área interativa para editar formas de um jeito intuitivo.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 21 - Transformer' }]
---

<script setup>
import TransformerRect from '../../components/TransformerRect.vue'
import TransformerRectRotated from '../../components/TransformerRectRotated.vue'
import TransformerLine from '../../components/TransformerLine.vue'
import TransformerPolyline from '../../components/TransformerPolyline.vue'
import TransformerPath from '../../components/TransformerPath.vue'
</script>

# Lição 21 - Transformer {#lesson-21-transformer}

Em [Lição 14], apresentamos brevemente o "modo de seleção" no modo da tela. Nesse modo, depois de selecionar uma forma, uma camada de operação é sobreposta a ela, e a forma pode ser movida ao arrastar. Nesta lição, vamos oferecer mais recursos de edição de formas, incluindo redimensionamento e rotação.

No Konva, a camada de operação sobre as formas selecionadas se chama [Transformer] e traz os exemplos a seguir:

-   [HTML5 Canvas Shape select, resize and rotate]
-   [Limit Dragging and Resizing]

Também escolhemos o nome Transformer. Ele se parece muito com a AABB da forma. Na prática, é uma OBB (oriented bounding box, caixa delimitadora orientada): um retângulo com ângulo de rotação nas coordenadas de mundo.

<TransformerRect />

## Serializar a matriz de transformação e as informações de dimensão {#serialize-transform-dimension}

No Figma, a matriz de transformação local e as informações de dimensão das formas são as seguintes. Para formas 2D, a matriz de transformação mat3 pode ser decomposta em translação, escala e rotação. X/Y correspondem à translação, e a escala será apresentada na seção [espelhamento](#flip). [fig-file-parser]

![fonte: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions](https://help.figma.com/hc/article_attachments/29799649003671)

Por isso, modificamos a estrutura [SerializedNode] para que ela descreva o maior número possível de formas, e removemos alguns atributos de posição, como `cx/cy` do Circle, já que `cx/cy` pode ser calculado a partir de `x/y` e `width/height`.

```ts
export interface TransformAttributes {
    // Transform
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    // Dimension
    width: number;
    height: number;
}
```

`<circle cx="100" cy="100" r="50" />` é serializado assim, usando `ellipse` para representá-lo e permitir um redimensionamento mais flexível no futuro:

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $circle = createSVGElement('circle');
    $circle.setAttribute('cx', '100');
    $circle.setAttribute('cy', '100');
    $circle.setAttribute('r', '50');
    const nodes = svgElementsToSerializedNodes([$circle]);
    return nodes[0];
});
```

Em formas como Polyline e Path, definidas pelos atributos `point` e `d`, esses atributos não podem ser removidos. É preciso calcular a AABB delas e recalcular esses atributos. Tome `<polyline points="50,50 100,100, 100,50" />` como exemplo:

```js eval code=false
call(() => {
    const { createSVGElement, svgElementsToSerializedNodes } = ECS;
    const $polyline = createSVGElement('polyline');
    $polyline.setAttribute('points', '50,50 100,100, 100,50');
    const nodes = svgElementsToSerializedNodes([$polyline]);
    return nodes[0];
});
```

## Pontos de âncora {#anchors}

Os pontos de âncora do Transformer se dividem em duas categorias, redimensionamento e rotação, com duas combinações comuns de quantidade.

Uma é a do Excalidraw e do Konva: 8 pontos de âncora ao redor do perímetro para redimensionar, mais um ponto de âncora independente para rotação:

![Fonte: https://csswolf.com/the-ultimate-excalidraw-tutorial-for-beginners/](https://sp-ao.shortpixel.ai/client/to_auto,q_lossy,ret_img,w_1148/https://csswolf.com/wp-content/uploads/2023/11/image-9.png)

A outra é a do tldraw e do Figma, com 4 pontos de âncora. Ao se aproximar desses 4 pontos pelo lado de fora, a interação vira rotação, e o redimensionamento horizontal e vertical é feito arrastando as quatro bordas:

![Fonte: https://wpdean.com/how-to-rotate-in-figma/](https://wpdean.com/wp-content/uploads/2024/12/how-to-rotate-in-figma.jpg)

Escolhemos esta solução, mais enxuta: uma máscara `Rect` como nó pai e quatro nós filhos `Circle` como pontos de âncora:

```ts
const mask = this.commands.spawn(
    new UI(UIType.TRANSFORMER_MASK),
    new Transform(),
    new Renderable(),
    new Rect(), // Using Rect component
);
const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT); // Using Circle component
const trAnchor = this.createAnchor(width, 0, AnchorName.TOP_RIGHT);
const blAnchor = this.createAnchor(0, height, AnchorName.BOTTOM_LEFT);
const brAnchor = this.createAnchor(width, height, AnchorName.BOTTOM_RIGHT);

this.commands
    .entity(mask)
    .appendChild(this.commands.entity(tlAnchor))
    .appendChild(this.commands.entity(trAnchor))
    .appendChild(this.commands.entity(blAnchor))
    .appendChild(this.commands.entity(brAnchor));
```

### Sistema de coordenadas do Transformer {#transformer-coordinates}

Em [Lição 6 - Coordenadas], implementamos a conversão entre os sistemas de coordenadas Viewport, Canvas e Client. Aqui entra um sistema novo: o sistema de coordenadas local da máscara. Quando a máscara tem transformações, como rotação, os pontos de âncora, que são nós filhos, precisam saber a própria posição no sistema de coordenadas de mundo. Adicionamos este conjunto de métodos de conversão:

```ts
transformer2Canvas(camera: Entity, point: IPointData) {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      matrix,
    );
    return {
      x,
      y,
    };
}
canvas2Transformer(camera: Entity, point: IPointData) {}
```

### Exibir o cursor CSS {#display-css-cursor}

Ao passar o mouse sobre um ponto de âncora, o estilo do mouse precisa mostrar de forma intuitiva a função correspondente. No lado web, isso é feito alterando o estilo do `<canvas>`. O [CSS cursor] padrão tem poucos ícones: não há um ícone com a semântica de rotação e, no Excalidraw e no Konva, só dá para usar `grab` no lugar. Há, sim, 8 ícones de redimensionamento, mas as formas podem estar rotacionadas. Quando o ângulo não é múltiplo inteiro de 45, mesmo calculando e escolhendo o ícone adequado como o Konva faz, não dá para representá-lo com precisão:

```ts
function getCursor(anchorName: string, rad: number) {
    rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
    const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

    if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
        return 'ns-resize';
    }
}
```

Por isso, usamos estilos de mouse personalizados, ajustados de forma dinâmica conforme o ângulo de rotação. [How can I rotate a css cursor] mostra um caminho com SVG, e o tldraw acrescenta a lógica de cálculo dinâmico do ângulo; veja [useCursor]. Tome o ponto de âncora superior direito como exemplo:

![Âncora de rotação](/transformer-anchor-rotate.png)

Aplique a transformação de rotação ao ícone SVG para obter o valor do cursor nesse momento:

```ts
// SVG angles are in degrees; both reflections are in the object's local axes.
const sx = scaleX < 0 ? -1 : 1;
const sy = scaleY < 0 ? -1 : 1;
const r = (rotation - cameraRotation) * RAD_TO_DEG;
const transform = `translate(16 16) rotate(${r}) scale(${sx} ${sy}) rotate(${tr}) translate(-16 -16)`;
```

Mantenha o sinal de cada eixo de escala. O SVG aplica as transformações da direita para a esquerda: oriente o desenho para a alça, reflita nos eixos locais do objeto e, em seguida, rotacione para o viewport. O determinante, sozinho, não distingue reflexão horizontal, vertical e dupla, e refletir depois da rotação aponta o cursor para a direção errada.

Quando o mouse se aproxima do ponto de âncora, a interação deixa de ser rotação e passa a ser redimensionamento:

![Âncora de redimensionamento](/transformer-anchor-resize.png)

Como disparar o picking ao se aproximar do ponto de âncora de longe?

### Expandir a área interativa {#hit-area}

A primeira ideia foi permitir que as formas expandam ou até personalizem a área interativa. O Pixi.js, por exemplo, oferece [hitArea]. Também podemos adicionar esse campo ao componente Renderable:

```ts
export class Renderable {
    @field({ type: Type.object, default: null }) declare hitArea: Circle | Rect;
}
```

Leve essa propriedade em conta ao calcular os limites no sistema ComputeBounds, para definir uma área de detecção circular maior do que o ponto de âncora:

```ts
if (hitArea instanceof Circle) {
    renderBounds = Circle.getRenderBounds(hitArea);
}
```

Essa abordagem tem um problema evidente: mesmo que a área interativa seja 5 vezes maior do que o ponto de âncora, quando a câmera dá zoom ainda é preciso passar o mouse sobre o ponto de âncora para disparar o picking. Por isso, o picking precisa acontecer fora do sistema de coordenadas de mundo da tela.

### Picking em coordenadas do viewport {#picking-in-viewport-coordinates}

A detecção de picking precisa ocorrer no sistema de coordenadas do viewport, para ignorar o zoom da câmera.

Primeiro, calcule as posições dos quatro pontos de âncora no sistema de coordenadas de mundo da tela, em vez de usar diretamente o `cx/cy` deles. Caso contrário, o resultado erra quando o próprio Transformer está rotacionado (vamos ver isso em breve):

```ts
hitTest(api: API, { x, y }: IPointData) {
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = camera.read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
        // Need to consider Transformer's own transformation, such as rotation
        api.transformer2Canvas(camera, {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
        }),
    );
    // Omit calculation of other anchor positions

    const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
}
```

Em seguida, verifique se a distância mínima até os quatro pontos de âncora está dentro do limite da interação de redimensionamento. Se estiver, devolva o nome do ícone de estilo do mouse correspondente e some o ângulo de rotação para obter o SVG rotacionado:

```ts
if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
        };
    }
}
```

Depois, entre na detecção da interação de rotação. Nesse momento, o ponto de detecção não pode estar dentro do Transformer. Dá para usar o método apresentado em [Check if Point Is Inside A Polygon]:

```ts
else if (
    !isInside &&
    minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
) {
    if (minDistanceToAnchors === distanceToTL) {
        return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
        };
    }
}
```

Por fim, chega a detecção de redimensionamento das quatro bordas do Transformer. Aqui é preciso calcular a distância do ponto de detecção até o segmento de reta; veja [Gist - point to line 2d]:

```ts
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';

const distanceToTopEdge = distanceBetweenPointAndLineSegment(
    point,
    [tlX, tlY],
    [trX, trY],
);
// Omit calculation of distance to other 3 edges

if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
    if (minDistanceToEdges === distanceToTopEdge) {
        return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
        };
    }
}
```

## Redimensionar uma única forma {#resize-single-shape}

No Figma / FigJam, além de mudar o tamanho livremente arrastando os quatro pontos de âncora dos cantos e as quatro bordas, você também pode:

-   Pressionar <kbd>Option</kbd> ou <kbd>Alt</kbd> enquanto arrasta, para escalar a partir do centro geométrico
-   Pressionar <kbd>Shift</kbd> enquanto arrasta, para fixar o canto ou a borda opostos e escalar de forma proporcional na horizontal e na vertical
-   Combinar essas teclas

O efeito é o seguinte, de [Resize, rotate, and flip objects in FigJam]:

![Redimensionamento no FigJam](https://help.figma.com/hc/article_attachments/1500011223302)

Vamos ver primeiro como implementar a mudança livre de tamanho. No ponto de âncora superior esquerdo, ao arrastar, o ponto de âncora inferior direito fica fixo:

```ts
private handleSelectedResizing(
    api: API,
    canvasX: number,
    canvasY: number,
    anchorName: AnchorName,
) {
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });
    if (anchorName === AnchorName.TOP_LEFT) {
        // Set top-left anchor point position
        Object.assign(tlAnchor.write(Circle), {
            cx: x,
            cy: y,
        });
    }
    // Omit other anchor point handling logic
    {
        const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
        const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
        const width = brCx - tlCx;
        const height = brCy - tlCy;
        const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
        // Recalculate selected shape position and size
        this.fitSelected(api, {
            x,
            y,
            width,
            height,
            rotation: this.#rotation,
        });
    }
}
```

Por fim, transforme a forma selecionada com base nos pontos de âncora superior esquerdo e inferior direito.

### Transformar a forma {#transform-shape}

Com as propriedades antes e depois do redimensionamento (transformação e dimensões), é simples calcular a matriz de transição entre esses dois estados:

```plaintext
// @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts#L1106

[delta transform] = [new transform] * [old transform inverted]
```

```ts
const baseSize = 10000000;
const oldTr = mat3.create();
mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
mat3.scale(oldTr, oldTr, [
    oldAttrs.width / baseSize,
    oldAttrs.height / baseSize,
]);
const newTr = mat3.create();
mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
mat3.rotate(newTr, newTr, newAttrs.rotation);
mat3.scale(newTr, newTr, [
    newAttrs.width / baseSize,
    newAttrs.height / baseSize,
]);

const delta = mat3.multiply(newTr, newTr, mat3.invert(mat3.create(), oldTr));
```

Essa matriz não pode ser aplicada diretamente à forma selecionada. Também é preciso considerar a transformação do nó pai no grafo de cena, no sistema de coordenadas de mundo:

```plaintext
[delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
```

A nova transformação da forma selecionada no sistema de coordenadas local sai da multiplicação à esquerda pela transformação de mundo do pai:

```plaintext
[new local] = [parent inverted] * [delta] * [parent] * [old local]
```

Por fim, a nova matriz no sistema de coordenadas local é aplicada à forma selecionada.

### Fixar a proporção {#lock-aspect-ratio}

Ainda no ponto de âncora superior esquerdo: com a proporção travada, a posição dele não pode ser definida diretamente. É preciso recalcular a posição do ponto superior esquerdo a partir da proporção da forma no início do arraste, mantendo o ponto inferior direito no lugar.

Primeiro, registre a OBB da forma selecionada e a proporção ao começar a arrastar o ponto de âncora, o que equivale à inclinação da diagonal:

```ts
if (input.pointerDownTrigger) {
    if (type === UIType.TRANSFORMER_ANCHOR) {
        this.#obb = this.getSelectedOBB();
        const { width, height } = this.#obb;
        const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
        this.#sin = Math.abs(height / hypotenuse);
        this.#cos = Math.abs(width / hypotenuse);
    }
}
```

Durante o arraste:

1. Mantenha a posição do ponto de âncora inferior direito
2. Calcule a distância da diagonal do superior esquerdo até o inferior direito nesse momento
3. Recalcule a posição do ponto de âncora superior esquerdo com a proporção salva antes

```ts
if (lockAspectRatio) {
    // 1.
    const comparePoint = {
        x: brAnchor.read(Circle).cx,
        y: brAnchor.read(Circle).cy,
    };
    // 2.
    newHypotenuse = Math.sqrt(
        Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
    );
    const { cx, cy } = tlAnchor.read(Circle);
    const reverseX = cx > comparePoint.x ? -1 : 1;
    const reverseY = cy > comparePoint.y ? -1 : 1;
    // 3.
    Object.assign(tlAnchor.write(Circle), {
        cx: comparePoint.x - newHypotenuse * this.#cos * reverseX,
        cy: comparePoint.y - newHypotenuse * this.#sin * reverseY,
    });
}
```

Vale observar que o Konva.js não permite arrastar as quatro bordas preservando a proporção. Nesse caso, é preciso desativar esses quatro pontos de âncora. Detalhes em [Is there a way to keep the image aspect ratio on transform?].

Aqui isso é simples. No arraste do ponto de âncora da borda direita:

1. Primeiro, defina a coordenada X do ponto de âncora inferior direito
2. Como a coordenada X do ponto superior esquerdo permanece a mesma, a largura transformada pode ser calculada
3. Com a proporção travada, a altura transformada também fica determinada
4. Com a diferença de altura antes e depois da transformação, defina as coordenadas Y dos pontos superior esquerdo e inferior direito

```ts
if (anchorName === AnchorName.MIDDLE_RIGHT) {
    // 1.
    brAnchor.write(Circle).cx = x;

    if (lockAspectRatio) {
        // 2.
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan; // 3.
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        // 4.
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
    }
}
```

Durante o arraste, a diagonal pode ser mostrada em tempo real para dar uma pista clara, em geral uma linha tracejada.

### Escala a partir do centro {#centered-scaling}

Ainda no ponto de âncora superior esquerdo, o ponto de referência fixo deixa de ser o inferior direito e passa a ser o centro geométrico, também registrado no início do arraste:

```ts
const comparePoint = centeredScaling
    ? {
          x: this.#obb.width / 2, // [!code ++]
          y: this.#obb.height / 2, // [!code ++]
      }
    : {
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
      };
```

Em seguida, recalcule a posição do ponto de âncora inferior direito, simétrico ao superior esquerdo em relação ao centro:

```ts
if (centeredScaling) {
    const tlOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
    const tlOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;
    Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - tlOffsetX,
        cy: brAnchor.read(Circle).cy - tlOffsetY,
    });
}
```

### Espelhamento {#flip}

Ao arrastar um ponto de âncora ou uma borda para o lado oposto, ocorre um espelhamento. O efeito a seguir é o do Figma; observe a mudança em Rotation:

![Rotação de 180° ao espelhar](/resize-flip.gif)

Usamos um fundo em gradiente para mostrar esse espelhamento com mais clareza:

![Espelhar um retângulo com preenchimento em gradiente](/rotate-when-flipped.png)

O espelhamento que cruza a borda fica desativado por padrão. O exemplo interativo no topo desta página o ativa e usa um gradiente de laranja para azul para deixar o espelhamento visível:

```ts
api.setAppState({ flipEnabled: true });
```

Mantenha fixos, durante todo o gesto, o quadro de seleção do pointer down, as transformações dos nós e a identidade das alças. Converta o ponteiro para esse quadro original e calcule dimensões com sinal em torno do canto ou da borda opostos (o centro, quando Alt / Option está pressionado). Uma dimensão negativa significa reflexão. Trocar as alças e tomar dimensões absolutas cedo demais perde essa reflexão, ou desloca a borda fixa no quadro seguinte. No tamanho exatamente zero, use uma dimensão pequena e diferente de zero e continue calculando as amostras seguintes a partir do quadro original.

Depois de aplicar a transformação, mantenha `width` / `height` do nó positivos e obtenha `rotation` e `scaleX` / `scaleY` da mesma decomposição de matriz. Combinar a rotação decomposta com os sinais de escala antigos está incorreto. Ao incorporar a geometria de caminho, polilinha ou vector-network, remova a rotação e a reflexão já mantidas no Transform, para que a geometria não seja espelhada duas vezes.

Uma matriz refletida pode ter decomposições equivalentes de rotação e escala. Confira a forma espelhada e o gradiente, a borda fixa e as posições das alças, sem exigir que Rotation mude 180°. Shift preserva a proporção e Alt / Option preserva o centro; o quadro ao soltar, o gesto seguinte e o desfazer/refazer devem permanecer consistentes.

## Rotação {#rotation}

Rotação no Figma:

> Passe o cursor logo fora de um dos limites da camada até o ícone aparecer.
> Clique e arraste para rotacionar a seleção:
> Arraste no sentido horário para criar um ângulo negativo (em direção a -180°).
> Arraste no sentido anti-horário para criar um ângulo positivo (em direção a 180°).
> Mantenha Shift pressionado para ajustar a rotação em incrementos de 15.

1. No pointer down, salve a OBB e os pivôs local e de mundo. Use o centro geométrico quando não houver um pivô personalizado.
2. Acompanhe o ângulo anterior do ponteiro em coordenadas da tela. Acumule os deltas adjacentes de `atan2`, normalizados com `atan2(sin, cos)`, para permanecer contínuo ao cruzar ±π.
3. Calcule a nova origem e a rotação a partir desse pivô fixo e da OBB inicial e, em seguida, atualize os nós por meio de `Select.fitSelected`. Durante a rotação de uma seleção múltipla, exiba o mesmo quadro inicial rotacionado; ao soltar, restaure a união alinhada aos eixos do mundo.

O módulo ECS `systems/select/rotate-gesture.ts` cuida do início do gesto, da amostragem, da conclusão e da limpeza. `Select` mantém o despacho da entrada, as atualizações dos nós e o histórico. `resize-gesture.ts` cuida das restrições de redimensionamento, do encaixe, do arraste de extremidades e dos deslocamentos de toque.

```ts
// Pointer down, after converting to canvas coordinates and pixel snapping:
beginRotateGesture(api, selection, { x: canvasX, y: canvasY });

// Pointer move:
updateRotateGesture(api, selection, { x: canvasX, y: canvasY }, (obb) => {
    this.fitSelected(api, obb, selection);
});

// Pointer up; Select records the resulting document once afterwards:
finishRotateGesture(api, selection);
```

<TransformerRectRotated />

### Alterar a origem da rotação {#change-the-rotation-origin}

O efeito a seguir é o de [Change the rotation origin] do Figma:

![Alterar a origem da rotação](https://help.figma.com/hc/article_attachments/31937330391447)

Notas de implementação:

1. Adicione um ponto de âncora central (`AnchorName.CENTER`) à máscara do transformer. Esse ponto pode ser arrastado.
2. Guarde a origem de rotação personalizada em coordenadas locais do transformer (`rotatePivotX/Y`) e marque se ela foi fixada pelo usuário (`rotatePivotPinned`).
3. No movimento do ponteiro, enquanto o ponto central é arrastado, converta as coordenadas da tela em coordenadas locais do transformer:

```ts
const { x, y } = api.canvas2Transformer({ x: canvasX, y: canvasY }, mask);
tf.rotatePivotX = x;
tf.rotatePivotY = y;
tf.rotatePivotPinned = true;
```

4. Durante a rotação, use esse pivô (volte ao centro geométrico se ele não estiver definido) e mantenha a posição de mundo do pivô fixa ao calcular a nova origem da OBB:

```ts
const {
    obb,
    pivotWorld: [px, py],
    pivotLocal: [lx, ly],
} = gesture;
const rotation = obb.rotation + gesture.accumulated;
const c = Math.cos(rotation);
const s = Math.sin(rotation);
const newAttrs = {
    ...obb,
    x: px - lx * obb.scaleX * c + ly * obb.scaleY * s,
    y: py - lx * obb.scaleX * s - ly * obb.scaleY * c,
    rotation,
};
```

5. Redefina o pivô para o centro quando o conjunto de nós selecionados mudar.

## Mover formas com as setas do teclado {#nudge-the-position}

O Figma oferece o recurso [Nudge layers], que permite mover formas com as setas para cima, para baixo, para a esquerda e para a direita. <kbd>Shift</kbd> também serve para deslocamentos maiores. Na nossa implementação, usamos distâncias fixas:

```ts
if (e.key === 'ArrowUp') {
    e.preventDefault();
    this.api.updateNodeOBB(selected, { y: selected.y - 10 });
    this.api.record();
}
```

## Alinhar e distribuir uma seleção {#align-distribute}

A API do ECS oferece seis modos de alinhamento: `left`, `right`, `top`, `bottom`,
`centerH` e `centerV`. Eles usam os limites da geometria no espaço de mundo, sem a
espessura do traço. Só a posição muda: rotação, reflexão, dimensões, dados de caminho,
métricas de texto e preferências de tamanho do Flex permanecem intactos, inclusive sob pais
rotacionados ou escalados.

```ts
const ids = [...api.getAppState().layersSelected];
await api.edit((editor) => {
    editor.alignSelectedNodes('left', ids);
});
// Run a separate edit so derived geometry is refreshed between operations.
await api.edit((editor) => {
    editor.distributeSelectedNodesSpacing('horizontal', ids);
});
```

O espaçamento aceita `horizontal` ou `vertical`, ordena os nós ao longo desse eixo de mundo
e calcula folgas iguais de borda a borda a partir da extensão da seleção. As folgas podem ser
negativas quando as formas se sobrepõem. IDs duplicados, nós excluídos, ausentes ou bloqueados e
transformações de pai não invertíveis são ignorados. Um descendente selecionado segue com
o ancestral selecionado, em vez de se mover duas vezes; são necessários pelo menos dois nós
elegíveis de nível superior. Os métodos devolvem se algum nó se moveu e não registram
sozinhos um layout que não mudou.

O painel de propriedades envia essas operações por `api.edit()`. Ele conserva
a tela e os IDs aceitos pelo clique, resolve os nós ao vivo na fase de escrita
e confirma um passo de desfazer. Se uma exclusão ou um bloqueio não deixar mudança, a operação
enfileirada é cancelada sem capturar edições pendentes sem relação. Quem chama a API
também pode passar um `AbortSignal` para `edit()` e cancelar antes da mutação.

## Transformer para outras formas {#transformer-for-other-shapes}

O transformer implementado até aqui serve para formas como círculos, elipses e retângulos. Ele não serve para retas, segmentos de polilinha ou curvas por partes, que exigem mais pontos de controle.

### Transformer para linha {#transformer-for-line}

Uma reta precisa de apenas dois pontos de âncora, o que simplifica bastante a série de operações baseada no retângulo delimitador que apresentamos antes.

```ts
export class Transformable {
    @field.ref declare lineMask: Entity;
    @field.ref declare x1y1Anchor: Entity;
    @field.ref declare x2y2Anchor: Entity;
}
```

![Transformer para linha](/line-transformer.gif)

<TransformerLine />

### Transformer para polilinha {#transformer-for-polyline}

Em uma polilinha, cada ponto de conexão tem um ponto de controle correspondente, e um ponto extra é inserido entre cada par de pontos de controle adjacentes para gerar um novo segmento de reta:

```ts
export class Transformable {
    @field.ref declare polylineMask: Entity;
    @field.object declare controlPoints: Entity[];
    @field.object declare segmentMidpoints: Entity[];
}
```

A interação correspondente é esta: ao passar o mouse sobre um ponto de controle, você pode pressionar <kbd>Delete</kbd> para removê-lo. Para acomodar o redimensionamento e a rotação do Transformer retangular e a edição de vértices, também há suporte a duplo clique para entrar no modo de edição de pontos de controle.

<TransformerPolyline />

### Path {#transformer-for-path}

O tldraw traz um exemplo: [cubic-bezier-shape]. Para a edição interativa, dois problemas precisam ser resolvidos:

1. **Pontos editáveis estáveis**: cada âncora e cada ponto de controle de Bézier podem ser selecionados e arrastados, e as mudanças são gravadas de volta em `d`.
2. **Ida e volta sem perder a semântica**: use, quando possível, um conjunto pequeno e previsível de tipos de comando, e evite escrever à mão um analisador completo de caminho no editor.

Normalizamos `d` em um vocabulário pequeno de comandos (por exemplo, convertendo comandos relativos em absolutos) e usamos **índice do comando + deslocamento da coordenada no array** como identidade de cada alça. Durante o arraste, só as coordenadas numéricas mudam; no fim, `path2String` serializa de volta para uma string.

| Comando | Alças produzidas   | Significado de `meta`                                                                                  |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| M / L   | Um vértice         | `coordOffset: 1` → esse ponto `(x, y)`                                                                 |
| Q       | Controle + fim     | deslocamentos `1` e `3`                                                                                |
| C       | cp1, cp2, fim      | deslocamentos `1`, `3`, `5`                                                                            |
| A       | Só o ponto final   | deslocamento `6` (arcos não têm alças de Bézier neste editor; só a extremidade fica exposta)          |

```ts
interface PathControlHandleMeta {
    commandIndex: number; // Index in the normalized command array.
    coordOffset: number; // Start index of this handle’s coordinates (1-based, since `command[0]` is the command letter).
}

type HandlePoint = {
    x: number;
    y: number;
    meta: PathControlHandleMeta;
};
```

Da mesma forma, dê um duplo clique para entrar no modo de edição de pontos de controle.

<TransformerPath />

## Leitura adicional {#extended-reading}

-   [Graphics Editor Development: Custom Cursor]

[Lição 14]: /pt-BR/guide/lesson-014
[Limit Dragging and Resizing]: https://konvajs.org/docs/sandbox/Limited_Drag_And_Resize.html
[HTML5 Canvas Shape select, resize and rotate]: https://konvajs.org/docs/select_and_transform/Basic_demo.html
[Transformer]: https://konvajs.org/api/Konva.Transformer.html
[Change the rotation origin]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01JTK11ERHCSVFRSE9F4125HAZ
[Resize, rotate, and flip objects in FigJam]: https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
[Nudge layers]: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions#h_01HNBH5565CW1S5FTNP6RZF00C
[How can I rotate a css cursor]: https://stackoverflow.com/questions/44817022/how-can-i-rotate-a-css-cursor
[Graphics Editor Development: Custom Cursor]: https://zhuanlan.zhihu.com/p/667709457
[useCursor]: https://github.com/tldraw/tldraw/blob/324a049abe8f414f96fdcbca68bb95396b6c1a46/packages/editor/src/lib/hooks/useCursor.ts#L12
[CSS cursor]: https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
[hitArea]: https://pixijs.com/8.x/examples/events/custom-hitarea
[Check if Point Is Inside A Polygon]: https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
[Gist - point to line 2d]: https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
[Lição 6 - Coordenadas]: /pt-BR/guide/lesson-006#coordinates
[SerializedNode]: /pt-BR/guide/lesson-010#shape-to-serialized-node
[fig-file-parser]: https://madebyevan.com/figma/fig-file-parser
[Is there a way to keep the image aspect ratio on transform?]: https://github.com/konvajs/react-konva/issues/407
[cubic-bezier-shape]: https://examples.tldraw.com/cubic-bezier-shape
