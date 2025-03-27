---
outline: deep
publish: false
---

# 课程 18 - 使用 ECS 重构

我决定在这个节点进行重构。目前我们使用 [TypeScript Mixins] 来实现组件，但这种基于继承的方式存在明显的问题，即层层嵌套的组件类难以维护：

```ts
// 目前的做法
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));
const shape = new Shape();

// 使用 ECS 的做法
const shape = world.spawn(Renderable, Sortable, Transformable);
```

而 ECS 能很好处理组合这一问题，可以灵活地按需增强实体的能力，这一点在 [Entity-Component-System in A-Frame] 一文中也被强调。

> The benefits of ECS include:
>
> -   Greater flexibility when defining objects by mixing and matching reusable parts.
> -   Eliminates the problems of long inheritance chains with complex interwoven functionality.

值得一提的是，A-Frame 是一个很有名的 Three.js 框架，它的声明式 ECS 用法令人印象深刻。
而在游戏引擎中，ECS 使用的更广泛，例如 [ECS for Unity] 以及我们在实现中重点参考的 [Bevy ECS]。

从本节课开始，我们将实现以下两个 npm package：

-   [@infinite-canvas-tutorial/ecs] 基于 [Becsy] 提供 ECS 实现
-   [@infinite-canvas-tutorial/webcomponents] 基于 [Spectrum] 实现 UI

## 什么是 ECS 架构 {#what-is-ecs}

[ecs-faq] 整合了 ECS 的常见问题、资源以及各个语言的实现，非常值得一看。这里我们引用 [Bevy ECS] 中的介绍：

> All app logic in Bevy uses the Entity Component System paradigm, which is often shortened to ECS. ECS is a software pattern that involves breaking your program up into **Entities**, **Components**, and **Systems**. Entities are unique "things" that are assigned groups of Components, which are then processed using Systems.

下图来自 [ECSY Architecture]，形象地展示了各部分的关系：

![ECSY Architecture](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

Entity 和 Component 的关系可以从关系型数据库的表视图来理解，前者对应一行行数据，后者对应字段：

![ECS Simple Layout](https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ECS_Simple_Layout.svg/440px-ECS_Simple_Layout.svg.png)

从调用者视角能更容易理解 [Composition over inheritance] 这一原则。同时，我们可以看到 Entity 和 Component 中是不包含具体处理逻辑的，只存放关联的数据。

```rs
commands.spawn(Position(10, 20), Color(255, 0, 0)); // Entity #1
commands.spawn(Position(30, 40), Color(0, 255, 0)); // Entity #2
```

每个 System 通过 Query 选定它所关心的拥有特定 Component 的 Entity 列表，可以类比使用 SQL 在数据表中进行查询：

```rs
// @see https://bevyengine.org/learn/quick-start/getting-started/ecs/#your-first-query
fn print_position_system(query: Query<&Position>) {
    for position in &query {
        println!("position: {} {}", position.x, position.y);
    }
}
```

全局视角下整个应用被分成了多个 System 执行：

![An example from ECSY](https://ecsyjs.github.io/ecsy/docs/manual/images/dragons.svg)

在实际应用而非简单 DEMO 中会遇到以下问题，稍后我们会展开介绍，这也是我们选择 ECS 实现的依据：

1. 如何通过直观友好的语法构建一个复杂的 Query？
2. 多个 System 的执行顺序如何控制？
3. System 之间如何通信？

下面我们先来看看 ECS 之外的补充。

### Plugins {#plugins}

在第二章 [插件系统] 中我们使用这种方式体现高内聚并提升可扩展性，[Bevy Plugins] 也使用了类似的方式组织内置的功能，每个 Plugin 都包含了 Component 和 System。用户也可以用这种方式开发自己的插件：

> One of Bevy's core principles is modularity. All Bevy engine features are implemented as plugins---collections of code that modify an App.

在实际使用时可以很方便地进行扩展：

```rs
fn main() {
    App::new()
        .add_plugins(DefaultPlugins) // 官方提供的默认插件集
        .add_systems(Startup, add_people)
        .add_systems(Update, (hello_world, (update_people, greet_people).chain()))
        .run();
}
```

在我们的项目中，`/plugins` 下存放了内置的插件，并通过 `DefaultPlugins` 以插件集合形式暴露，可以在初始化时使用它们。当然也可以自定义插件进行扩展：

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
```

### Resources {#resources}

前面介绍过 Entity 和 Component 的组合形成了类似数据表的结构，但应用中也必然会使用到一些全局唯一对象，详见：[Bevy Resources]。在后续实现时我们会使用 `singleton` 的概念来描述。

## 前端 ECS 实现 {#ecs-implementation-in-frontend}

在前端有不少开箱即用的 ECS 实现，尽管我非常喜欢 [ECSY Architecture] 文档中配的说明图（前文也引用了），但我发现它并不适合目前的项目。在比较了 [koota] 和 [Becsy] 之后，我决定在项目里使用后者。下面我想介绍一些我非常在意的特性。

| 特性            | Becsy | koota | ECSY | bitECS |
| --------------- | ----- | ----- | ---- | ------ |
| Query 修饰符    | ✅    | ✅    | ❌   | ❌     |
| 响应式 Query    | ✅    | ✅    | ✅   | ✅     |
| System 执行顺序 | ✅    | ❌    | ✅   | ✅     |
| System 间通信   | ✅    | ❌    | ❌   | ❌     |

### Query 修饰符 {#query-modifiers}

简单 Query 的构建在 ECSY 和 [bitECS] 中都是支持的：

```ts
// https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=queries
SystemName.queries = {
    boxes: { components: [Box] },
    spheres: { components: [Sphere] },
};

// https://github.com/NateTheGreatt/bitECS/blob/master/docs/API.md#defineQuery
const movementQuery = defineQuery([Position, Velocity]);
```

那什么是复杂 Query 呢？简单来说就是支持通过一些类似 `Not` `Or` `And` 之类的限定符来组合多个查询条件。以 [koota] 和 [Becsy] 为例：

```ts
// https://github.com/pmndrs/koota?tab=readme-ov-file#query-modifiers
const staticEntities = world.query(Position, Not(Velocity));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#basic-query-syntax
private activeEnemies = this.query(
    q => q.current.with(Enemy).and.withAny(stateEnum).but.without(Dead));
```

另一个重要特性是响应式 Query，即当 Entity 的 Component 发生添加、修改、删除变化时，Query 会自动更新。

```ts
// koota
const Added = createAdded();
const newPositions = world.query(Added(Position));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#reactive-queries
private boxes = this.query(q => q.added.and.removed.with(Box, Transform));
```

### System 执行顺序 {#system-execution-order}

在简单的情况下，[Becsy] 的 scheduler 会根据各个 System 对 Component 的读写关系，计算出最终的执行顺序。但如果两个 System 都需要对同一类 Component 进行写入，此时需要使用者显式指定它们的执行顺序，除了 `before/after` 这些很直观的约束，我们还可以使用一些更符合直觉的约束。

例如我们想让 `ComputeCamera` 这个 System 在所有对 `Camera` 进行写入的 System 之后运行：

```ts
// CameraPlugin
system((s) => s.afterWritersOf(Camera))(ComputeCamera);
```

最后在开发模式下，[Becsy] 会在控制台打印出当前系统的执行顺序，如果存在循环会报错。

### System 间通信 {#system-communication}

理想状态下各个 System 只需要关注自身对 Component 的读写，但 [Attaching systems] 让我们拥有了一种更直接引用其他 System 的能力：

```ts
export class ZoomLevel extends System {
    private readonly cameraControl = this.attach(CameraControl);
}
```

下面我们通过一个例子来感受 ECS 这种设计模式带来的便利。

## 层次结构 {#hierarchy}

![Comparison of AoS (left) and SoA (right) memory layouts](https://developer-blogs.nvidia.com/wp-content/uploads/2021/08/MLFrameworksIneroperability_pic2.png)

在[课程 3]中我们介绍过场景图，如何在扁平的数据结构中表示这样的层次结构呢？

### 定义 Component {define-component}

[Hierarchical relationships in an Entity Component System] 提供了几种思路：

1. 层次结构实体，又名“带有组件的场景图”。在实体中存储层次关系，像往常一样自顶向下遍历。
2. 层次组件。将层次关系存储在组件中。

我们选择第二种思路，借助 Becsy 提供的 [Referencing entities] 能力实现：

```ts
import { Entity, field } from '@lastolivegames/becsy';

export class Parent {
    @field.backrefs(Children, 'parent') declare children: Entity[];
}
export class Children {
    @field.ref declare parent: Entity;
}
```

在添加子节点时只需要在 Child 端关联 Parent 实体，关联关系在另一端就会生效：

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

### 计算 world transform {#calculate-world-transform}

## 响应事件 {#response-to-an-event}

如果 System 在每一帧被调用，那如何响应异步的事件呢？

### Bevy events {#bevy-events}

我们先来看看 Bevy 中响应窗口大小变化事件的例子：[window-resizing]，使用一个 `EventReader` 读取 `WindowResized` 事件携带的数据：

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

而 `WindowResized` 事件是由 `EventWriter` 写入的：

```rs
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_winit/src/state.rs#L945-L949
// window_resized: &mut EventWriter<WindowResized>,
window_resized.write(WindowResized {
    window: window_entity,
    width: window.width(),
    height: window.height(),
});
```

可以看出事件机制为系统间通信提供了便利，详见 [Bevy Events]。

### Becsy coroutines {#becsy-coroutines}

Becsy 提供了 [coroutines] 来响应事件。

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
[插件系统]: /zh/guide/lesson-001#plugin-based-architecture
[bitECS]: https://github.com/NateTheGreatt/bitECS
[Hierarchical relationships in an Entity Component System]: https://gamedev.stackexchange.com/questions/206715/hierarchical-relationships-in-an-entity-component-system
[Referencing entities]: https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities
[课程 3]: /zh/guide/lesson-003#scene-graph
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[@infinite-canvas-tutorial/webcomponents]: https://www.npmjs.com/package/@infinite-canvas-tutorial/webcomponents
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Attaching systems]: https://lastolivegames.github.io/becsy/guide/architecture/systems#attaching-systems
