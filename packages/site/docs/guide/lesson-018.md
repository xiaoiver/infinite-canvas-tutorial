---
outline: deep
publish: false
---

<script setup>
import Spectrum from '../components/Spectrum.vue'
</script>

# Lesson 18 - Refactor with ECS

I've decided to refactor at this point. Starting in this lesson, we will implement the following two npm packages:

-   [@infinite-canvas-tutorial/ecs] Implements ECS with [Becsy], includes built-in Plugins, Components and Systems.
-   [@infinite-canvas-tutorial/webcomponents] Implements UIs based on [Spectrum], replacing the Shoelace used in [Lesson 7], but don't worry, they're both based on the Lit implementation.

<Spectrum />

Currently, we're using [TypeScript Mixins] to implement components, but this inheritance-based approach has obvious problems, namely that layered component classes are difficult to maintain:

```ts
// Current approach
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));
const shape = new Shape();

// ECS approach
const shape = world.spawn(Renderable, Sortable, Transformable);
```

ECS handles composition well, allowing flexible enhancement of entity capabilities as needed, as emphasized in [Entity-Component-System in A-Frame].

> The benefits of ECS include:
>
> -   Greater flexibility when defining objects by mixing and matching reusable parts.
> -   Eliminates the problems of long inheritance chains with complex interwoven functionality.

It's worth mentioning that A-Frame is a well-known Three.js framework with an impressive declarative ECS usage.
In game engines, ECS is used more widely, such as [ECS for Unity] and [Bevy ECS], which we're primarily referencing in our implementation.

## What is ECS architecture {#what-is-ecs}

[ecs-faq] compiles common questions, resources, and implementations in various languages, which is worth checking out. Here we quote the introduction from [Bevy ECS]:

> All app logic in Bevy uses the Entity Component System paradigm, which is often shortened to ECS. ECS is a software pattern that involves breaking your program up into **Entities**, **Components**, and **Systems**. Entities are unique "things" that are assigned groups of Components, which are then processed using Systems.

The following diagram from [ECSY Architecture] visually shows the relationship between these parts:

![ECSY Architecture](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

The relationship between Entity and Component can be understood from a relational database table view, where the former corresponds to rows of data and the latter to fields:

![ECS Simple Layout](https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ECS_Simple_Layout.svg/440px-ECS_Simple_Layout.svg.png)

From the caller's perspective, it's easier to understand the principle of [Composition over inheritance]. At the same time, we can see that Entity and Component don't contain specific processing logic, only associated data.

```rs
commands.spawn(Position(10, 20), Color(255, 0, 0)); // Entity #1
commands.spawn(Position(30, 40), Color(0, 255, 0)); // Entity #2
```

Each System selects a list of Entities with specific Components it cares about through a Query, comparable to using SQL to query a data table:

```rs
// @see https://bevyengine.org/learn/quick-start/getting-started/ecs/#your-first-query
fn print_position_system(query: Query<&Position>) {
    for position in &query {
        println!("position: {} {}", position.x, position.y);
    }
}
```

From a global perspective, the entire application is divided into multiple Systems:

![An example from ECSY](https://ecsyjs.github.io/ecsy/docs/manual/images/dragons.svg)

In real applications rather than simple demos, the following issues arise, which we'll expand on later, and which form the basis for our choice of ECS implementation:

1. How to build a complex Query with intuitive, friendly syntax?
2. How to control the execution order of multiple Systems?
3. How do Systems communicate with each other?

Let's first look at some supplements to ECS.

### Plugins {#plugins}

In Chapter 2 [Plugin System], we used this approach to demonstrate high cohesion and improve extensibility. [Bevy Plugins] also uses a similar approach to organize built-in functionality, with each Plugin containing Components and Systems. Users can also develop their own plugins this way:

> One of Bevy's core principles is modularity. All Bevy engine features are implemented as plugins---collections of code that modify an App.

In practice, it's easy to extend:

```rs
fn main() {
    App::new()
        .add_plugins(DefaultPlugins) // Default plugin set provided by the official team
        .add_systems(Startup, add_people)
        .add_systems(Update, (hello_world, (update_people, greet_people).chain()))
        .run();
}
```

In our project, the built-in plugins are stored under `/plugins` and exposed as a collection of plugins via `DefaultPlugins`, which can be used at initialization time. Of course, you can also customize plugins to extend them:

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
```

### Resources {#resources}

We've introduced how Entity and Component combinations form a data table-like structure, but applications will inevitably use some globally unique objects, see: [Bevy Resources]. In our subsequent implementation, we'll use the concept of `singleton`.

## Frontend ECS Implementation {#ecs-implementation-in-frontend}

There are several ready-to-use ECS implementations in the frontend. Although I really likes the diagrams in the [ECSY Architecture] documentation (which I've referenced above), I found it's not suitable for the current project. After comparing [koota] and [Becsy], I decided to use the latter in the project. Below I'd like to introduce some features I care about.

| Feature                | Becsy | koota | ECSY | bitECS |
| ---------------------- | ----- | ----- | ---- | ------ |
| Query modifiers        | ✅    | ✅    | ❌   | ❌     |
| Reactive Query         | ✅    | ✅    | ✅   | ✅     |
| System execution order | ✅    | ❌    | ✅   | ✅     |
| System communication   | ✅    | ❌    | ❌   | ❌     |

### Query modifiers {#query-modifiers}

Simple Query construction is supported in both ECSY and [bitECS]:

```ts
// https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=queries
SystemName.queries = {
    boxes: { components: [Box] },
    spheres: { components: [Sphere] },
};

// https://github.com/NateTheGreatt/bitECS/blob/master/docs/API.md#defineQuery
const movementQuery = defineQuery([Position, Velocity]);
```

So what is a complex Query? Simply put, it supports combining multiple query conditions through modifiers like `Not`, `Or`, `And`. For example, in [koota] and [Becsy]:

```ts
// https://github.com/pmndrs/koota?tab=readme-ov-file#query-modifiers
const staticEntities = world.query(Position, Not(Velocity));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#basic-query-syntax
private activeEnemies = this.query(
    q => q.current.with(Enemy).and.withAny(stateEnum).but.without(Dead));
```

Another important feature is reactive Query, which automatically updates when an Entity's Components are added, modified, or deleted.

```ts
// koota
const Added = createAdded();
const newPositions = world.query(Added(Position));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#reactive-queries
private boxes = this.query(q => q.added.and.removed.with(Box, Transform));
```

### System execution order {#system-execution-order}

In the simple case, [Becsy]'s scheduler will calculate the final execution order based on each System's read/write relationship to the Component. However, if both Systems need to write to the same type of Component, then you need to explicitly specify the order in which they should be executed. In addition to `before/after` constraints, you can also use some more intuitive constraints.

For example, we want the System `ComputeCamera` to run after all the Systems that write to `Camera`:

```ts
// CameraPlugin
system((s) => s.afterWritersOf(Camera))(ComputeCamera);
```

Finally, in development mode, [Becsy] prints the current system execution order on the console and reports an error if a loop exists.

### System communication {#system-communication}

Ideally each System would only need to be concerned with its own reads and writes to Components, but [Attaching systems] gives us the ability to reference other Systems more directly:

```ts
export class ZoomLevel extends System {
    private readonly cameraControl = this.attach(CameraControl);
}
```

Let's take a look at an example of the convenience of the ECS design pattern.

## Hierarchy {#hierarchy}

In [Lesson 3] we introduced tree structures like scene graphs, where parent-child structures are maintained in the form of references, which are the basis for properties like computational transformations, cascade visibility, etc:

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

Whereas in the ECS architecture, it is linear whether the underlying layer stores entities in the form of AoS or SoA. How do we represent such a hierarchical structure in a flat data structure?

![Comparison of AoS (left) and SoA (right) memory layouts](https://developer-blogs.nvidia.com/wp-content/uploads/2021/08/MLFrameworksIneroperability_pic2.png)

### Define component {define-component}

[Hierarchical relationships in an Entity Component System] provides several approaches:

1. Hierarchical entities, aka "scene graph with components". Store hierarchical relationships in entities and traverse top-down as usual.
2. Hierarchical components. Store hierarchical relationships in components.

We choose the second approach, implementing it using Becsy's [Referencing entities] capability:

```ts
import { Entity, field } from '@lastolivegames/becsy';

export class Parent {
    @field.backrefs(Children, 'parent') declare children: Entity[];
}
export class Children {
    @field.ref declare parent: Entity;
}
```

When adding a child node, you only need to associate the Parent entity on the Child side, and the association will take effect on the other side:

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

In our implementation, we refer to [Bevy Hierarchy] and encapsulate EntityCommand on top of Entity to provide the construction of the above parent-child relationship in a more user-friendly way. The `AddChild` contains the above implementation:

```ts
export class EntityCommands {
    appendChild(child: EntityCommands) {
        this.commands.add(new AddChild(this.id(), child.id()));
        return this;
    }
}

// 以更简洁的方式使用
parent.appendChild(child);
```

Finally, we finish registering the two Components in the plugin:

```ts
import { component } from '@lastolivegames/becsy';

export const HierarchyPlugin: Plugin = () => {
    component(Parent);
    component(Children);
};
```

### Calculate world transform {#calculate-world-transform}

System's Query syntax is very self explanatory. For example, here we want to select all entities containing `Transform` and `Parent`, and compute and update the `GlobalTransform` (of the child nodes) when they are first added and changed.

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

## Response to events {#response-to-an-event}

If a System is called every frame, how do we respond to asynchronous events?

### Bevy events {#bevy-events}

Let's look at an example of responding to window resize events in Bevy: [window-resizing], using an `EventReader` to read data carried by the `WindowResized` event:

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

The `WindowResized` event is written by an `EventWriter`:

```rs
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_winit/src/state.rs#L945-L949
// window_resized: &mut EventWriter<WindowResized>,
window_resized.write(WindowResized {
    window: window_entity,
    width: window.width(),
    height: window.height(),
});
```

We can see that the event mechanism provides convenience for inter-system communication, see [Bevy Events] for details.

### Becsy coroutines {#becsy-coroutines}

Becsy provides [coroutines] to respond to events.

[babylon.js coroutines]

[Bevy ECS]: https://bevyengine.org/learn/quick-start/getting-started/ecs/
[Bevy Plugins]: https://bevyengine.org/learn/quick-start/getting-started/plugins/
[Bevy Resources]: https://bevyengine.org/learn/quick-start/getting-started/resources/
[Becsy]: https://lastolivegames.github.io/becsy/
[koota]: https://github.com/pmndrs/koota
[coroutines]: https://lastolivegames.github.io/becsy/guide/architecture/systems#coroutines
[babylon.js coroutines]: https://doc.babylonjs.com/features/featuresDeepDive/events/coroutines/
[window-resizing]: https://bevyengine.org/examples/window/window-resizing/
[Bevy Events]: https://bevy-cheatbook.github.io/programming/events.html
[Entity-Component-System in A-Frame]: https://aframe.io/docs/1.7.0/introduction/entity-component-system.html
[TypeScript Mixins]: https://www.typescriptlang.org/docs/handbook/mixins.html
[ECS for Unity]: https://unity.com/ecs
[Composition over inheritance]: https://en.wikipedia.org/wiki/Composition_over_inheritance
[ecs-faq]: https://github.com/SanderMertens/ecs-faq
[ECSY Architecture]: https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=overview
[Plugin System]: /guide/lesson-001#plugin-based-architecture
[bitECS]: https://github.com/NateTheGreatt/bitECS
[Hierarchical relationships in an Entity Component System]: https://gamedev.stackexchange.com/questions/206715/hierarchical-relationships-in-an-entity-component-system
[Referencing entities]: https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities
[Lesson 3]: /guide/lesson-003#scene-graph
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[@infinite-canvas-tutorial/webcomponents]: https://www.npmjs.com/package/@infinite-canvas-tutorial/webcomponents
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Attaching systems]: https://lastolivegames.github.io/becsy/guide/architecture/systems#attaching-systems
[Lesson 7]: /guide/lesson-007
[Bevy Hierarchy]: https://bevy-cheatbook.github.io/fundamentals/hierarchy.html
