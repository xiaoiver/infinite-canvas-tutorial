---
outline: deep
description: '기존 2D 무한 캔버스 위에 실제 3D 메시 렌더링을 올립니다. 통합 3D 공간, Camera3D, MeshPipeline3D를 다룹니다.'
head:
    - ['meta', { property: 'og:title', content: '39강 - 3D 메시 렌더링' }]
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
import SvgExtrusion from '../../components/SvgExtrusion.vue'
import IconExtrusion from '../../components/IconExtrusion.vue'
</script>

# 39강 - 3D 메시 렌더링 {#lesson-39-3d-mesh-rendering}

[30강 - 후처리와 렌더 그래프][Lesson 30 - Post-processing and render graph] 이전에는 캔버스의 모든 내용이 2D 파이프라인을 거쳤습니다. 직교 카메라, SDF, 패스 삼각화 채우기 등이 여기에 해당합니다. 이번 강의는 그 2D 렌더러를 바꾸지 않고 3D 메시 분기를 더합니다. 정점은 노멀을 갖고, 원근 투영과 직교 투영, 깊이 테스트를 거친 뒤, 같은 캔버스에서 2D 레이어와 합성됩니다.

## Framer, Spline, Rive, Bevy {#framer-spline-rive-bevy}

Framer와 Spline에서 2D와 3D를 합치는 핵심 아이디어는 두 가지 기술 경로로 요약할 수 있습니다. 각 제품은 자신의 포지셔닝에 따라 다른 아키텍처를 고릅니다.

Framer의 3D 기능은 본질적으로 CSS 3D 변환을 강화해서 감싼 것이며, 실제 3D 렌더링 파이프라인이 아닙니다. 따라서 외부 3D 모델 가져오기(GLB/OBJ)가 없고, 실제 조명, 그림자, 재질 시스템도 없습니다. 3D 효과는 카드 뒤집기나 패럴랙스 레이어 같은 단순한 경우로 제한됩니다. 참고: [How to Turn 2D Elements into Interactive 3D Objects in Framer]

![출처: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline은 실제 3D 에디터이며, 아키텍처는 게임 엔진에 가깝습니다. Spline에서는 독립된 [UI Scenes]（2D 캔버스）를 만들고, 3D 씬의 UI Frame 객체에 텍스처로 쓸 수 있습니다. [Working with 2D and 3D objects]

![출처: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive는 지금도 기본적으로 2D 도구입니다. “3D처럼 보이는” 느낌은 2.5D 변환, 메시 변형 같은 기법에서 오며, 완전한 3D 파이프라인은 아닙니다.

우리의 접근은 [2D Rendering in Bevy]에 가깝습니다. 2D 도형은 **z = 0** 평면에 놓이고, 3D 모델은 같은 월드를 공유합니다. 2D 카메라를 팬하거나 줌하면 3D 카메라가 선택적으로 따라갈 수 있습니다. 구현은 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)을 참고하세요.

## 아키텍처 개요 {#architecture}

```plaintext
Same WebGL/WebGPU context
  └─ MeshPipeline render graph
       ├─ Pass: 3D (MeshPipeline3D.drawMeshes)
       ├─ Pass: 3D Gizmo (RenderGizmo3D.drawGizmos, on top of meshes)
       ├─ Pass: grid / 2D vector (existing BatchManager)
       └─ Pass: post-processing → present
```

-   **`Renderer3DPlugin`**: 3D 구성 요소를 등록하고 `MeshPipeline3D`(GPU 캐시), **`CameraSync`**(2D 카메라 연동), **`Pick3D`**(선택/드래그), **`RenderGizmo3D`**(변환 기즈모 그리기)를 스케줄합니다.
-   **`MeshPipeline3D`**: 자체 스왑체인을 화면에 제시하지 않습니다. `MeshPipeline`의 메인 패스 안에서 **3D를 먼저 그린 다음 2D를 그리며**, 컬러 어태치먼트와 깊이 어태치먼트를 공유합니다.
-   기존의 **`Mesh.ts`**는 여전히 **2D 벡터 채우기**입니다. 3D의 `Mesh3D`와 혼동하지 마세요.

플러그인 설정:

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## 핵심 구성 요소 {#components}

| 구성 요소         | 역할                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`. `linked`이면 `CameraSync`가 2D 팬/줌을 따릅니다               |
| **`Mesh3D`**      | `positions`, `normals`, 선택적 `indices`(삼각형 메시)                                                        |
| **`Material3D`**  | 메탈릭-러프니스 PBR: `baseColor`, `metallic`, `roughness`, 앰비언트 강도. 레거시 필드는 호환을 위해 남습니다 |
| **`Light3D`**     | `ambient` / `directional` / `point` / `spot`. [씬 조명 예시](/example/lighting)를 참고하세요                 |
| **`Transform3D`** | 이동, 오일러 회전, 스케일                                                                                    |
| **`Selected3D`**  | 3D 선택 상태: 기즈모 모드, 활성 축/평면, 드래그 기준점 등. [3D 변환 기즈모](#gizmo)를 참고하세요             |
| **`Mat4`**        | 4×4 행렬 도우미 (`perspective` / `ortho` / `lookAt`)                                                         |

ECS의 `commands.spawn`으로 엔티티를 생성합니다. 예를 들면 다음과 같습니다.

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

## 통합 3D 공간 (연동 카메라) {#unified-space}

**캔버스를 팬/줌할 때 2D와 3D가 함께 움직이게** 하려면 `Camera3D`에 `linked: true`를 설정합니다.

매 프레임 `CameraSync`는 2D `ComputedCamera`의 `(x, y, zoom)`을 읽어 3D 카메라의 `eye` / `center` / `baseDistance`에 씁니다.

-   줌: `baseDistance = canvas.height / 2`, `eye.z = baseDistance / zoom`. z = 0에서 2D `mat3.projection`의 보이는 높이와 맞춥니다.
-   **연동 직교** (`projection: 'orthographic'`): `eye = [x, -y, distance]`, `center = [x, -y, 0]` (2D 캔버스의 Y는 아래 방향이고 3D 월드의 Y는 위 방향입니다. `canvasWorldToWorld3D`로 뒤집습니다)
-   **연동 원근** (`projection: 'perspective'`): `eye = [x, y, distance]`, `center = [x, y, 0]` (2D 노드와 같습니다. **캔버스 좌표이며 Y는 아래 방향**입니다)

### 연동 + 직교 {#linked-orthographic}

`MeshPipeline3D`는 2D `viewProjectionMatrix`를 그대로 씁니다. Y 뒤집기, 팬, 줌이 들어 있어 `extrude3d`와 2D 사각형이 엄격히 정렬됩니다.

[정육면체 (직교)](/example/cube) 예제는 **연동 + 직교**를 사용합니다 (`translation: [200, 100, 40]`).

<Cube />

### 연동 + 원근 {#linked-perspective}

원근 모드에서 화면 위치는 **완전한 2D VP**에서 나옵니다. 팬, 줌, Y 뒤집기가 2D와 같습니다. 깊이는 `Transform3D.translation.z`에 원근 행렬을 적용해 가까울수록 크게 보입니다. 기준점은 `translation`의 `(x, y, z)`이므로, 물체는 2D와 같은 `(x, y)`에 놓입니다.

[정육면체 (원근)](/example/cube-perspective)는 위의 **연동 + 원근** 설정을 사용합니다. 캔버스를 드래그하면 정육면체가 2D 레이어와 함께 팬되고 줌되어야 합니다.

<CubePerspective />

## 레이캐스트 피킹 {#raycast-picking}

3D 선택과 기즈모 상호작용은 **`Pick3D`** 시스템이 처리합니다. 선택 도구가 활성일 때 **`Select`**도 같은 시스템을 사용합니다. 포인터를 누르면 커서 아래의 뷰포트 픽셀을 기즈모 핸들과 `Mesh3D` 삼각형에 대해 검사합니다. GPU 피킹 패스는 쓰지 않습니다. 모든 계산은 CPU의 `ray-casting.ts`와 `pick3d-probe.ts`에서 실행됩니다.

### 파이프라인 {#pipeline}

```plaintext
viewport (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene (same matrices as rendering)
       └─ probePick3DAtViewport(…)
            ├─ 1. gizmo parts on Selected3D entities (screen-space / ray, per part)
            └─ 2. all Mesh3D on this canvas → keep closest hit (smallest t)
```

**우선순위**: 이미 선택된 엔티티의 **기즈모 핸들을 먼저** 검사합니다. 하나도 맞지 않을 때만 씬 메시를 검사합니다. 메시들 중에서는 레이를 따른 **거리가 가장 작은** 히트(연동 원근에서는 깊이가 가장 커서 가장 앞에 있는 히트)가 선택됩니다.

### 표준 레이캐스트 (직교 / 자유 카메라) {#standard-raycast-orthographic-free-camera}

연동 원근이 아닌 모드에서 피킹은 일반적인 3D 에디터와 같습니다.

1. **`screenToRay`**: 뷰포트 픽셀 → NDC → **`inv(view × projection)`**으로 근평면과 원평면의 점을 역투영하여 월드 공간 레이를 얻습니다.
2. **`rayMeshIntersection`**: 메시 정점을 엔티티의 모델 행렬로 변환한 뒤 다음을 수행합니다.
    - **광범위 단계**: 레이와 변환된 **AABB**(축 정렬 바운딩 박스)를 비교합니다(슬래브 방법).
    - **정밀 단계**: 각 삼각형에 **Möller–Trumbore** 레이-삼각형 검사를 하고, 가장 가까운 `t`를 남깁니다.

```ts
// packages/ecs/src/utils/ray-casting.ts (simplified)
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

**연동 직교** (`linked + orthographic`)는 같은 경로를 재사용합니다. `MeshPipeline3D`가 2D `viewProjectionMatrix`를 피킹 씬에 넣으므로, 클릭이 2D 사각형 및 `extrude3d`와 정렬된 채로 남습니다.

### 연동 원근: 화면 공간 삼각형 {#linked-perspective-screen-space-triangles}

**연동 원근**은 메시 히트에 월드 레이를 쓰지 **않습니다**. 화면 위치는 완전한 2D VP가 결정하고, 깊이는 `translation.z`에 대한 별도의 원근 행렬에서 옵니다. 정점 셰이더와 맞추기 위해 **`pickMeshLinkedPerspective`**는 같은 유니폼으로 각 삼각형을 뷰포트 공간에 투영한 뒤, 커서가 **2D로 투영된 삼각형** 안에 있는지를 검사하고 (`pointInTriangle2D`) 그 픽셀에서 **가장 앞쪽 깊이**를 고릅니다. 이 모드의 기즈모 부품도 같은 도우미를 재사용합니다(핸들에는 선택적인 Z 화면 오프셋을 둘 수 있습니다).

이렇게 하면 원근 정육면체가 있는 무한 캔버스를 팬/줌할 때도 “보이는 것이 곧 집어집니다”.

### 드래그 제약 {#drag-constraints}

기즈모를 누르면 초기 포즈와 고정된 투영을 담은 `GizmoSession`이 만들어집니다. 일반적인 카메라는 포인터 이동을 레이와 활성 제약 평면의 교차로 구합니다. 연동 카메라는 화면에 표시된 핸들 투영을 역으로 풀며, 여기에는 Z 화면 오프셋도 포함됩니다. 이동은 선택된 축이나 평면을 따르고, 회전은 로컬 링 축을 따릅니다. 유효하지 않거나 퇴화한 샘플은 미리보기를 바꾸지 않습니다.

세션은 이동 중에 런타임 구성 요소를 갱신합니다. 손을 떼면 선언적 소스가 문서 편집 하나와 실행 취소 항목 하나를 발행합니다. Escape, 포인터 취소, 또는 캔버스를 벗어나면 시작 포즈로 되돌리고 편집은 기록하지 않습니다.

활성 카메라, 그 투영/뷰, 또는 캔버스 크기를 바꾸면 누르고 있던 제스처가 취소됩니다. 소스의 포즈, 기하, 또는 조상의 변환을 외부에서 편집해도 취소됩니다. 런타임 미리보기는 **현재 문서**로 돌아가므로, 이전의 포인터 해제가 API 편집이나 실행 취소를 덮어쓰지 못합니다. 이름이나 색처럼 관련 없는 편집은 정상적으로 이어지는 드래그와 병합할 수 있습니다. 다른 캔버스의 변경은 이 제스처를 중단하지 않습니다. 핸들을 다시 누르면 새 뷰에서 시작합니다.

계산된 레이아웃도 제스처 맥락에 포함됩니다. Yoga는 문서의 해당 필드를 바꾸지 않은 채 소스의 위치나 크기를 바꿀 수 있습니다. 조상 변환을 포함한 이러한 변화는 미리보기를 취소합니다. 취소는 새 레이아웃을 유지하고, 미리보기가 아직 소유한 좌표만 되돌립니다. 그 밖에는 바뀌지 않은 레이아웃에서 Escape를 누르면, 문서와 달라도 계산된 시작 위치로 돌아갑니다. 세션 자신이 쓴 미리보기는 세션을 무효화하지 않습니다.

`GizmoSourceFrame`은 소스와 조상의 로컬 기하를 스냅샷으로 남겨, 월드 행렬 갱신이 늦어져 생기는 잘못된 중단을 피합니다. 포인터 세션이 소스 미리보기를 소유하는 동안, 동반 동기화는 그 소스를 다시 쓰지 않습니다. 동반 메시를 직접 조작하는 통합 코드는 기존의 역방향 동기화를 유지합니다.

변하지 않은 프레임은 동반 변환이나 재질을 다시 쓰지 않습니다. 포즈나 재질 편집은 생성된 CPU 기하를 재사용합니다. 기하 구성이 바뀌면 그 캐시만 따로 무효화됩니다.

`MeshPipeline3D`는 포즈/재질 편집 중에도 GPU 정점, 노멀, UV, 인덱스, 메시별 유니폼 버퍼를 재사용합니다. `Mesh3D`에 대한 쓰기만 기하를 무효화합니다. 배열을 직접 편집할 때는 먼저 `entity.write(Mesh3D)`로 구성 요소를 얻으세요. 캐시는 동반 동기화 이후에 그 쓰기를 소비하고, 건너뛴 드로우 동안 유지한 뒤, 다음 드로우에서 교체분을 한 번 업로드합니다. 기하 배열이 같은 메시는 한 캔버스 안에서 업로드된 기하를 공유하고, 각 메시는 자신의 모델 유니폼과 드로우 바인딩을 유지합니다. 제자리 기하 편집은 새 세대를 업로드합니다. 다른 인스턴스는 갱신되거나 제거될 때까지 이전 GPU 스냅샷을 유지합니다.
각 캔버스가 자신의 캐시와 씬 유니폼을 소유합니다. 메시를 제거하거나 다른 캔버스로 옮기면 이전 버퍼가 해제되고, 캔버스를 폐기하면 디바이스보다 먼저 그 자원이 해제됩니다. 실패한 할당은 롤백되며, 이전의 완전한 캐시 항목을 바꾸지 않은 채 다시 시도할 수 있습니다.

모델 행렬과 노멀 행렬은 포즈가 바뀔 때만 다시 계산합니다. 모델 유니폼 업로드도 변하지 않은 프레임과 카메라만 바뀐 경우는 건너뜁니다. 재질 편집과 완료된 텍스처 로드는 그 행렬을 다시 만들지 않고 유니폼을 갱신합니다. 변환/색 배열의 제자리 편집은 값으로 비교합니다.

씬 유니폼은 캔버스마다 캐시됩니다. 카메라와 연동된 2D 뷰가 바뀌면 씬 행렬을 갱신합니다. 조명이 바뀌면 그 행렬을 다시 만들지 않고 조명 데이터만 다시 묶습니다. 변하지 않은 드로우에서는 씬 데이터와 각 메시의 드로우 바인딩을 모두 재사용합니다. 텍스처가 준비되거나 교체될 때, 기하가 다시 만들어질 때, GPU 자원이 교체될 때 해당 바인딩이 무효화됩니다. 바인딩은 그것이 참조하는 버퍼와 텍스처보다 먼저 해제됩니다. 실패한 씬 업로드와 바인딩 할당은 다시 시도할 수 있습니다.

3D 레이어 목록은 유휴 프레임마다 모든 메시를 훑지 않고, ECS의 기하, 메타데이터, 소속 범위, 멤버십 변화를 따릅니다. 선택 멤버십은 따로 추적하므로, 기즈모 핸들 위에 올려도 목록을 다시 만들지 않습니다. 레이어 항목은 이후 선택과 실행 취소/다시 실행 이후에도 쓸 수 있도록 안정적인 엔티티 참조를 유지합니다.

핸들 색, 축, 전체 포인터 흐름은 [3D 변환 기즈모](#gizmo)를 참고하세요.

## 3D 변환 기즈모 {#gizmo}

**선택 도구** (`penbarSelected === Pen.SELECT`)로 3D 메시를 클릭하면 엔티티에 **`Selected3D`**가 붙고, 중심에는 **이동** 핸들이 그려집니다. 빨강/초록/파랑 화살표와 반투명 평면 위젯입니다. 핸들을 드래그하면 **`Transform3D.translation`**에 다시 씁니다. 2D의 `Selected` + `RenderTransformer`와 비슷하지만, 별도의 3D 피킹·그리기 경로를 탑니다.

### 상호작용 흐름 {#gizmo-flow}

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

### 좌표와 핸들 의미 {#gizmo-axes}

[통합 3D 공간](#unified-space)과 같이, 기즈모는 Blender식 Y-up이 아니라 **캔버스 좌표 (Y 아래)** 를 사용합니다.

| 색   | 축  | 방향 (일반적인 연동 캔버스 뷰) | 드래그 시 갱신  |
| ---- | --- | ------------------------------ | --------------- |
| 빨강 | +X  | 오른쪽                         | `translation.x` |
| 초록 | +Y  | 아래                           | `translation.y` |
| 파랑 | +Z  | **깊이** (화면 안쪽으로 `z+`)  | `translation.z` |

-   **화살표**: 한 축을 따라 이동합니다.
-   **평면** (`xy` / `xz` / `yz` 반투명 사각형): 두 성분을 한꺼번에 움직입니다 (예: `xy`는 X와 Y만 바꾸고 Z는 바꾸지 않습니다).

-   **결합 모드 `transform` (기본값, Spline과 비슷함)**: 이동 화살표/평면과 회전 링을 **동시에** 보여 줍니다. 어느 핸들을 잡든 그 연산이 실행됩니다 (`activePartKind`: `translate` | `rotate`). `W` / `E` 모드 전환은 없습니다.
-   **화살표 / 평면**을 드래그하면 `Transform3D.translation`이 갱신됩니다. **링**을 드래그하면 `Transform3D.rotation`이 갱신됩니다 (메시와 같은 로컬 오일러 각).
-   링은 물체의 현재 방향을 따르고, 화살표는 캔버스 월드 축에 남습니다 (X 오른쪽, Y 아래, Z 깊이).
-   피킹은 화면 공간에서 **가장 가까운** 히트를 사용합니다. 겹치면 화살표가 위에 있어 이동이 우선합니다. `scale`은 나중을 위해 남겨 둡니다.

### 돌출된 사각형 편집 {#extrude-editing}

`extrude3d`가 있는 `rect`는 선언적 메시와 같은 기즈모를 사용합니다. 직렬화 옵션에는 이제 높이 오프셋과 로컬 3D 회전이 포함됩니다.

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

-   XY 이동은 부모 좌표의 소스 사각형 `x`/`y`에 씁니다. 회전, 스케일, 뒤집힌 부모도 포함됩니다. 특이 부모 변환은 역행렬이 없으므로 미리보기를 거부합니다.
-   Z 이동은 `depth`를 유지한 채 `extrude3d.z`를 바꿉니다. 3D 회전이 0이면 `z`는 앞면의 높이 오프셋이고, 동반 메시의 중심은 `z - depth / 2`에 있습니다.
-   링 회전은 `extrude3d.rotation`에 씁니다. 소스에 이미 있는 월드 공간 2D 회전에 대한, 라디안 단위 XYZ 오일러 각입니다. 소스의 2D `rotation`은 그대로 둡니다. 보통의 회전된 도형에서 동반 메시는 `Rz(sourceAngle) × Rx(x) × Ry(y) × Rz(z)`로 합성합니다.

손을 떼면 한 번 커밋되고, 취소하면 미리보기가 되돌아갑니다. 실행 취소/다시 실행과 문서 다시 로드는 같은 포즈를 복원합니다. 돌출을 끄거나 동반 메시를 바꾸면 제스처가 중단되고, 낡은 동반 메시를 다시 만드는 대신 현재 문서를 복원합니다.

`extrude3d: true`는 여전히 깊이 100을 뜻하고, 숫자는 여전히 깊이를 지정합니다. 객체 값의 기본은 깊이 100, 높이 오프셋 0, 회전 `[0, 0, 0]`입니다. 갱신은 옵션 값 전체를 바꿉니다. 생략한 필드는 그 기본값으로 돌아갑니다. 스케일 핸들은 아직 없습니다. 크기를 바꾸려면 사각형 치수와 `depth`를 사용하세요. Rect 돌출은 로컬 모서리를 회전과 스케일을 따라 보냅니다. 둥근 모서리, 반사, 변환된 부모에서 온 전단은 메시에 구워지므로, 바닥면이 편집 가능한 2D 소스와 정렬된 채로 남습니다. 특이 부모 변환으로는 새 메시를 만들 수 없습니다.

### 닫힌 Path 돌출 {#extrude-path}

단색 채우기가 하나인 닫힌 Path도 같은 `extrude3d` 옵션을 쓸 수 있습니다. 앞면과 뒷면은 구멍을 포함한 채움 윤곽을 따릅니다. `d`나 `fillRule`을 편집하면 메시가 다시 만들어집니다. 이동은 그 메시를 재사용합니다. 변환된 부모에서 온 전단은 메시에 구워지므로, 그 선형 변환이 바뀌면 메시가 다시 만들어집니다.

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

모든 서브패스는 닫혀 있어야 합니다. 열린 패스, 스트로크 레이어, 여러 개이거나 단색이 아닌 채우기, 비다양체 윤곽, 특이 변환은 2D로 계속 보입니다. Path는 원래 문서 노드를 유지하며, 기즈모 편집, 실행 취소, 다시 로드를 지원합니다.

### 아이콘을 3D로 바꾸기 {#icon-to-3d}

<IconExtrusion />

App에서 Icon을 선택하고 **3D → 아이콘을 3D로 변환**을 엽니다. 깊이와 재질 프리셋(무광, 유광, 메탈)을 고릅니다. 변환은 캡과 조인을 포함한 SVG 스트로크를 닫힌 윤곽으로 펼칩니다. 채운 부분과 구멍은 한 그룹 안의 편집 가능한 Path가 됩니다. 그룹을 선택하면 모든 부분의 깊이나 재질을 바꾸고, Path를 선택하면 윤곽이나 베벨을 편집합니다. 실행 취소는 IconFont를 복원합니다. 변환 결과는 그 시점의 아이콘 기하 스냅샷입니다.

`registerIconifyIconSet`으로 아이콘 세트를 등록한 뒤, 코드에서도 같은 변환을 쓸 수 있습니다.

```ts
const result = iconFontToExtrudedPaths(iconNode, {
    depth: 40,
    bevelSize: 2,
    metallic: 1,
    roughness: 0.25,
});
if (result) api.updateNodes([result.group, ...result.paths]);
```

`metallic`과 `roughness`는 0에서 1 사이의 PBR 매개변수입니다. 이 프리셋은 기존 조명 파이프라인을 사용합니다. 투명 유리와 굴절은 아직 지원하지 않습니다. SVG 필터, 그라디언트, 지원하지 않는 페인트는 돌출 전에 윤곽을 손으로 정리해야 할 수 있습니다.

`sideColor`는 옆면용 선택적 CSS 색입니다. 앞면과 뒷면은 소스 채우기를 유지합니다. 생략하면 모든 면이 소스 채우기 색을 사용합니다. 옆면 색은 페인트 변경이므로, 편집해도 기존 메시 기하를 재사용합니다.

SVG `<path>`, `<polygon>`, `<rect>`, `<circle>`, `<ellipse>` 요소와 닫힌 `<polyline>` 요소는 `svgElementsToExtrudedNodes`로 채움 돌출 소스로 가져올 수 있습니다. 이 도우미는 그 밖의 가져온 도형을 2D로 유지합니다. 유효하지 않은 깊이는 기본값으로 조용히 바꾸지 않고 거부합니다.

```ts
import { svgElementsToExtrudedNodes } from '@infinite-canvas-tutorial/ecs';

const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
const nodes = svgElementsToExtrudedNodes(
    svg.documentElement as unknown as SVGSVGElement,
    40,
);
api.updateNodes(nodes);
```

온라인 App에서 사각형이나 Path를 선택하면 위쪽 도구 막대에 **3D** 컨트롤이 열립니다. 돌출을 켠 다음 깊이와 베벨을 편집합니다. 프로젝트 메뉴의 **SVG를 3D로 가져오기**는 보이는 그림이 SVG 뷰포트의 일부만 차지해도 그 그림을 캔버스 중앙에 놓고, 지원하지 않는 레이어는 2D로 남깁니다. **내보내기 → GLB (3D)** 로 프로젝트에서 준비된 돌출 메시를 모두 다운로드합니다. App에서는 베벨 프로파일(1–8 세그먼트)과 선택적인 16진수 옆면 색도 지정할 수 있습니다. 옆면 색을 비워 두면 도형의 채우기를 사용합니다. 메시를 만들 수 없는 Path에서는 App이 돌출 동작을 끄고, 닫힌 윤곽, 채우기, 스트로크 조건을 보여 줍니다.

**가져오기 지원 범위:** 단색으로 채운 닫힌 윤곽과 지원되는 단색 스트로크는 편집 가능한 3D 도형으로 변환됩니다. 그라디언트, 패턴 등 돌출을 지원하지 않는 레이어는 2D로 유지됩니다. 지원되는 구멍, 그룹 변환, 로컬 참조와 클리핑은 보존됩니다. 외부 참조, 마스크와 필터는 3D로 변환되지 않습니다.

아래 데모에서 스트로크, 클리핑, 반복 참조 등을 살펴볼 수 있습니다. SVG 요소와 지원 조건은 [SVG 돌출 및 가져오기 지원 범위](/ko/guide/svg-extrusion-reference)를 참고하세요.

Path와 Rect 돌출의 양 끝에 베벨을 주려면 `extrude3d.bevelSize`(캔버스 단위)를 설정합니다. 데모에서는 이것을 **Bevel**로 노출합니다. 안쪽 오프셋이 채움 위상을 유지하면 구멍, 여러 섬, 오목한 모서리를 지원합니다. 윤곽이 충돌하거나 좁은 영역이 무너지면 도형은 날카로운 모서리를 유지합니다. 깊이나 크기를 바꾸면 소스는 편집 가능한 채로 동반 메시가 다시 만들어집니다. 해석된 채움 경계의 정점이 4096개를 넘는 도형도 메시 작업량을 제한하기 위해 날카롭게 유지됩니다.

`extrude3d.bevelSegments`를 `1`로 두면 직선 베벨입니다(기본값). `2`–`8`이면 둥근 사분원 프로파일입니다. 세그먼트가 많을수록 실루엣은 부드러워지고 메시 삼각형은 늘어납니다. 데모의 **Bevel profile** 컨트롤로 가져온 SVG 도형에서 직선 프로파일과 둥근 프로파일을 비교할 수 있습니다.

예제의 **Download GLB** 버튼은 생성된 3D 메시를 자체 포함 glTF 바이너리 파일로 내보냅니다. `api.exportGlb`로 준비된 돌출 도형을 모두 다운로드하거나, 노드를 넘겨 선택만 내보냅니다(선택된 그룹의 자식 포함).

```ts
await api.exportGlb();
const glb = await api.exportGlb({
    nodes: [api.getNodeById('extruded-vector')!],
    download: false,
}); // Uint8Array
```

내보내기는 캔버스의 Y가 아래인 좌표를 glTF의 Y가 위인 좌표로 바꾸고, 현재 3D 포즈, 단색 채우기, 선택적 옆면 색을 유지합니다. 준비된 동반 메시만 내보내며, 지원하지 않는 2D SVG 도형은 포함하지 않습니다. 베이스 컬러 텍스처는 PNG 또는 JPEG로 임베드됩니다(그 밖의 디코딩 가능한 형식은 PNG로 변환됩니다). 텍스처 URL은 CORS fetch를 허용해야 합니다. 동기식 `api.export({ format:
ExportFormat.GLB })`는 텍스처가 없는 내보내기에 여전히 사용할 수 있습니다.
더 낮은 수준의 메시 내보내기는 `exportMeshesToGlb(sources, await loadGlbImages(sources))`를 호출합니다.

**ViewBox + shear sample**로 변환된 윤곽과 evenodd 구멍을 살펴본 다음, 돌출을 끄고 2D 바닥면과 비교하세요. **Slice clipping sample**로 구멍, 분리된 두 조각, SVG 뷰포트에 잘린 곡선 가장자리를 보세요.

<SvgExtrusion />

## 조명 {#lighting}

아래 장면에서 환경광, 방향광, 점광과 스포트라이트를 비교해 보세요. 구의 메탈릭과 러프니스를 조절하고 환경 맵, 그림자와 움직이는 스포트라이트를 시험할 수 있습니다.

장면에는 직접 조명을 최대 8개 사용할 수 있고, 조건을 충족하는 조명 중 최대 2개가 그림자를 드리웁니다. 자체 발광에는 `material3d.emissiveFactor` / `emissiveStrength`, 비조명 재질에는 `material3d.unlit`, 투명 표현에는 `alphaMode`를 사용합니다.

매개변수와 제한은 [조명 참고 자료](/ko/guide/lighting-reference), API와 조작은 [조명 예제](/example/lighting)를 참고하세요.

<Lighting />

## glTF 모델 {#gltf}

선언적 `mesh3d` 기하로 외부 glTF/GLB를 불러옵니다 (`geometry: { type: 'gltf', url: '…' }`). Khronos **Duck** 샘플은 `/data/` 아래의 `.gltf` + `.bin` 쌍을 사용합니다. 메시는 중심에 맞추고 단위 바운드로 정규화한 뒤 `scale3d`로 스케일합니다.

glTF 베이스 컬러 계수는 선형 RGB를 쓰고, ECS는 재질 베이스 컬러를 sRGB로 저장합니다. 가져오기는 둘 사이를 변환하고, GLB 내보내기는 다시 선형 RGB로 바꾸므로 재질 색이 왕복 후에도 안정적으로 남습니다.

임포터는 glTF `doubleSided`, `normalTexture`, `occlusionTexture`, 저작된 `TANGENT` 속성도 보존합니다. 노멀 맵은 조명 노멀을 바꾸고, 오클루전은 간접광에만 영향을 줍니다. [인터랙티브 PBR 모델](/example/gltf-duck#pbr-material)은 노멀 매핑이 저작된 접선을 언제 쓰고, UV에서 언제 유도하는지를 설명합니다.

glTF `COLOR_0` 정점 색(float, 또는 정규화된 부호 없는 byte/short, RGB 또는 RGBA)은 선형 공간에서 재질 베이스 컬러에 곱해집니다. [인터랙티브 정점 색 모델](/example/gltf-duck#vertex-colors)은 씬 조명이 있을 때와 없을 때의 결과를 보여 줍니다. 내보내기는 색을 float RGBA로 보존합니다.

임포터는 삼각형 리스트, 삼각형 스트립(`mode: 5`), 삼각형 팬(`mode: 6`)을 인덱스가 있든 없든 받습니다. 렌더링과 GLB 내보내기를 위해 삼각형 리스트로 변환합니다. 미러된 노드 변환은 삼각형 와인딩도 고쳐, 단면 표면이 계속 보이게 합니다.

희소 glTF accessor는 위치, 노멀, UV, 색, 접선, 삼각형 인덱스를 지원합니다. 베이스 데이터가 없으면 0에서 시작하고, 희소 값은 나열된 요소만 바꿉니다. 가져온 메시는 일반적인 밀집 GLB 버퍼로 내보내집니다.

<GltfDuck />

## 더 읽어보기 {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html) (플러그인 계층 참고)

[Lesson 30 - Post-processing and render graph]: /ko/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
