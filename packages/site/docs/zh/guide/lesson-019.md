---
outline: deep
publish: false
---

# 课程 19 - ECS 架构

[Bevy ECS]

> All app logic in Bevy uses the Entity Component System paradigm, which is often shortened to ECS. ECS is a software pattern that involves breaking your program up into Entities, Components, and Systems. Entities are unique "things" that are assigned groups of Components, which are then processed using Systems.

```ts
new App({
    canvas: $canvas,
})
    .addPlugins(...DefaultPlugins)
    .addSystems(StartUpSystem)
    .run();
```

[Bevy ECS]: https://bevyengine.org/learn/quick-start/getting-started/ecs/
[Bevy Plugins]: https://bevyengine.org/learn/quick-start/getting-started/plugins/
[koota]: https://github.com/pmndrs/koota
[r3f-koota-starter]: https://github.com/Ctrlmonster/r3f-koota-starter
