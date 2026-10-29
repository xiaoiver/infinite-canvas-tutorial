---
outline: deep
description: 'Implementa los modos del lienzo y la interfaz auxiliar, incluidas las propiedades de dibujo zIndex y sizeAttenuation. Añade el modo mano para manipular el lienzo y el modo de selección para editar formas con paneles de propiedades.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 14 - Modo del lienzo e interfaz auxiliar',
          },
      ]
---
# Lección 14 - Modo del lienzo e interfaz auxiliar {#lesson-14-canvas-mode-and-auxiliary-ui}

Antes implementamos algunos componentes de UI del lienzo con Web Components, entre ellos el zoom de la cámara y la descarga de imágenes. En esta lección expondremos más capacidades del lienzo a través de componentes e implementaremos algunas propiedades de dibujo nuevas:

-   Implementar las propiedades de dibujo `zIndex` y `sizeAttenuation`
-   Mover, rotar y escalar el lienzo en el modo mano
-   Seleccionar, arrastrar y mover formas en el modo de selección, y mostrar el panel de propiedades de la forma

Antes de implementar los modos del lienzo, hay que hacer un trabajo preparatorio para admitir las propiedades de dibujo `zIndex` y `sizeAttenuation`.

## Implementar zIndex {#z-index}

La capa de máscara que se muestra después de seleccionar una forma tiene que aparecer por encima de todas las formas, lo que implica el orden de visualización, controlado por `zIndex`:

```ts
mask.zIndex = 999;
```

En CSS, [z-index] solo tiene sentido dentro del mismo [contexto de apilamiento]. Por ejemplo, en la figura de abajo, aunque `DIV #4` tiene un `z-index` más alto que `DIV #1`, se renderiza más abajo porque está en el contexto de `DIV #3`:

![Comprender z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context/understanding_zindex_04.png)

Como ordenar es una operación que consume mucho rendimiento, añadimos a Shape una propiedad `sortDirtyFlag`, que se pone a `true` cada vez que cambia `zIndex`:

```ts
class Sortable {
    get zIndex() {
        return this.#zIndex;
    }
    set zIndex(zIndex: number) {
        if (this.#zIndex !== zIndex) {
            this.#zIndex = zIndex;
            this.renderDirtyFlag = true;
            if (this.parent) {
                this.parent.sortDirtyFlag = true; // [!code ++]
            }
        }
    }
}
```

También hay que tenerlo en cuenta en `appendChild` y `removeChild`:

```ts
class Shapable {
    appendChild(child: Shape) {
        if (child.parent) {
            child.parent.removeChild(child);
        }

        child.parent = this;
        child.transform._parentID = -1;
        this.children.push(child);

        if (!isUndefined(child.zIndex)) {
            this.sortDirtyFlag = true; // [!code ++]
        }

        return child;
    }
}
```

Después, en cada tick del bucle de renderizado, se hace una comprobación de modificado y se ordena si hace falta. Tampoco queremos cambiar `children` directamente, sino usar `sorted` para guardar el resultado de la ordenación: al fin y al cabo, `z-index` solo debe afectar al orden de renderizado, no al orden real en el grafo de escena:

```ts
traverse(this.#root, (shape) => {
    if (shape.sortDirtyFlag) {
        shape.sorted = shape.children.slice().sort(sortByZIndex); // [!code ++]
        shape.sortDirtyFlag = false; // [!code ++]
    }
    // Omit rendering each shape.
});
```

La implementación de `sortByZIndex` es la siguiente: si `zIndex` está definido, se ordena en orden descendente; si no, se mantiene el orden original en el nodo padre. Esto también muestra por qué no cambiamos `children`: conserva la base de ordenación predeterminada:

```ts
export function sortByZIndex(a: Shape, b: Shape) {
    const zIndex1 = a.zIndex ?? 0;
    const zIndex2 = b.zIndex ?? 0;
    if (zIndex1 === zIndex2) {
        const parent = a.parent;
        if (parent) {
            const children = parent.children || [];
            return children.indexOf(a) - children.indexOf(b);
        }
    }
    return zIndex1 - zIndex2;
}
```

```js eval code=false
circle1Zindex = Inputs.range([-10, 10], {
    label: 'z-index of red circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
circle2Zindex = Inputs.range([-10, 10], {
    label: 'z-index of green circle',
    value: 0,
    step: 1,
});
```

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
circle1 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 100,
        cy: 100,
        r: 50,
        fill: 'red',
    });
});
```

```js eval code=false inspector=false
circle2 = call(() => {
    const { Circle } = Core;
    return new Circle({
        cx: 150,
        cy: 150,
        r: 50,
        fill: 'green',
    });
});
```

```js eval code=false inspector=false
call(() => {
    circle1.zIndex = circle1Zindex;
    circle2.zIndex = circle2Zindex;
});
```

```js eval code=false inspector=false
call(() => {
    $icCanvas3.setAttribute('modes', '[]');

    $icCanvas3.style.width = '100%';
    $icCanvas3.style.height = '250px';

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        canvas.appendChild(circle1);
        canvas.appendChild(circle2);
    });
});
```

Al exportar a SVG, `z-index` no se puede asignar directamente a propiedades del elemento, porque SVG se renderiza según el orden en que los elementos aparecen en el documento; consulta: [¿Cómo usar z-index en elementos svg?]

> En SVG, el z-index queda definido por el orden en que el elemento aparece en el documento.

Por eso hay que hacer un trabajo de ordenación adicional al exportar, y la implementación de la ordenación de `SerializedNode` es casi la misma que la de `Shape`, que no se muestra aquí:

```ts
export function toSVGElement(node: SerializedNode, doc?: Document) {
    // Omit handling other attributes.
    [...children]
        .sort(sortByZIndex) // [!code ++]
        .map((child) => toSVGElement(child, doc))
        .forEach((child) => {
            $g.appendChild(child);
        });

    return $g;
}
```

## Implementar sizeAttenuation {#size-attenuation}

Antes mencionamos [sizeAttenuation de las polilíneas]. Al mostrar una capa de máscara y puntos de anclaje después de seleccionar una forma, no queremos que cambien de tamaño con el zoom de la cámara. Por ejemplo, en excalidraw, las UI auxiliares como los controles de arrastre (handle) ajustan el ancho de línea según el nivel de zoom, usando la API de Canvas2D:

```ts
const renderTransformHandles = (): void => {
    context.save();
    context.lineWidth = 1 / appState.zoom.value; // [!code ++]
};
```

Por supuesto, ya hemos pasado `u_ZoomScale` al shader para el ajuste.

### Compresión de vértices {#vertex-compression}

Para bits de marca como `sizeAttenuation`, que solo valen 0 y 1, se puede usar la técnica de compresión de vértices. En resumen, intentamos usar vec4 para almacenar estos datos de vértice y aplicamos ciertas técnicas de compresión, lo que puede reducir el tiempo de transferencia de datos del lado de la CPU al lado de la GPU y ahorrar mucha memoria de GPU. Además, hay un límite superior en el número de attributes que admite OpenGL. El esquema de compresión también es muy sencillo: se comprime en JS en el lado de la CPU y se descomprime en el shader de vértices. Se aplica tanto en mapbox como en Cesium; consulta: [Tecnología gráfica en Cesium - Compresión de vértices]. Veamos a continuación cómo comprimir dos valores en un solo `float`:

En GLSL, float es un número de coma flotante de precisión simple [Escalares], es decir, el [formato de coma flotante de precisión simple] de IEEE-754.

![disposición de bits de binary32](https://picx.zhimg.com/v2-05e8c5427795ebe84919ceef053adaad_1440w.png)

Podemos comprimir `sizeAttenuation` y `type` en un solo `float`, donde `sizeAttenuation` ocupa 1 bit y `type` ocupa 23 bits.

```ts
const LEFT_SHIFT23 = 8388608.0;
const compressed = (sizeAttenuation ? 1 : 0) * LEFT_SHIFT23 + type;

const u_Opacity = [opacity, fillOpacity, strokeOpacity, type]; // [!code --]
const u_Opacity = [opacity, fillOpacity, strokeOpacity, compressed]; // [!code ++]
```

Al decodificar en el shader, también hay que mantener el mismo orden que en la codificación:

```glsl
#define SHIFT_RIGHT23 1.0 / 8388608.0
#define SHIFT_LEFT23 8388608.0

// unpack data(sizeAttenuation(1-bit), type(23-bit))
float compressed = a_Opacity;

// sizeAttenuation(1-bit)
float sizeAttenuation = floor(compressed * SHIFT_RIGHT23);
compressed -= sizeAttenuation * SHIFT_LEFT23;

// type(23-bit)
float type = compressed;
```

Después de obtener `sizeAttenuation`, se usa en el shader de vértices para ajustar las coordenadas de los vértices. Tomamos como ejemplo la implementación con SDF:

```glsl
float scale = 1.0;
if (sizeAttenuation > 0.5) {
    scale = 1.0 / u_ZoomScale;
}
gl_Position = vec4((u_ProjectionMatrix
    * u_ViewMatrix
    * model
    * vec3(position + v_FragCoord, 1)).xy, zIndex, 1); // [!code --]
    * vec3(position + v_FragCoord * scale, 1)).xy, zIndex, 1); // [!code ++]
```

### Exportar SVG {#export-svg}

Como esta propiedad está relacionada con el zoom de la cámara, al exportar SVG hace falta un procesamiento adicional. SVG ofrece [vector-effect]:

-   `non-scaling-size` -> `sizeAttenuation`, pero no tienen implementaciones y se consideran en riesgo (at-risk).
-   `non-scaling-stroke` -> `strokeAttenuation`

## Modo del lienzo {#canvas-mode}

Los lienzos infinitos suelen admitir muchos modos, como el modo de selección, el modo mano, el modo pluma, etc. Puedes consultar [Excalidraw ToolType] y [rnote].

La misma acción de interacción corresponde a operaciones distintas según el modo. Por ejemplo, arrastrar sobre el lienzo corresponde a la operación de selección en el modo de selección; en el modo mano, arrastra todo el lienzo; en el modo pluma, es el dibujo libre de trazos de pluma.

Primero añadimos al lienzo los modos de selección y mano, que se podrán ampliar en el futuro:

```ts
export enum CanvasMode {
    SELECT,
    HAND,
    DRAW_RECT,
}

class Canvas {
    #mode: CanvasMode = CanvasMode.HAND;
    get mode() {
        return this.#mode;
    }
    set mode(mode: CanvasMode) {
        this.#mode = mode;
    }
}
```

Implementemos un componente de UI nuevo para alternar entre estos modos.

## Barra de herramientas de selección de modo {#mode-toolbar}

Con [clases y estilos dinámicos] de Lit podemos lograr un efecto parecido a [clsx] (si has usado [tailwindcss] en tu proyecto, seguro que te resulta familiar) y gestionar `className`, por ejemplo generándolo según condiciones. Aquí lo usamos para implementar el estilo resaltado del modo seleccionado:

```ts
@customElement('ic-mode-toolbar')
export class ModeToolbar extends LitElement {
    render() {
        const items = [
            { name: CanvasMode.HAND, label: 'Move', icon: 'arrows-move' },
            { name: CanvasMode.SELECT, label: 'Select', icon: 'cursor' },
            {
                name: CanvasMode.DRAW_RECT,
                label: 'Draw rectangle',
                icon: 'sqaure',
            },
        ];
        return html`
            <sl-button-group label="Zoom toolbar">
                ${map(items, ({ name, label, icon }) => {
                    const classes = { active: this.mode === name }; // [!code ++]
                    return html`<sl-tooltip content=${label}>
                        <sl-icon-button
                            class=${classMap(classes)}
                            name=${icon}
                            label=${label}
                            @click="${() => this.changeCanvasMode(name)}"
                        ></sl-icon-button>
                    </sl-tooltip>`;
                })}
            </sl-button-group>
        `;
    }
}
```

Además, para reducir la cantidad de código de plantilla, usamos [Directivas integradas - map] de Lit. El efecto es el siguiente:

```js eval code=false
call(() => {
    const $canvas = document.createElement('ic-canvas');
    $canvas.style.width = '100%';
    $canvas.style.height = '100px';
    return $canvas;
});
```

## Modo mano {#hand-mode}

Como su nombre indica, en este modo el usuario solo puede desplazar, rotar y hacer zoom en todo el lienzo. Antes implementamos [CameraControlPlugin]; ahora lo combinamos con el modo del lienzo. En el modo mano, el comportamiento coincide con el original, es decir, mover o rotar el lienzo. La diferencia es que, al empezar el arrastre y durante el proceso, el estilo del ratón cambia a `grab` y `grabbing`:

```ts
export class CameraControl implements Plugin {
    apply(context: PluginContext) {
        root.addEventListener('drag', (e: FederatedPointerEvent) => {
            const mode = getCanvasMode();
            if (mode === CanvasMode.HAND) {
                setCursor('grabbing'); // [!code ++]

                if (rotate) {
                    rotateCamera(e);
                } else {
                    moveCamera(e);
                }
            }
        });
    }
}
```

### Desplazar el lienzo con la rueda {#pan-with-wheel}

Siempre he confundido por error `wheel` con el comportamiento de desplazamiento o con el evento `scroll`. Esta es la explicación de MDN para [Element: evento wheel]:

> Un evento wheel no dispara necesariamente un evento scroll. Por ejemplo, el elemento puede no ser desplazable en absoluto. Las acciones de zoom con la rueda o el trackpad también disparan eventos wheel.

Al usar Figma y Excalidraw, he comprobado que, además de arrastrar, la rueda también permite completar con rapidez el paneo del lienzo. En Excalidraw también se puede mantener pulsado `Space` para arrastrar en otros modos del lienzo; consulta: [handleCanvasPanUsingWheelOrSpaceDrag]. Por eso, modifiquemos primero la lógica de zoom original:

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    // zoomByClientPoint(  // [!code --]
    //     { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }, // [!code --]
    //     e.deltaY, // [!code --]
    // ); // [!code --]
    camera.x += e.deltaX / camera.zoom; // [!code ++]
    camera.y += e.deltaY / camera.zoom; // [!code ++]
});
```

Conviene señalar que la distancia recorrida cada vez tiene que tener en cuenta el nivel de zoom actual de la cámara, y que esa distancia debe ser menor cuando se ha ampliado.

### Hacer zoom en el lienzo con la rueda {#zoom-with-wheel}

Por supuesto, el comportamiento de zoom sigue siendo necesario, y se dispara cuando se pulsa `Command` o `Control`. Si has activado la función `pinch to zoom` en el trackpad del Mac, el evento `wheel` que se dispara lleva automáticamente `ctrlKey`; consulta: [Capturar el zoom del trackpad de Mac]:

![zoom en el trackpad de Mac](/mac-trackpad-zoom.gif)

Así podemos distinguir con facilidad los comportamientos distintos que corresponden al evento `wheel` en los escenarios de zoom y de paneo:

```ts
root.addEventListener('wheel', (e: FederatedWheelEvent) => {
    e.preventDefault();

    if (e.metaKey || e.ctrlKey) {
        zoomByClientPoint(
            { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
            e.deltaY,
        );
    } else {
        camera.x += e.deltaX / camera.zoom;
        camera.y += e.deltaY / camera.zoom;
    }
});
```

Cabe mencionar que Excalidraw también admite mantener pulsado <kbd>Shift</kbd> para desplazar el lienzo en horizontal. Sin embargo, ya hemos asignado la operación de rotación a este comportamiento del lienzo, así que no lo implementaremos aquí.

## Modo de selección {#select-mode}

En el modo de selección, el usuario puede seleccionar formas del lienzo haciendo clic. En el estado seleccionado, se superpone una UI de ayuda sobre la forma original, que suele constar de una capa de máscara y varios puntos de anclaje. Arrastrar sobre la capa de máscara mueve la forma, y arrastrar sobre los puntos de anclaje cambia el tamaño de la forma en distintas direcciones. También añadiremos un punto de anclaje fuera de la forma, en la parte superior, para la rotación.

![Diagrama de posicionamiento de anclajes con propiedades físicas](https://developer.chrome.com/blog/anchor-positioning-api/image/anchor-diagram-1.png)

### Hacer clic para seleccionar formas {#select-shape}

Implementemos a continuación el plugin Selector, y la interfaz siguiente también se expondrá a Canvas:

```ts
export class Selector implements Plugin {
    selectShape(shape: Shape): void;
    deselectShape(shape: Shape): void;
}
```

Después de escuchar el evento `click` en este plugin, hay que tratar las situaciones siguientes:

-   Hacer clic en una forma muestra la UI del estado seleccionado. Si antes se habían seleccionado otras formas, primero se cancela la selección.
-   Hacer clic en un área vacía del lienzo cancela la forma seleccionada en ese momento.
-   Mantener pulsado <kbd>Shift</kbd> entra en el modo de selección múltiple.

```ts
const handleClick = (e: FederatedPointerEvent) => {
    const mode = getCanvasMode();
    if (mode !== CanvasMode.SELECT) {
        return;
    }

    const selected = e.target as Shape;

    if (selected === root) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
            this.#selected = [];
        }
    } else if (selected.selectable) {
        if (!e.shiftKey) {
            this.deselectAllShapes();
        }
        this.selectShape(selected);
    } else if (e.shiftKey) {
        // Multi select
    }
};
root.addEventListener('click', handleClick);
```

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, CanvasMode, RoughEllipse } = Core;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    // $icCanvas.setAttribute('zoom', '200');
    $icCanvas.setAttribute('mode', CanvasMode.SELECT);
    $icCanvas.style.width = '100%';
    $icCanvas.style.height = '200px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const ellipse = new RoughEllipse({
            cx: 200,
            cy: 100,
            rx: 50,
            ry: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(ellipse);

        // setTimeout(() => {
        canvas.selectShape(ellipse);
        // }, 1000);
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Arrastrar para mover formas {#dragndrop-move}

HTML admite el arrastre de forma nativa; por supuesto, también podemos implementarlo con eventos de más bajo nivel como `pointermove / up / down`. Consulta: [Arrastrar y soltar con eventos de ratón]. Nuestra implementación también se inspira en las ideas de ese artículo. En el evento `dragstart`, se registra el desplazamiento del ratón sobre el lienzo. Aquí usamos el sistema de coordenadas `screen` porque hay que tener en cuenta el zoom de la cámara:

```ts
let shiftX = 0;
let shiftY = 0;
this.addEventListener('dragstart', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        shiftX = e.screen.x;
        shiftY = e.screen.y;
    }
});
```

En el evento `drag`, se ajusta la posición de la capa de máscara según el desplazamiento. Usar la propiedad `position` no exige modificar la definición del trazado de la máscara; en el renderizado subyacente solo cambia `u_ModelMatrix`:

```ts
const moveAt = (canvasX: number, canvasY: number) => {
    const { x, y } = this.mask.position;
    const dx = canvasX - shiftX - x;
    const dy = canvasY - shiftY - y;

    this.mask.position.x += dx;
    this.mask.position.y += dy;
};

this.addEventListener('drag', (e: FederatedPointerEvent) => {
    const target = e.target as Shape;
    const { x, y } = e.screen;

    if (target === this.mask) {
        moveAt(x, y);
    }
});
```

En el evento `dragend`, se sincroniza la posición de la capa de máscara con la forma. En ese momento se modifica el trazado de la máscara:

```ts
this.addEventListener('dragend', (e: FederatedEvent) => {
    const target = e.target as Shape;
    if (target === this.mask) {
        this.tlAnchor.cx += this.mask.position.x;
        this.tlAnchor.cy += this.mask.position.y;

        const { cx: tlCx, cy: tlCy } = this.tlAnchor;

        this.mask.position.x = 0;
        this.mask.position.y = 0;
        this.mask.d = `M${tlCx} ${tlCy}L${trCx} ${trCy}L${brCx} ${brCy}L${blCx} ${blCy}Z`;
    }
});
```

### Mostrar el panel de propiedades {#property-panel}

Cuando se selecciona una forma, queremos mostrar el panel de propiedades correspondiente a esa forma; consulta [Drawer - Contenido en un elemento], que no desarrollaremos aquí. Tomando como ejemplo la propiedad `stroke`, hacemos un enlace bidireccional: escuchamos la forma seleccionada en ese momento y, después de que el usuario la modifique a mano, sincronizamos el valor nuevo con la forma:

```html
<sl-color-picker
    hoist
    size="small"
    value="${this.shape?.stroke}"
    @sl-input="${this.handleStrokeChange}"
    opacity
></sl-color-picker>
```

Hay que tener en cuenta que, para los colores, queremos separar la transparencia, así que hay que usar el método `getFormattedValue` de [sl-color-picker] para obtener el valor del color, después usar la biblioteca `d3-color` para analizarlo y asignar los valores a `stroke` y `strokeOpacity` respectivamente:

```ts
const strokeAndOpacity = (e.target as any).getFormattedValue('rgba') as string;
const { rgb, opacity } = rgbaToRgbAndOpacity(strokeAndOpacity); // with d3-color
```

Por supuesto, en el modo de selección hay muchas funciones que todavía hay que implementar, como fusionar selecciones en grupos, rotar formas, etc., y las seguiremos mejorando en lecciones posteriores. Además, en el modo de dibujo queremos admitir el dibujo de rectángulos, líneas, polígonos, etc., que también implementaremos en lecciones posteriores.

## Lectura adicional {#extended-reading}

-   [Excalidraw ToolType]
-   [Presentación de la API de posicionamiento de anclajes de CSS]
-   [Arrastrar y soltar con eventos de ratón]

[Presentación de la API de posicionamiento de anclajes de CSS]: https://developer.chrome.com/blog/anchor-positioning-api
[Excalidraw ToolType]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts#L120-L135
[rnote]: https://github.com/flxzt/rnote
[clases y estilos dinámicos]: https://lit.dev/docs/components/styles/#dynamic-classes-and-styles
[Directivas integradas - map]: https://lit.dev/docs/templates/directives/#map
[CameraControlPlugin]: /es/guide/lesson-004#implement-a-plugin
[clsx]: https://github.com/lukeed/clsx
[tailwindcss]: https://tailwindcss.com/
[handleCanvasPanUsingWheelOrSpaceDrag]: https://github.com/excalidraw/excalidraw/blob/57cf577376e283beae08eb46192cfea7caa48d0c/packages/excalidraw/components/App.tsx#L6561
[Element: evento wheel]: https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
[Capturar el zoom del trackpad de Mac]: https://stackoverflow.com/a/28685082/4639324
[z-index]: https://developer.mozilla.org/en-US/docs/Web/CSS/z-index
[contexto de apilamiento]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Understanding_z-index/Stacking_context
[¿Cómo usar z-index en elementos svg?]: https://stackoverflow.com/questions/17786618/how-to-use-z-index-in-svg-elements
[Escalares]: https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#Scalars
[formato de coma flotante de precisión simple]: https://en.wikipedia.org/wiki/Single-precision_floating-point_format
[Tecnología gráfica en Cesium - Compresión de vértices]: https://cesium.com/blog/2015/05/18/vertex-compression/
[Arrastrar y soltar con eventos de ratón]: https://javascript.info/mouse-drag-and-drop
[Drawer - Contenido en un elemento]: https://shoelace.style/components/drawer#contained-to-an-element
[sl-color-picker]: https://shoelace.style/components/color-picker
[vector-effect]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/vector-effect
[sizeAttenuation de las polilíneas]: /es/guide/lesson-012#size-attenuation
