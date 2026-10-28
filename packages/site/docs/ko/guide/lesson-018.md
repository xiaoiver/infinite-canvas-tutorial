---
outline: deep
description: 'Becsy를 사용한 엔티티-컴포넌트-시스템(ECS)으로 아키텍처를 리팩터링합니다. TypeScript 믹스인을 조합 기반 방식으로 바꾸고, 플러그인, 컴포넌트, 시스템을 구현해 모듈성을 높입니다.'
head:
    - ['meta', { property: 'og:title', content: '18강 - ECS로 리팩터링' }]
---

<script setup>
import Spectrum from '../../components/Spectrum.vue'
</script>

# 18강 - ECS로 리팩터링 {#lesson-18-refactor-with-ecs}

이 시점에서 리팩터링하기로 했습니다. 이번 강의부터 다음 두 npm 패키지를 구현합니다.

-   [@infinite-canvas-tutorial/ecs]는 [Becsy]로 ECS를 구현하며, 내장 Plugin, Component, System을 포함합니다.
-   [@infinite-canvas-tutorial/webcomponents]는 [Spectrum]에 기반해 UI를 구현하고, [7강]에서 사용한 Shoelace를 대체합니다. 걱정하지 않아도 됩니다. 둘 다 Lit 구현에 기반합니다.

<Spectrum />

현재는 [TypeScript Mixins]로 컴포넌트를 구현하지만, 이 상속 기반 방식에는 분명한 문제가 있습니다. 층층이 쌓인 컴포넌트 클래스는 유지하기 어렵습니다.

```ts
// Current approach
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));
const shape = new Shape();

// ECS approach
const shape = world.spawn(Renderable, Sortable, Transformable);
```

ECS는 조합을 잘 다루어, 필요할 때 엔티티의 능력을 유연하게 보강할 수 있습니다. [Entity-Component-System in A-Frame]에서도 이 점을 강조합니다.

> ECS의 이점은 다음과 같습니다.
>
> -   재사용할 수 있는 부분을 섞고 맞추어 객체를 정의할 때 유연성이 커집니다.
> -   기능이 복잡하게 얽힌 긴 상속 사슬의 문제가 사라집니다.

A-Frame은 선언적 ECS 사용이 인상적인, 잘 알려진 Three.js 프레임워크입니다. 게임 엔진에서는 ECS가 더 널리 쓰입니다. 예를 들어 [ECS for Unity]와, 이번 구현에서 주로 참고하는 [Bevy ECS]가 있습니다.

## ECS 아키텍처란 {#what-is-ecs}

[ecs-faq]는 자주 묻는 질문, 자료, 여러 언어의 구현을 모아 두었으니 살펴볼 만합니다. 여기서는 [Bevy ECS]의 소개를 인용합니다.

> Bevy의 모든 앱 로직은 Entity Component System 패러다임을 사용하며, 보통 ECS로 줄여 부릅니다. ECS는 프로그램을 **Entity**, **Component**, **System**으로 나누는 소프트웨어 패턴입니다. Entity는 Component 묶음이 할당되는 고유한 "대상"이고, System이 이를 처리합니다.

다음 도표는 [ECSY Architecture]에서 가져왔으며, 각 부분의 관계를 시각적으로 보여 줍니다.

![ECSY 아키텍처](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

Entity와 Component의 관계는 관계형 데이터베이스의 테이블 관점으로 이해할 수 있습니다. 전자는 데이터의 행에, 후자는 필드에 대응합니다.

![ECS 단순 배치](https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ECS_Simple_Layout.svg/440px-ECS_Simple_Layout.svg.png)

호출하는 쪽의 시점에서는 [Composition over inheritance] 원칙을 이해하기 더 쉽습니다. 동시에 Entity와 Component에는 구체적인 처리 로직이 없고, 연관된 데이터만 들어 있습니다.

```rs
commands.spawn(Position(10, 20), Color(255, 0, 0)); // Entity #1
commands.spawn(Position(30, 40), Color(0, 255, 0)); // Entity #2
```

각 System은 Query로 자신이 관심 있는 특정 Component를 가진 Entity 목록을 고릅니다. SQL로 데이터 테이블을 조회하는 것에 비길 수 있습니다.

```rs
// @see https://bevyengine.org/learn/quick-start/getting-started/ecs/#your-first-query
fn print_position_system(query: Query<&Position>) {
    for position in &query {
        println!("position: {} {}", position.x, position.y);
    }
}
```

전역으로 보면 애플리케이션 전체가 여러 System으로 나뉩니다.

![ECSY의 예](https://ecsyjs.github.io/ecsy/docs/manual/images/dragons.svg)

단순한 데모가 아닌 실제 애플리케이션에서는 다음 문제가 생깁니다. 나중에 펼쳐 설명하며, 이것이 ECS 구현을 고른 근거가 됩니다.

1. 직관적이고 친숙한 문법으로 복잡한 Query를 어떻게 만들까요?
2. 여러 System의 실행 순서를 어떻게 제어할까요?
3. System은 서로 어떻게 통신할까요?

먼저 ECS를 보완하는 개념을 살펴보겠습니다.

### 플러그인 {#plugins}

2장의 [플러그인 시스템]에서 이 방식으로 높은 응집도를 보이고 확장성을 높였습니다. [Bevy Plugins]도 비슷한 방식으로 내장 기능을 조직하며, 각 Plugin은 Component와 System을 포함합니다. 사용자도 이 방식으로 자신의 플러그인을 개발할 수 있습니다.

> Bevy의 핵심 원칙 중 하나는 모듈성입니다. Bevy 엔진의 모든 기능은 플러그인, 즉 App을 수정하는 코드의 모음으로 구현됩니다.

실제로 확장하기 쉽습니다.

```rs
fn main() {
    App::new()
        .add_plugins(DefaultPlugins) // Default plugin set provided by the official team
        .add_systems(Startup, add_people)
        .add_systems(Update, (hello_world, (update_people, greet_people).chain()))
        .run();
}
```

우리 프로젝트에서 내장 플러그인은 `/plugins` 아래에 두고, `DefaultPlugins`로 플러그인 모음을 노출하며, 초기화할 때 사용할 수 있습니다. 물론 플러그인을 직접 만들어 확장할 수도 있습니다.

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
```

### 리소스 {#resources}

Entity와 Component의 조합이 데이터 테이블과 같은 구조를 이룬다고 소개했습니다. 하지만 애플리케이션은 전역으로 유일한 객체도 неизбе하게 사용합니다. [Bevy Resources]를 참고하세요. 이후 구현에서는 `singleton` 개념을 사용합니다.

## 프론트엔드의 ECS 구현 {#ecs-implementation-in-frontend}

프론트엔드에는 바로 쓸 수 있는 ECS 구현이 여러 가지 있습니다. [ECSY Architecture] 문서의 도표가 마음에 들고(위에서 인용했습니다), 현재 프로젝트에는 맞지 않다고 판단했습니다. [koota]와 [Becsy]를 비교한 뒤, 프로젝트에서는 후자를 쓰기로 했습니다. 아래에서는 제가 중요하게 보는 특성을 소개합니다.

| 특성             | Becsy | koota | ECSY | bitECS |
| ---------------- | ----- | ----- | ---- | ------ |
| Query 수정자     | ✅    | ✅    | ❌   | ❌     |
| 반응형 Query     | ✅    | ✅    | ✅   | ✅     |
| System 실행 순서 | ✅    | ❌    | ✅   | ✅     |
| System 간 통신   | ✅    | ❌    | ❌   | ❌     |

### Query 수정자 {#query-modifiers}

단순한 Query 구성은 ECSY와 [bitECS] 모두에서 지원됩니다.

```ts
// https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=queries
SystemName.queries = {
    boxes: { components: [Box] },
    spheres: { components: [Sphere] },
};

// https://github.com/NateTheGreatt/bitECS/blob/master/docs/API.md#defineQuery
const movementQuery = defineQuery([Position, Velocity]);
```

복잡한 Query란 무엇일까요? 간단히 말하면 `Not`, `Or`, `And` 같은 수정자로 여러 조회 조건을 조합할 수 있다는 뜻입니다. 예를 들어 [koota]와 [Becsy]에서는 다음과 같습니다.

```ts
// https://github.com/pmndrs/koota?tab=readme-ov-file#query-modifiers
const staticEntities = world.query(Position, Not(Velocity));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#basic-query-syntax
private activeEnemies = this.query(
    q => q.current.with(Enemy).and.withAny(stateEnum).but.without(Dead));
```

또 하나의 중요한 특성은 반응형 Query입니다. Entity의 Component가 추가, 수정, 삭제되면 자동으로 갱신됩니다.

```ts
// koota
const Added = createAdded();
const newPositions = world.query(Added(Position));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#reactive-queries
private boxes = this.query(q => q.added.and.removed.with(Box, Transform));
```

### System 실행 순서 {#system-execution-order}

단순한 경우 [Becsy]의 스케줄러는 각 System이 Component를 읽고 쓰는 관계를 바탕으로 최종 실행 순서를 계산합니다. 하지만 두 System이 같은 종류의 Component에 모두 써야 한다면, 실행 순서를 명시적으로 지정해야 합니다. `before/after` 제약 외에도, 더 직관적인 제약을 사용할 수 있습니다.

예를 들어 System `ComputeCamera`가 `Camera`에 쓰는 모든 System 다음에 실행되게 하고 싶습니다.

```ts
// CameraPlugin
system((s) => s.afterWritersOf(Camera))(ComputeCamera);
```

마지막으로 개발 모드에서 [Becsy]는 현재 시스템 실행 순서를 콘솔에 출력하고, 순환이 있으면 오류를 보고합니다.

### System 간 통신 {#system-communication}

이상적으로 각 System은 자신의 Component 읽기와 쓰기만 신경 쓰면 됩니다. 하지만 [Attaching systems]는 다른 System을 더 직접 참조할 수 있게 합니다.

```ts
export class ZoomLevel extends System {
    private readonly cameraControl = this.attach(CameraControl);
}
```

ECS 설계 패턴이 주는 편의를 예로 살펴보겠습니다.

## 계층 구조 {#hierarchy}

[3강]에서 씬 그래프 같은 트리 구조를 소개했습니다. 부모-자식 구조는 참조 형태로 유지되며, 변환 계산, 연쇄 가시성 같은 속성의 기반이 됩니다.

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

반면 ECS 아키텍처에서는 밑바닥 계층이 엔티티를 AoS로 저장하든 SoA로 저장하든 선형입니다. 평탄한 데이터 구조에서 이런 계층 구조를 어떻게 나타낼까요?

![AoS(왼쪽)와 SoA(오른쪽)의 메모리 레이아웃 비교](https://developer-blogs.nvidia.com/wp-content/uploads/2021/08/MLFrameworksIneroperability_pic2.png)

### 컴포넌트 정의 {#define-component}

[Hierarchical relationships in an Entity Component System]은 몇 가지 접근을 제시합니다.

1. 계층적 엔티티, 즉 "컴포넌트가 있는 씬 그래프". 계층 관계를 엔티티에 저장하고, 평소처럼 위에서 아래로 순회합니다.
2. 계층적 컴포넌트. 계층 관계를 컴포넌트에 저장합니다.

우리는 두 번째 접근을 선택하고, Becsy의 [Referencing entities] 능력으로 구현합니다.

```ts
import { Entity, field } from '@lastolivegames/becsy';

export class Parent {
    @field.backrefs(Children, 'parent') declare children: Entity[];
}
export class Children {
    @field.ref declare parent: Entity;
}
```

자식 노드를 추가할 때는 Child 쪽에서 Parent 엔티티를 연관시키기만 하면, 반대쪽에도 연관이 반영됩니다.

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

참고로 Bevy는 0.16 버전부터 새로운 [ECS Relationships]를 사용합니다.

```rs
commands.spawn(ChildOf(some_parent));
commands.entity(some_entity).insert(ChildOf(new_parent));
```

우리 구현에서는 [Bevy Hierarchy]를 참고해 Entity 위에 EntityCommand를 감싸고, 위의 부모-자식 관계 구성을 더 쓰기 쉬운 방식으로 제공합니다. `AddChild`가 위의 구현을 담고 있습니다.

```ts
export class EntityCommands {
    appendChild(child: EntityCommands) {
        this.commands.add(new AddChild(this.id(), child.id()));
        return this;
    }
}

parent.appendChild(child);
```

마지막으로 플러그인에서 두 Component의 등록을 마칩니다.

```ts
import { component } from '@lastolivegames/becsy';

export const HierarchyPlugin: Plugin = () => {
    component(Parent);
    component(Children);
};
```

### 월드 변환 계산 {#calculate-world-transform}

System의 Query 문법은 그 자체로 의미가 분명합니다. 예를 들어 여기서는 `Transform`과 `Parent`를 포함하는 모든 엔티티를 고르고, 처음 추가될 때와 변경될 때 (자식 노드의) `GlobalTransform`을 계산해 갱신하고자 합니다.

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

## 이벤트에 응답 {#response-to-an-event}

System이 매 프레임 호출된다면, 비동기 이벤트에는 어떻게 응답할까요?

### Bevy 이벤트 {#bevy-events}

Bevy에서 창 크기 변경 이벤트에 응답하는 예를 살펴보겠습니다. [window-resizing]에서는 `EventReader`로 `WindowResized` 이벤트가 나르는 데이터를 읽습니다.

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

`WindowResized` 이벤트는 `EventWriter`가 기록합니다.

```rs
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_winit/src/state.rs#L945-L949
// window_resized: &mut EventWriter<WindowResized>,
window_resized.write(WindowResized {
    window: window_entity,
    width: window.width(),
    height: window.height(),
});
```

이벤트 메커니즘이 시스템 간 통신에 편의를 준다는 것을 알 수 있습니다. 자세한 내용은 [Bevy Events]를 참고하세요.

### Becsy 코루틴 {#becsy-coroutines}

EventWriter System에서 DOM API로 이벤트를 수신합니다.

```ts
$el.addEventListener('pointerup', onPointerUp, true);
const onPointerUp = (e: PointerEvent) => {
    this.setInputTrigger(input, 'pointerUpTrigger');
};
```

이벤트가 발생하면 해당 이벤트 플래그를 Input 컴포넌트에 기록합니다. 이 컴포넌트는 다른 이벤트의 트리거 상태, <kbd>Ctrl</kbd>, <kbd>Shift</kbd> 키 상태, 이벤트 좌표도 기록합니다. 이 상태는 이후 상호작용에 쓰입니다. 예를 들어 클릭해서 도형을 선택하거나, 드래그해서 도형을 선택하는 동작입니다.

```ts
export class Input {
    @field.boolean declare pointerUpTrigger: boolean;
}
```

한 프레임에 상태를 한 번만 기록하려면 어떻게 할까요? Becsy는 [coroutines]로 여러 프레임에 걸친 로직을 처리하며, 일정 프레임 수나 초를 기다리는 능력도 포함합니다. 여기서는 가장 기본적인 사용법을 씁니다.

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

마지막으로 CameraControl처럼 이벤트를 처리해야 하는 시스템에서는, 플래그를 통해 현재 프레임의 해당 이벤트를 처리할 수 있습니다.

```ts
execute() {
    const input = canvas.write(Input);
    if (input.pointerDownTrigger) {}
    if (input.pointerUpTrigger) {}
}
```

## 더 읽어보기 {#extended-reading}

-   [babylon.js coroutines]

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
[플러그인 시스템]: /ko/guide/lesson-001#plugin-based-architecture
[bitECS]: https://github.com/NateTheGreatt/bitECS
[Hierarchical relationships in an Entity Component System]: https://gamedev.stackexchange.com/questions/206715/hierarchical-relationships-in-an-entity-component-system
[Referencing entities]: https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities
[3강]: /ko/guide/lesson-003#scenegraph
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[@infinite-canvas-tutorial/webcomponents]: https://www.npmjs.com/package/@infinite-canvas-tutorial/webcomponents
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Attaching systems]: https://lastolivegames.github.io/becsy/guide/architecture/systems#attaching-systems
[7강]: /ko/guide/lesson-007
[Bevy Hierarchy]: https://bevy-cheatbook.github.io/fundamentals/hierarchy.html
[ECS Relationships]: https://bevyengine.org/news/bevy-0-16/#ecs-relationships
