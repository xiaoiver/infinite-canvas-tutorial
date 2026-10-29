---
outline: deep
description: 'Refactoriza la arquitectura con Entity-Component-System (ECS) usando Becsy. Sustituye los mixins de TypeScript por un enfoque basado en la composición e implementa complementos, componentes y sistemas para mejorar la modularidad.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lección 18 - Refactorizar con ECS' },
      ]
---
<script setup>
import Spectrum from '../../components/Spectrum.vue'
</script>

# Lección 18 - Refactorizar con ECS {#lesson-18-refactor-with-ecs}

He decidido refactorizar en este punto. A partir de esta lección implementaremos los dos paquetes de npm siguientes:

-   [@infinite-canvas-tutorial/ecs] Implementa ECS con [Becsy] e incluye complementos, componentes y sistemas integrados.
-   [@infinite-canvas-tutorial/webcomponents] Implementa interfaces a partir de [Spectrum] y sustituye el Shoelace usado en la [Lección 7], pero no te preocupes: ambos se basan en la implementación de Lit.

<Spectrum />

Ahora mismo usamos [mixins de TypeScript] para implementar los componentes, pero este enfoque basado en la herencia tiene problemas evidentes: las clases de componentes apiladas son difíciles de mantener.

```ts
// Current approach
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));
const shape = new Shape();

// ECS approach
const shape = world.spawn(Renderable, Sortable, Transformable);
```

ECS maneja bien la composición y permite ampliar las capacidades de una entidad de forma flexible, según haga falta, como se destaca en [Sistema de entidades y componentes en A-Frame].

> Entre las ventajas de ECS están:
>
> -   Más flexibilidad al definir objetos mezclando y combinando piezas reutilizables.
> -   Elimina los problemas de las cadenas de herencia largas, con funcionalidad compleja entrelazada.

Merece la pena mencionar que A-Frame es un framework de Three.js muy conocido, con un uso declarativo de ECS impresionante.
En los motores de juegos, ECS se usa de forma más amplia, como en [ECS para Unity] y [ECS de Bevy], que es la referencia principal de nuestra implementación.

## Qué es la arquitectura ECS {#what-is-ecs}

[ecs-faq] reúne preguntas habituales, recursos e implementaciones en varios lenguajes, y merece la pena consultarlo. Aquí citamos la introducción de [ECS de Bevy]:

> Toda la lógica de la aplicación en Bevy usa el paradigma Entity Component System, que a menudo se abrevia como ECS. ECS es un patrón de software que consiste en dividir el programa en **entidades**, **componentes** y **sistemas**. Las entidades son «cosas» únicas a las que se asignan grupos de componentes, que después se procesan mediante sistemas.

El diagrama siguiente, de [Arquitectura de ECSY], muestra de forma visual la relación entre estas partes:

![Arquitectura de ECSY](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

La relación entre entidad y componente se puede entender desde la vista de una tabla de una base de datos relacional, donde la primera corresponde a las filas de datos y el segundo a los campos:

![Disposición simple de ECS](https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ECS_Simple_Layout.svg/440px-ECS_Simple_Layout.svg.png)

Desde el punto de vista de quien llama, es más fácil entender el principio de [composición frente a herencia]. Al mismo tiempo, se ve que la entidad y el componente no contienen lógica de procesamiento concreta, solo datos asociados.

```rs
commands.spawn(Position(10, 20), Color(255, 0, 0)); // Entity #1
commands.spawn(Position(30, 40), Color(0, 255, 0)); // Entity #2
```

Cada sistema selecciona, mediante una consulta, una lista de entidades con los componentes concretos que le interesan, algo comparable a usar SQL para consultar una tabla de datos:

```rs
// @see https://bevyengine.org/learn/quick-start/getting-started/ecs/#your-first-query
fn print_position_system(query: Query<&Position>) {
    for position in &query {
        println!("position: {} {}", position.x, position.y);
    }
}
```

Desde una perspectiva global, toda la aplicación se divide en varios sistemas:

![Un ejemplo de ECSY](https://ecsyjs.github.io/ecsy/docs/manual/images/dragons.svg)

En aplicaciones reales, y no en demostraciones sencillas, aparecen las cuestiones siguientes, que desarrollaremos más adelante y que son la base de nuestra elección de implementación de ECS:

1. ¿Cómo construir una consulta compleja con una sintaxis intuitiva y cómoda?
2. ¿Cómo controlar el orden de ejecución de varios sistemas?
3. ¿Cómo se comunican los sistemas entre sí?

Veamos primero algunos añadidos al modelo ECS.

### Complementos {#plugins}

En el capítulo 2, [Sistema de complementos], usamos este enfoque para mostrar una alta cohesión y mejorar la extensibilidad. [Complementos de Bevy] también usa un enfoque parecido para organizar la funcionalidad integrada, y cada complemento contiene componentes y sistemas. Los usuarios también pueden desarrollar sus propios complementos de esta forma:

> Uno de los principios centrales de Bevy es la modularidad. Todas las funciones del motor Bevy se implementan como complementos: colecciones de código que modifican una App.

En la práctica, ampliarlo es sencillo:

```rs
fn main() {
    App::new()
        .add_plugins(DefaultPlugins) // Default plugin set provided by the official team
        .add_systems(Startup, add_people)
        .add_systems(Update, (hello_world, (update_people, greet_people).chain()))
        .run();
}
```

En nuestro proyecto, los complementos integrados se guardan en `/plugins` y se exponen como una colección de complementos mediante `DefaultPlugins`, que se puede usar en el momento de la inicialización. Por supuesto, también puedes personalizar complementos para ampliarlos:

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
```

### Recursos {#resources}

Ya vimos cómo las combinaciones de entidad y componente forman una estructura parecida a una tabla de datos, pero las aplicaciones inevitablemente usan algunos objetos únicos a nivel global; consulta [Recursos de Bevy]. En la implementación posterior usaremos el concepto de `singleton`.

## Implementación de ECS en el frontend {#ecs-implementation-in-frontend}

Hay varias implementaciones de ECS listas para usar en el frontend. Aunque me gustan mucho los diagramas de la documentación de [Arquitectura de ECSY] (que he citado arriba), vi que no encaja en el proyecto actual. Después de comparar [koota] y [Becsy], decidí usar este último en el proyecto. A continuación me gustaría presentar algunas funciones que me importan.

| Característica              | Becsy | koota | ECSY | bitECS |
| --------------------------- | ----- | ----- | ---- | ------ |
| Modificadores de consulta   | ✅    | ✅    | ❌   | ❌     |
| Consulta reactiva           | ✅    | ✅    | ✅   | ✅     |
| Orden de ejecución          | ✅    | ❌    | ✅   | ✅     |
| Comunicación entre sistemas | ✅    | ❌    | ❌   | ❌     |

### Modificadores de consulta {#query-modifiers}

Tanto ECSY como [bitECS] admiten la construcción sencilla de consultas:

```ts
// https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=queries
SystemName.queries = {
    boxes: { components: [Box] },
    spheres: { components: [Sphere] },
};

// https://github.com/NateTheGreatt/bitECS/blob/master/docs/API.md#defineQuery
const movementQuery = defineQuery([Position, Velocity]);
```

¿Qué es entonces una consulta compleja? En pocas palabras, permite combinar varias condiciones de consulta mediante modificadores como `Not`, `Or` y `And`. Por ejemplo, en [koota] y [Becsy]:

```ts
// https://github.com/pmndrs/koota?tab=readme-ov-file#query-modifiers
const staticEntities = world.query(Position, Not(Velocity));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#basic-query-syntax
private activeEnemies = this.query(
    q => q.current.with(Enemy).and.withAny(stateEnum).but.without(Dead));
```

Otra función importante es la consulta reactiva, que se actualiza de forma automática cuando se añaden, modifican o eliminan los componentes de una entidad.

```ts
// koota
const Added = createAdded();
const newPositions = world.query(Added(Position));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#reactive-queries
private boxes = this.query(q => q.added.and.removed.with(Box, Transform));
```

### Orden de ejecución de los sistemas {#system-execution-order}

En el caso sencillo, el planificador de [Becsy] calcula el orden de ejecución final a partir de la relación de lectura y escritura de cada sistema con el componente. Sin embargo, si dos sistemas necesitan escribir en el mismo tipo de componente, hay que especificar de forma explícita el orden en el que deben ejecutarse. Además de las restricciones `before/after`, también puedes usar algunas restricciones más intuitivas.

Por ejemplo, queremos que el sistema `ComputeCamera` se ejecute después de todos los sistemas que escriben en `Camera`:

```ts
// CameraPlugin
system((s) => s.afterWritersOf(Camera))(ComputeCamera);
```

Por último, en modo de desarrollo, [Becsy] imprime en la consola el orden de ejecución actual de los sistemas y notifica un error si existe un ciclo.

### Comunicación entre sistemas {#system-communication}

Lo ideal sería que cada sistema solo se ocupara de sus propias lecturas y escrituras de componentes, pero [acoplar sistemas] nos permite referenciar otros sistemas de forma más directa:

```ts
export class ZoomLevel extends System {
    private readonly cameraControl = this.attach(CameraControl);
}
```

Veamos un ejemplo de lo cómodo que resulta el patrón de diseño ECS.

## Jerarquía {#hierarchy}

En la [Lección 3] presentamos estructuras de árbol como los grafos de escena, en las que las estructuras padre-hijo se mantienen en forma de referencias, que son la base de propiedades como las transformaciones calculadas, la visibilidad en cascada, etc.:

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

En la arquitectura ECS, en cambio, el almacenamiento es lineal tanto si la capa inferior guarda las entidades en forma de AoS como de SoA. ¿Cómo representamos una estructura jerárquica así en una estructura de datos plana?

![Comparación de los diseños de memoria AoS (izquierda) y SoA (derecha)](https://developer-blogs.nvidia.com/wp-content/uploads/2021/08/MLFrameworksIneroperability_pic2.png)

### Definir el componente {#define-component}

[Relaciones jerárquicas en un sistema de entidades y componentes] ofrece varios enfoques:

1. Entidades jerárquicas, es decir, «grafo de escena con componentes». Se guardan las relaciones jerárquicas en las entidades y se recorre de arriba abajo, como de costumbre.
2. Componentes jerárquicos. Se guardan las relaciones jerárquicas en los componentes.

Elegimos el segundo enfoque y lo implementamos con la capacidad de [referenciar entidades] de Becsy:

```ts
import { Entity, field } from '@lastolivegames/becsy';

export class Parent {
    @field.backrefs(Children, 'parent') declare children: Entity[];
}
export class Children {
    @field.ref declare parent: Entity;
}
```

Al añadir un nodo hijo, solo hace falta asociar la entidad padre en el lado del hijo, y la asociación surte efecto en el otro lado:

```ts
// addChild(parent, child)
if (!parent.has(Parent)) {
    parent.add(Parent);
}
child.add(Children, {
    parent,
});

// getChildren()
parent.read(Parent).children; // [child]
```

Merece la pena mencionar que Bevy usa las nuevas [relaciones de ECS] desde la versión 0.16:

```rs
commands.spawn(ChildOf(some_parent));
commands.entity(some_entity).insert(ChildOf(new_parent));
```

En nuestra implementación nos basamos en [Jerarquía de Bevy] y encapsulamos EntityCommand sobre Entity para construir la relación padre-hijo anterior de una forma más cómoda. `AddChild` contiene la implementación anterior:

```ts
export class EntityCommands {
    appendChild(child: EntityCommands) {
        this.commands.add(new AddChild(this.id(), child.id()));
        return this;
    }
}

parent.appendChild(child);
```

Por último, terminamos de registrar los dos componentes en el complemento:

```ts
import { component } from '@lastolivegames/becsy';

export const HierarchyPlugin: Plugin = () => {
    component(Parent);
    component(Children);
};
```

### Calcular la transformación de mundo {#calculate-world-transform}

La sintaxis de consulta del sistema se explica sola. Por ejemplo, aquí queremos seleccionar todas las entidades que contienen `Transform` y `Parent`, y calcular y actualizar el `GlobalTransform` (de los nodos hijo) cuando se añaden por primera vez y cuando cambian.

```ts
import { System } from '@lastolivegames/becsy';

export class PropagateTransforms extends System {
    queries = this.query(
        (q) =>
            q
                .with(Transform, Parent)
                .addedOrChanged.trackWrites.using(GlobalTransform).write,
    );
}
```

## Responder a los eventos {#response-to-an-event}

Si un sistema se llama en cada fotograma, ¿cómo respondemos a los eventos asíncronos?

### Eventos de Bevy {#bevy-events}

Veamos un ejemplo de respuesta a los eventos de cambio de tamaño de la ventana en Bevy: [cambio de tamaño de la ventana], que usa un `EventReader` para leer los datos que transporta el evento `WindowResized`:

```rs
fn on_resize_system(
    mut text: Single<&mut Text, With<ResolutionText>>,
    mut resize_reader: EventReader<WindowResized>,
) {
    for e in resize_reader.read() {
        // When resolution is being changed
    }
}
```

El evento `WindowResized` lo escribe un `EventWriter`:

```rs
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_winit/src/state.rs#L945-L949
// window_resized: &mut EventWriter<WindowResized>,
window_resized.write(WindowResized {
    window: window_entity,
    width: window.width(),
    height: window.height(),
});
```

Se ve que el mecanismo de eventos facilita la comunicación entre sistemas; consulta [Eventos de Bevy] para más detalles.

### Corrutinas de Becsy {#becsy-coroutines}

Escucha los eventos a través de la API DOM en el sistema EventWriter:

```ts
$el.addEventListener('pointerup', onPointerUp, true);
const onPointerUp = (e: PointerEvent) => {
    this.setInputTrigger(input, 'pointerUpTrigger');
};
```

Cuando se dispara un evento, la marca de evento correspondiente se escribe en el componente Input. Este componente también registra el estado de disparo de otros eventos, el estado de las teclas <kbd>Ctrl</kbd> y <kbd>Shift</kbd>, y las coordenadas del evento. Esos estados se usarán en los comportamientos de interacción posteriores, como hacer clic para seleccionar formas, arrastrar para seleccionar formas, etc.:

```ts
export class Input {
    @field.boolean declare pointerUpTrigger: boolean;
}
```

¿Cómo nos aseguramos de que el estado solo se escriba una vez en un fotograma? Becsy ofrece [corrutinas] para manejar lógica que abarca varios fotogramas, incluida la capacidad de esperar un cierto número de fotogramas o segundos. Aquí usamos el uso más básico:

```ts
@co private *setInputTrigger(entity: Entity, triggerKey: string): Generator {
    const input = entity.write(Input);

    if (!(triggerKey in input)) return;
    Object.assign(input, { [triggerKey]: true });

    yield;

    {
      const input = entity.hold().write(Input);
      Object.assign(input, { [triggerKey]: false });
    }

    yield;
}
```

Por último, en sistemas como CameraControl que necesitan manejar eventos, podemos procesar los eventos correspondientes del fotograma actual mediante marcas:

```ts
execute() {
    const input = canvas.write(Input);
    if (input.pointerDownTrigger) {}
    if (input.pointerUpTrigger) {}
}
```

## Lectura adicional {#extended-reading}

-   [Corrutinas de babylon.js]

[ECS de Bevy]: https://bevyengine.org/learn/quick-start/getting-started/ecs/
[Complementos de Bevy]: https://bevyengine.org/learn/quick-start/getting-started/plugins/
[Recursos de Bevy]: https://bevyengine.org/learn/quick-start/getting-started/resources/
[Becsy]: https://lastolivegames.github.io/becsy/
[koota]: https://github.com/pmndrs/koota
[corrutinas]: https://lastolivegames.github.io/becsy/guide/architecture/systems#coroutines
[Corrutinas de babylon.js]: https://doc.babylonjs.com/features/featuresDeepDive/events/coroutines/
[cambio de tamaño de la ventana]: https://bevyengine.org/examples/window/window-resizing/
[Eventos de Bevy]: https://bevy-cheatbook.github.io/programming/events.html
[Sistema de entidades y componentes en A-Frame]: https://aframe.io/docs/1.7.0/introduction/entity-component-system.html
[mixins de TypeScript]: https://www.typescriptlang.org/docs/handbook/mixins.html
[ECS para Unity]: https://unity.com/ecs
[composición frente a herencia]: https://en.wikipedia.org/wiki/Composition_over_inheritance
[ecs-faq]: https://github.com/SanderMertens/ecs-faq
[Arquitectura de ECSY]: https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=overview
[Sistema de complementos]: /es/guide/lesson-001#plugin-based-architecture
[bitECS]: https://github.com/NateTheGreatt/bitECS
[Relaciones jerárquicas en un sistema de entidades y componentes]: https://gamedev.stackexchange.com/questions/206715/hierarchical-relationships-in-an-entity-component-system
[referenciar entidades]: https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities
[Lección 3]: /es/guide/lesson-003#scene-graph
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[@infinite-canvas-tutorial/webcomponents]: https://www.npmjs.com/package/@infinite-canvas-tutorial/webcomponents
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[acoplar sistemas]: https://lastolivegames.github.io/becsy/guide/architecture/systems#attaching-systems
[Lección 7]: /es/guide/lesson-007
[Jerarquía de Bevy]: https://bevy-cheatbook.github.io/fundamentals/hierarchy.html
[relaciones de ECS]: https://bevyengine.org/news/bevy-0-16/#ecs-relationships
