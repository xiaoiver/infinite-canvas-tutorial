---
outline: deep
description: 'Becsy を使ったエンティティ・コンポーネント・システム（ECS）でアーキテクチャをリファクタリングします。TypeScript のミックスインをコンポジションベースの方式に置き換え、プラグイン、コンポーネント、システムを実装してモジュール性を高めます。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第18課 - ECS でリファクタリング' },
      ]
---

<script setup>
import Spectrum from '../../components/Spectrum.vue'
</script>

# 第 18 課 - ECS でリファクタリング {#lesson-18-refactor-with-ecs}

この時点でリファクタリングすることにしました。この課から、次の二つの npm パッケージを実装します。

-   [@infinite-canvas-tutorial/ecs] は [Becsy] で ECS を実装し、組み込みの Plugin、Component、System を含みます。
-   [@infinite-canvas-tutorial/webcomponents] は [Spectrum] に基づいて UI を実装し、[第 7 課] で使っていた Shoelace を置き換えます。心配はいりません。どちらも Lit の実装に基づいています。

<Spectrum />

現在は [TypeScript Mixins] でコンポーネントを実装していますが、この継承ベースの方式には明らかな問題があります。層を重ねたコンポーネントクラスは保守しにくいのです。

```ts
// Current approach
export const Shape = Shapable(Renderable(Sortable(Transformable(EventTarget))));
const shape = new Shape();

// ECS approach
const shape = world.spawn(Renderable, Sortable, Transformable);
```

ECS はコンポジションをうまく扱い、必要に応じてエンティティの能力を柔軟に高められます。[Entity-Component-System in A-Frame] でもこの点が強調されています。

> ECS の利点は次のとおりです。
>
> -   再利用できる部品を組み合わせてオブジェクトを定義するとき、柔軟性が高まります。
> -   機能が複雑に絡み合った長い継承の連鎖がもたらす問題をなくせます。

A-Frame は、宣言的な ECS の使い方が印象的な、よく知られた Three.js フレームワークです。ゲームエンジンでは ECS がより広く使われています。たとえば [ECS for Unity] と、今回の実装で主に参考にしている [Bevy ECS] です。

## ECS アーキテクチャとは {#what-is-ecs}

[ecs-faq] は、よくある質問、資料、各言語の実装をまとめており、見ておく価値があります。ここでは [Bevy ECS] の紹介を引用します。

> Bevy のアプリロジックはすべて Entity Component System パラダイムを使い、しばしば ECS と略されます。ECS はプログラムを **Entity**、**Component**、**System** に分けるソフトウェアパターンです。Entity は Component のグループが割り当てられる固有の「もの」で、System がそれを処理します。

次の図は [ECSY Architecture] から取ったもので、各部分の関係を視覚的に示しています。

![ECSY アーキテクチャ](https://ecsyjs.github.io/ecsy/docs/manual/images/ECSY%20Architecture.svg)

Entity と Component の関係は、関係データベースのテーブルという見方で理解できます。前者はデータの行に、後者はフィールドに対応します。

![ECS の単純な配置](https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/ECS_Simple_Layout.svg/440px-ECS_Simple_Layout.svg.png)

呼び出す側の視点では、[Composition over inheritance] の原則を理解しやすくなります。同時に、Entity と Component には具体的な処理ロジックがなく、関連付けられたデータだけが入っていることが分かります。

```rs
commands.spawn(Position(10, 20), Color(255, 0, 0)); // Entity #1
commands.spawn(Position(30, 40), Color(0, 255, 0)); // Entity #2
```

各 System は Query を通じて、関心のある特定の Component を持つ Entity のリストを選びます。SQL でデータテーブルを問い合わせることにたとえられます。

```rs
// @see https://bevyengine.org/learn/quick-start/getting-started/ecs/#your-first-query
fn print_position_system(query: Query<&Position>) {
    for position in &query {
        println!("position: {} {}", position.x, position.y);
    }
}
```

全体で見ると、アプリケーションは複数の System に分かれています。

![ECSY の例](https://ecsyjs.github.io/ecsy/docs/manual/images/dragons.svg)

単純なデモではなく実際のアプリケーションでは、次の問題が起きます。あとで詳しく説明し、これが ECS 実装を選んだ根拠になります。

1. 直感的で扱いやすい構文で、複雑な Query をどう作るでしょうか？
2. 複数の System の実行順序をどう制御するでしょうか？
3. System は互いにどう通信するでしょうか？

まず ECS を補う仕組みを見ていきます。

### プラグイン {#plugins}

第 2 章の [プラグインシステム] で、この方式を使って高い凝集度を示し、拡張性を高めました。[Bevy Plugins] も似た方式で組み込み機能をまとめ、各 Plugin は Component と System を含みます。ユーザーもこの方式で自分のプラグインを開発できます。

> Bevy の中心的な原則の一つはモジュール性です。Bevy エンジンの機能はすべてプラグイン、つまり App を変更するコードの集まりとして実装されています。

実際に拡張するのは簡単です。

```rs
fn main() {
    App::new()
        .add_plugins(DefaultPlugins) // Default plugin set provided by the official team
        .add_systems(Startup, add_people)
        .add_systems(Update, (hello_world, (update_people, greet_people).chain()))
        .run();
}
```

私たちのプロジェクトでは、組み込みプラグインを `/plugins` の下に置き、`DefaultPlugins` でプラグインの集合として公開し、初期化時に使えます。もちろん、プラグインを自分で作って拡張することもできます。

```ts
import { App, DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

new App().addPlugins(...DefaultPlugins, MyPlugin).run();
```

### リソース {#resources}

Entity と Component の組み合わせがデータテーブルのような構造を作ると紹介しました。しかしアプリケーションは、グローバルに一意なオブジェクトも必然的に使います。[Bevy Resources] を参照してください。以降の実装では `singleton` の概念を使います。

## フロントエンドの ECS 実装 {#ecs-implementation-in-frontend}

フロントエンドには、すぐに使える ECS 実装がいくつかあります。[ECSY Architecture] のドキュメントにある図は気に入っています（上で引用しました）が、現在のプロジェクトには向かないと判断しました。[koota] と [Becsy] を比較したあと、プロジェクトでは後者を使うことにしました。以下では、重視している特性を紹介します。

| 特性               | Becsy | koota | ECSY | bitECS |
| ------------------ | ----- | ----- | ---- | ------ |
| Query 修飾子       | ✅    | ✅    | ❌   | ❌     |
| リアクティブ Query | ✅    | ✅    | ✅   | ✅     |
| System の実行順序  | ✅    | ❌    | ✅   | ✅     |
| System 間通信      | ✅    | ❌    | ❌   | ❌     |

### Query 修飾子 {#query-modifiers}

単純な Query の構築は、ECSY と [bitECS] の両方でサポートされています。

```ts
// https://ecsyjs.github.io/ecsy/docs/#/manual/Architecture?id=queries
SystemName.queries = {
    boxes: { components: [Box] },
    spheres: { components: [Sphere] },
};

// https://github.com/NateTheGreatt/bitECS/blob/master/docs/API.md#defineQuery
const movementQuery = defineQuery([Position, Velocity]);
```

複雑な Query とは何でしょうか。簡単に言うと、`Not`、`Or`、`And` のような修飾子で複数の問い合わせ条件を組み合わせられるということです。たとえば [koota] と [Becsy] では次のとおりです。

```ts
// https://github.com/pmndrs/koota?tab=readme-ov-file#query-modifiers
const staticEntities = world.query(Position, Not(Velocity));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#basic-query-syntax
private activeEnemies = this.query(
    q => q.current.with(Enemy).and.withAny(stateEnum).but.without(Dead));
```

もう一つの重要な特性はリアクティブ Query です。Entity の Component が追加、変更、削除されると、自動的に更新されます。

```ts
// koota
const Added = createAdded();
const newPositions = world.query(Added(Position));

// https://lastolivegames.github.io/becsy/guide/architecture/queries#reactive-queries
private boxes = this.query(q => q.added.and.removed.with(Box, Transform));
```

### System の実行順序 {#system-execution-order}

単純な場合、[Becsy] のスケジューラは各 System の Component に対する読み書きの関係から、最終的な実行順序を計算します。ただし二つの System が同じ種類の Component へどちらも書き込む必要があるなら、実行する順序を明示的に指定する必要があります。`before/after` の制約に加え、より直感的な制約も使えます。

たとえば、System `ComputeCamera` を、`Camera` に書き込むすべての System のあとに実行させたいとします。

```ts
// CameraPlugin
system((s) => s.afterWritersOf(Camera))(ComputeCamera);
```

最後に、開発モードでは [Becsy] が現在のシステム実行順序をコンソールに出力し、循環があればエラーを報告します。

### System 間の通信 {#system-communication}

理想的には、各 System は自分の Component の読み書きだけを気にすれば十分です。しかし [Attaching systems] は、他の System をより直接参照する能力を与えてくれます。

```ts
export class ZoomLevel extends System {
    private readonly cameraControl = this.attach(CameraControl);
}
```

ECS という設計パターンがもたらす便利さを、例で見ていきます。

## 階層構造 {#hierarchy}

[第 3 課] では、シーングラフのような木構造を紹介しました。親子構造は参照の形で維持され、変換の計算やカスケード可視性などの性質の基礎になります。

```ts
export abstract class Shape {
    parent: Shape;
    readonly children: Shape[] = [];
}
```

一方 ECS アーキテクチャでは、下層がエンティティを AoS で格納しても SoA で格納しても線形です。フラットなデータ構造で、このような階層構造をどう表すでしょうか。

![AoS（左）と SoA（右）のメモリレイアウトの比較](https://developer-blogs.nvidia.com/wp-content/uploads/2021/08/MLFrameworksIneroperability_pic2.png)

### コンポーネントの定義 {#define-component}

[Hierarchical relationships in an Entity Component System] は、いくつかのアプローチを示しています。

1. 階層的なエンティティ、すなわち「コンポーネント付きシーングラフ」。階層関係をエンティティに格納し、いつものように上から下へ走査します。
2. 階層的なコンポーネント。階層関係をコンポーネントに格納します。

私たちは二つ目のアプローチを選び、Becsy の [Referencing entities] の能力で実装します。

```ts
import { Entity, field } from '@lastolivegames/becsy';

export class Parent {
    @field.backrefs(Children, 'parent') declare children: Entity[];
}
export class Children {
    @field.ref declare parent: Entity;
}
```

子ノードを追加するときは、Child 側で Parent エンティティを関連付けるだけで、反対側にも関連が反映されます。

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

なお、Bevy はバージョン 0.16 から新しい [ECS Relationships] を使っています。

```rs
commands.spawn(ChildOf(some_parent));
commands.entity(some_entity).insert(ChildOf(new_parent));
```

私たちの実装では [Bevy Hierarchy] を参考に、Entity の上に EntityCommand を包み、上の親子関係の構築をより使いやすい方法で提供します。`AddChild` が上の実装を含んでいます。

```ts
export class EntityCommands {
    appendChild(child: EntityCommands) {
        this.commands.add(new AddChild(this.id(), child.id()));
        return this;
    }
}

parent.appendChild(child);
```

最後に、プラグインの中で二つの Component の登録を終えます。

```ts
import { component } from '@lastolivegames/becsy';

export const HierarchyPlugin: Plugin = () => {
    component(Parent);
    component(Children);
};
```

### ワールド変換の計算 {#calculate-world-transform}

System の Query 構文は、見れば意図が分かります。たとえばここでは `Transform` と `Parent` を含むすべてのエンティティを選び、それらが最初に追加されたときと変更されたときに（子ノードの）`GlobalTransform` を計算して更新します。

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

## イベントへの応答 {#response-to-an-event}

System が毎フレーム呼ばれるなら、非同期イベントにはどう応答するでしょうか。

### Bevy のイベント {#bevy-events}

Bevy でウィンドウサイズ変更イベントに応答する例を見ていきます。[window-resizing] では、`EventReader` を使って `WindowResized` イベントが運ぶデータを読みます。

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

`WindowResized` イベントは `EventWriter` が書き込みます。

```rs
// https://github.com/bevyengine/bevy/blob/main/crates/bevy_winit/src/state.rs#L945-L949
// window_resized: &mut EventWriter<WindowResized>,
window_resized.write(WindowResized {
    window: window_entity,
    width: window.width(),
    height: window.height(),
});
```

イベントの仕組みがシステム間通信に便利さを提供することが分かります。詳細は [Bevy Events] を参照してください。

### Becsy のコルーチン {#becsy-coroutines}

EventWriter System の中で、DOM API を通じてイベントを待ち受けます。

```ts
$el.addEventListener('pointerup', onPointerUp, true);
const onPointerUp = (e: PointerEvent) => {
    this.setInputTrigger(input, 'pointerUpTrigger');
};
```

イベントが起きると、対応するイベントフラグを Input コンポーネントへ書き込みます。このコンポーネントは、他のイベントのトリガー状態、<kbd>Ctrl</kbd>、<kbd>Shift</kbd> キーの状態、イベント座標も記録します。これらの状態は、その後のインタラクションに使います。たとえばクリックで図形を選択する、ドラッグで図形を選択する、といった動作です。

```ts
export class Input {
    @field.boolean declare pointerUpTrigger: boolean;
}
```

1 フレームの中で状態を一度だけ書き込むには、どうすればよいでしょうか。Becsy は [coroutines] で複数フレームにまたがるロジックを扱い、一定のフレーム数や秒数だけ待つ能力も含みます。ここでは最も基本的な使い方を使います。

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

最後に、CameraControl のようにイベントを処理する必要があるシステムでは、フラグを通じて現在のフレームの対応するイベントを処理できます。

```ts
execute() {
    const input = canvas.write(Input);
    if (input.pointerDownTrigger) {}
    if (input.pointerUpTrigger) {}
}
```

## さらに読む {#extended-reading}

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
[プラグインシステム]: /ja/guide/lesson-001#plugin-based-architecture
[bitECS]: https://github.com/NateTheGreatt/bitECS
[Hierarchical relationships in an Entity Component System]: https://gamedev.stackexchange.com/questions/206715/hierarchical-relationships-in-an-entity-component-system
[Referencing entities]: https://lastolivegames.github.io/becsy/guide/architecture/components#referencing-entities
[第 3 課]: /ja/guide/lesson-003#scenegraph
[@infinite-canvas-tutorial/ecs]: https://www.npmjs.com/package/@infinite-canvas-tutorial/ecs
[@infinite-canvas-tutorial/webcomponents]: https://www.npmjs.com/package/@infinite-canvas-tutorial/webcomponents
[Spectrum]: https://opensource.adobe.com/spectrum-web-components
[Attaching systems]: https://lastolivegames.github.io/becsy/guide/architecture/systems#attaching-systems
[第 7 課]: /ja/guide/lesson-007
[Bevy Hierarchy]: https://bevy-cheatbook.github.io/fundamentals/hierarchy.html
[ECS Relationships]: https://bevyengine.org/news/bevy-0-16/#ecs-relationships
