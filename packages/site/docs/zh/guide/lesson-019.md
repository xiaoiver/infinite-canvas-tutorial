---
outline: deep
publish: false
---

# 课程 19 - 使用 ECS 重构

我决定在这个节点进行重构。

目前我们使用 [TypeScript Mixins] 来实现组件，但这种基于继承的方式存在明显的问题，即层层嵌套的组件类难以维护：

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

## 什么是 ECS 架构 {#what-is-ecs}

[ecs-faq] 整合了 ECS 的常见问题、资源以及各个语言的实现，非常值得一看。这里我们引用 [Bevy ECS] 中的介绍：

> All app logic in Bevy uses the Entity Component System paradigm, which is often shortened to ECS. ECS is a software pattern that involves breaking your program up into **Entities**, **Components**, and **Systems**. Entities are unique "things" that are assigned groups of Components, which are then processed using Systems.

下图来自 [ECSY Architecture]，形象地展示了各部分的关系：

![ECSY Architecture](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

[Composition over inheritance]

```rs
commands.spawn(new Person(), new Name("John"));
```

```ts
new App()
    .addPlugins(...DefaultPlugins)
    .addSystems(StartUpSystem)
    .run();
```

### Plugins {#plugins}

[Bevy Plugins]

> One of Bevy's core principles is modularity. All Bevy engine features are implemented as plugins---collections of code that modify an App.

## 前端 ECS 实现 {#ecs-implementation-in-frontend}

下面我们来看在前端有没有开箱即用的 ECS 实现。

-   [Becsy]
-   [koota]

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

[Bevy ECS]: https://bevyengine.org/learn/quick-start/getting-started/ecs/
[Bevy Plugins]: https://bevyengine.org/learn/quick-start/getting-started/plugins/
[Becsy]: https://lastolivegames.github.io/becsy/
[koota]: https://github.com/pmndrs/koota
[coroutines]: https://lastolivegames.github.io/becsy/guide/architecture/systems#coroutines
[window-resizing]: https://bevyengine.org/examples/window/window-resizing/
[Bevy Events]: https://bevy-cheatbook.github.io/programming/events.html
[Entity-Component-System in A-Frame]: https://aframe.io/docs/1.7.0/introduction/entity-component-system.html
[TypeScript Mixins]: https://www.typescriptlang.org/docs/handbook/mixins.html
[ECS for Unity]: https://unity.com/ecs
[Composition over inheritance]: https://en.wikipedia.org/wiki/Composition_over_inheritance
[ecs-faq]: https://github.com/SanderMertens/ecs-faq
[ECSY Architecture]: https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=overview
