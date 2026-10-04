---
outline: deep
---

<script setup>
import ReactCanvasExample from '../../components/ReactCanvasExample.vue';
</script>

# React

`@infinite-canvas-tutorial/react` 提供 React 18/19 的便利封装。封装复用
Spectrum Web Component，负责画布生命周期、类型化回调、API 获取与状态订阅。

```sh
npm install @infinite-canvas-tutorial/react
```

::: info 首次发布
React 封装正在仓库中完善，尚未发布到 npm。交互示例使用仓库构建产物。
:::

```tsx
'use client';

import { useRef } from 'react';
import {
    InfiniteCanvas,
    type InfiniteCanvasHandle,
} from '@infinite-canvas-tutorial/react/spectrum';

export function Editor() {
    const canvas = useRef<InfiniteCanvasHandle>(null);

    return (
        <>
            <button onClick={() => canvas.current?.api?.undo()}>撤销</button>
            <InfiniteCanvas
                ref={canvas}
                style={{ width: '100%', height: 600 }}
                initialNodes={[
                    {
                        id: 'rect',
                        zIndex: 0,
                        type: 'rect',
                        x: 50,
                        y: 50,
                        width: 100,
                        height: 80,
                        fills: [{ type: 'solid', value: '#ff8400' }],
                    },
                ]}
                onNodesChange={(nodes) => console.log(nodes)}
                fallback={<span>正在加载画布…</span>}
            />
        </>
    );
}
```

请为容器设置明确高度。浏览器依赖和自定义元素在客户端挂载时才加载，适用于
Next.js Client Component。默认入口和 `/spectrum` 目前导出同一个组件。

## 可交互示例

试试添加矩形、修改颜色、增加选中图形的宽度、删除图形，以及撤销和重做。
“恢复示例文档”会替换当前画布的整份文档，该操作也可以撤销。拖动图形可观察选区和宽度变化。
画布 A 和 B 分别使用独立的 Provider，并共享同一个 runtime；编辑其中一个，
另一个的历史和缩放不会改变。

<ReactCanvasExample locale="zh" />

取消勾选“显示第二个画布”，可以体验卸载一个画布后继续操作另一个。
**重置示例**会重新创建画布，并清空编辑和历史记录。示例放在独立的 iframe 中，
可与文档站其他画布示例共存。点击“本地保存”可在此浏览器保留文档，
点击“导出 .ic”可下载文件。“重置示例”保留存档，点击“加载存档”即可恢复。
每个画布使用独立的存储键。

<a href="/zh/example/react-playground" target="_blank" rel="noopener">在独立页面打开示例</a>。

## Provider 与 selector hooks

每个画布使用一个 `CanvasProvider`，让旁边的工具栏和 slot children 共享 API。
`InfiniteCanvas` 会自动连接最近的 Provider；只使用 ref 或回调时可以省略 Provider。

```tsx
'use client';

import {
    CanvasProvider,
    InfiniteCanvas,
    useCanvasAPI,
    useCanvasSelector,
} from '@infinite-canvas-tutorial/react';

function Toolbar() {
    const api = useCanvasAPI();
    const canUndo = useCanvasSelector((state) => state.canUndo);
    const zoom = useCanvasSelector((state) => state.appState?.cameraZoom ?? 1);
    return (
        <div>
            <button disabled={!canUndo} onClick={() => api?.undo()}>
                撤销
            </button>
            <span>{Math.round(zoom * 100)}%</span>
        </div>
    );
}

export function Editor() {
    return (
        <CanvasProvider>
            <InfiniteCanvas style={{ height: 600 }} />
            <Toolbar />
        </CanvasProvider>
    );
}
```

`useCanvasAPI()` 在 SSR、就绪前、卸载或失败后返回 `null`，只在 API 改变时触发更新。
所有画布 hooks 都必须在 Provider 内使用。同一个 Provider 同时挂载两个画布会报错；
多画布请分别包裹 Provider，并共享同一个 runtime。

`useCanvasSelector(selector, isEqual?)` 从 `CanvasState` 中选择 `api`、`appState`、
`nodes`、`canUndo`、`canRedo`、`status` 或 `error`。服务端和未就绪状态的 `api`、`appState` 为 `null`，
节点数组为空，两个历史标记为 `false`。selector 应保持纯函数，并把状态当作只读数据。
默认用 `Object.is` 比较选中值，仅在选中值变化时由订阅触发渲染；返回新创建的对象或数组时
可以传入比较函数：

```tsx
const history = useCanvasSelector(
    (state) => ({ undo: state.canUndo, redo: state.canRedo }),
    (a, b) => a.undo === b.undo && a.redo === b.redo,
);
```

`nodes` 由 store 持有副本，与 API 中可变的文档数据隔离。
提交时未变更的节点保持原引用；节点内容与顺序都不变时，数组引用也保持稳定。
直接返回其中的节点无需自定义比较函数：

```tsx
const rect = useCanvasSelector((state) =>
    state.nodes.find((node) => node.id === 'rect'),
);
```

节点与应用状态在 API 提交（`api.record()`）时更新；相机和选区事件也会立即刷新应用状态。
初始化场景和 `api.record('NEVER')` 同样会通知订阅者，但不增加撤销记录。
`initialNodes` 在准备完成后更新 selectors 和节点回调，无需额外调用 `record()`。
编辑、撤销、重做和 `clearHistory()` 都会通知历史可用状态，无需轮询。
直接修改节点后，使用 `api.edit()` 或 `api.record()` 发布文档变更；
相机和选区事件仅刷新应用状态。
API 可用表示 GPU 已就绪，此时异步 `onReady` 可能还未完成。

## 初始化状态

`useCanvasStatus()` 从当前 Provider 返回 `{ status, error }`，两个包入口都提供。
SSR、没有挂载画布或 API 已销毁时为 `idle`；运行时/GPU 初始化、异步 `onReady`
或初始场景提交期间为 `loading`；全部完成后为 `ready`；生命周期失败时为 `error`。
`error` 是 `Error` 或 `null`。无关的文档、视图或历史变化不会改变返回对象的引用。

```tsx
const { status, error } = useCanvasStatus();
const ready = status === 'ready';
```

编辑、保存和导入按钮可用 `ready` 控制是否启用。`useCanvasAPI()` 仍会在 GPU 就绪时
提供 API，供 `onReady` 准备场景；API 非空不代表初始场景已准备完成。
启动失败会清除 API，并保留错误直到移除或重建画布；后续语言更新失败会报告错误，
但保留仍可用的 API。每个 Provider 的状态相互独立，旧画布的异步结果不会改变新画布的状态。

## 节点、选区和历史 hooks

以下 hooks 需要 `CanvasProvider`，两个包入口都提供：

| Hook                   | 返回值                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `useCanvasNode(id?)`   | 节点的只读副本；ID 不存在或已删除时为 `null`。可传入 `null` 或 `undefined` 表示没有选中节点。 |
| `useCanvasSelection()` | 按选区顺序返回节点的只读副本，忽略不存在或已删除的 ID。                                       |
| `useCanvasHistory()`   | `{ canUndo, canRedo }`；历史操作使用 `useCanvasActions()`。                                   |

SSR、就绪前和卸载后，分别返回 `null`、`[]` 和两个标记均为 `false` 的历史状态。
选中内容不变时保持引用稳定，相机或其他节点更新不会触发无关渲染。
这些 hooks 共享 store 中的节点副本，每次提交只复制变更节点一次，无需为每个使用方重复复制。
副本还能检测提交后的原地 `api.updateNode()` 修改；请把副本及嵌套数据视为只读，
通过 actions 或 API 编辑画布。
只需要单个标量值时，可以继续使用 `useCanvasSelector`。

```tsx
import {
    useCanvasActions,
    useCanvasHistory,
    useCanvasNode,
    useCanvasSelection,
} from '@infinite-canvas-tutorial/react';

function Properties({ onError }: { onError: (error: unknown) => void }) {
    const actions = useCanvasActions();
    const selected = useCanvasSelection();
    const node = useCanvasNode(selected[0]?.id);
    const { canUndo } = useCanvasHistory();
    return (
        <div>
            <output>{node?.width ?? '请选择图形'}</output>
            <button disabled={!canUndo} onClick={actions.undo}>
                撤销
            </button>
            <button
                disabled={selected.length === 0}
                onClick={() => {
                    void actions
                        .deleteNodes(selected.map((node) => node.id))
                        .catch(onError);
                }}
            >
                删除选中图形
            </button>
        </div>
    );
}
```

## 订阅画布事件

`useCanvasEvent(name, listener, options?)` 直接订阅当前 `CanvasProvider` 中画布元素的事件，
两个包入口都提供。事件名会推导回调类型，例如 `ic-point-drawn` 的 `detail.x/y` 是数值，
`ic-screenshot-downloaded` 提供 `detail.svg/dataURL`。也支持 `pointerdown` 等原生 DOM 事件。

```tsx
import { useState } from 'react';
import {
    useCanvasEvent,
    useCanvasStatus,
} from '@infinite-canvas-tutorial/react';

function Coordinates() {
    const { status } = useCanvasStatus();
    const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
    useCanvasEvent(
        'ic-point-drawn',
        ({ detail: { x, y } }) => {
            setPoint({ x, y });
        },
        { enabled: status === 'ready' },
    );
    return <output>{point ? `x: ${point.x}, y: ${point.y}` : ''}</output>;
}
```

通过 `actions.setAppState({ penbarSelected: Pen.DRAW_POINT }, { capture: 'NEVER' })`
启用取点工具，其中 `Pen` 来自 `@infinite-canvas-tutorial/ecs`。点击或轻触画布会返回考虑
相机缩放和位置后的画布坐标。上方交互示例的 **取点坐标** 按钮展示了这个流程，取点后自动回到选择工具。

hook 在 GPU-ready API 挂载后开始监听，并自动跟随画布重建。初始化使用 `onReady` 或
`useCanvasStatus()`；首次 `ic-ready` 发生时，这个订阅还没有安装。订阅组件卸载或 API 销毁时
会移除监听；已脱离 Provider 的旧画布也不会再把事件传给新画布的控件。

`options.enabled` 默认为 `true`，传 `false` 可暂停监听。其余选项是原生的 `capture`、
`passive`、`once` 和 `signal`。中止 signal 会移除监听，传入新的 signal 可重新订阅。
回调更新会使用最近提交的回调，不会重复绑定；选项值相同的新对象也会保留订阅，因而重渲染不会
重新启用已触发的 `once` 监听。事件名、选项值或画布变化时会创建新的订阅。

## 保存与导入文档

示例和两个框架 starter 提供“本地保存”“加载存档”“导出 .ic”和“导入 .ic”。
保存需手动触发，每个画布在此浏览器的 `localStorage` 中保留一份原生文档。
重置或刷新示例会保留存档，但不会自动加载；点击“加载存档”即可恢复。
存储按网站来源和浏览器隔离，可导出文件在其他位置打开。存储或文件操作失败时，
控件旁会显示错误。

这些操作由宿主应用实现。starter 中的 `document-controls.tsx` 展示了完整实现，
包括在画布移除时取消操作。浏览器 API 只在事件处理函数中访问，因此可以在
Next.js Client Component 的 SSR 阶段导入此模块。

原生 `.ic` 格式包含节点、设计变量、主题、选区，以及相机和 UI 状态。
`replaceDocument` 只替换节点。先通过排队的编辑读取最新文档，再在编辑回调外导入：

```tsx
// 事件处理函数中，api 和 actions 来自 useCanvasAPI() / useCanvasActions()。
await actions.edit(
    (api) => {
        localStorage.setItem(
            'my-canvas:v1',
            JSON.stringify(api.exportIcDocument()),
        );
    },
    { capture: 'NEVER' },
);

const raw = localStorage.getItem('my-canvas:v1');
if (api && raw !== null) {
    await api.importIcDocument(raw, { signal: controller.signal });
}
```

`api.importIcDocument` 接受原生文档对象或 JSON 字符串。在修改场景前校验格式、版本、
节点 ID 和类型、层级，以及选区和视图字段；排队前复制输入，在 Edit 阶段提交一次。
返回 `Promise<boolean>`：提交成功为 `true`，取消或画布销毁为 `false`。
无效输入在排队前抛错，执行失败使 Promise reject，事件处理函数需捕获这两类错误。
先用 `await file.text()` 读取文件，再调用导入；画布移除时取消尚未完成的读取和导入。

一次导入为节点、变量、选区和 filter 创建一个撤销条目。相机、主题及其他 UI 设置
沿用已有的不可撤销规则。传入 `{ recordHistory: false }` 可不增加撤销条目，
如需丢弃之前的历史，再单独调用 `clearHistory()`。保存和导出使用 `capture: 'NEVER'`。
任意运行时修改失败时，不会自动回滚已经完成的修改。

## 编辑操作 hooks

`useCanvasActions()` 返回最近 Provider 的稳定操作对象。仅使用这些操作的组件
不会订阅场景变化；画布重建后，保留的操作会使用当前画布。
渲染就绪状态或场景数据时，继续使用 `useCanvasSelector`。

```tsx
import {
    useCanvasActions,
    useCanvasStatus,
} from '@infinite-canvas-tutorial/react';

function EnlargeButton({ onError }: { onError: (error: unknown) => void }) {
    const actions = useCanvasActions();
    const { status } = useCanvasStatus();
    const ready = status === 'ready';
    const enlarge = () =>
        actions.updateNodes((nodes) =>
            nodes
                .filter((node) => node.type === 'rect')
                .map((node) => ({
                    ...node,
                    width: (node.width ?? 100) + 20,
                })),
        );
    return (
        <button
            disabled={!ready}
            onClick={() => {
                void enlarge().catch(onError);
            }}
        >
            放大矩形
        </button>
    );
}
```

| 操作                                        | 行为                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `updateNodes(nodesOrUpdater, options?)`     | 按 ID 新增或更新，保留未提供的节点。数组在排队前复制；函数式更新在执行时读取最新节点，请返回新数据，不修改输入。 |
| `deleteNodes(ids, options?)`                | 删除指定 ID 及其子节点，并清理被删除节点的选区；忽略不存在的 ID。                                                |
| `replaceDocument(nodesOrUpdater, options?)` | 替换整份文档，删除未提供的 ID；执行前校验完整层级。数组在排队前复制，函数式更新读取最新节点。默认可以撤销。      |
| `setAppState(patchOrUpdater, options?)`     | 按 API 语义合并状态；函数式更新读取执行时的最新状态。不参与历史记录的界面设置也会刷新 selectors。                |
| `selectNodes(ids, options?)`                | 执行时解析 ID，忽略不存在或已删除的节点。`preserveSelection: true` 保留原有选区，传入 `[]` 清空选区。            |
| `edit(callback, options?)`                  | 在派生数据计算和渲染之前执行同步修改，并在回调结束后调用一次 `record()`。                                        |
| `undo()`、`redo()`、`clearHistory()`        | 使用当前画布的历史记录；撤销/重做排队执行，清空历史立即执行。                                                    |

六项编辑操作返回 `Promise<boolean>`：提交成功后为 `true`，画布不可用或在执行前卸载时
为 `false`。执行失败会拒绝 Promise，请在调用组件中处理。
历史操作在 API 不可用时返回 `false`。操作的 API 可用时机与 `useCanvasAPI()`
一致，表示 GPU 就绪。

使用 `replaceDocument` 加载远程或已保存文档时，可以传入 `{ capture: 'NEVER' }`
以提交内容而不增加撤销记录；清空文档可传入 `[]`。需要清空已有历史时，另行调用
`clearHistory()`。它不会更改相机设置；`initialNodes` 的后续 prop 更新也不会替换文档。

每次编辑调用分别提交。需要把多步操作合并成一条撤销记录时，在事件处理函数中
使用 `edit`：

```tsx
await actions.edit((api) => {
    const node = api.getNodes().find((node) => node.type === 'rect');
    if (!node) return;
    api.updateNodes([{ ...node, width: (node.width ?? 100) + 20 }]);
    api.selectNodes([api.getNodeById(node.id)!]);
});
```

这些编辑操作委托给共用的 ECS `api.edit()` 接口。编辑与撤销、重做按调用顺序
在几何、变换、边界计算及渲染之前执行，这些系统会在同一帧看到修改。
在回调中同步调用的 `record()`
会合并到本次提交。网络请求等异步工作应在调用 `edit` 前完成，回调必须同步；
回调失败时不会自动回滚已执行的修改。
传入 `{ capture: 'NEVER' }` 可通知 selectors 而不增加撤销记录，默认值为
`'IMMEDIATELY'`。

传入 `{ signal: controller.signal }` 可取消待执行的编辑。取消、画布销毁或
Provider 更换所属画布时，Promise 会立即结算为 `false`，无需等待下一帧。
嵌套编辑及 `undo` / `redo` 仍是独立排队的操作；撤销、重做应在编辑回调之外调用。
Promise 成功表示编辑已提交，不等待画面渲染，也不等待图片、字体等异步资源。

## 初始化与 API

-   `initialNodes` 在每次创建画布时复制一次，在异步 `onReady` 完成后写入 ECS。
    写入通过 `api.edit()` 执行，使用 `capture: 'NEVER'`，不增加撤销记录。
    变换、边界计算和渲染在提交的同一帧看到初始场景；提交完成后移除加载占位内容。
    卸载或重建画布会取消尚未执行的初始化。后续改变该属性不会覆盖用户编辑；
    更新图形请使用 `api.updateNodes()`。
-   `initialAppState` 是初始化状态；后续通过 `api.setAppState()` 修改。
-   `ref.current.api` 和 `ref.current.element` 是实时 getter，初始化前为 `null`。
    后者指向真正的 Web Component，可监听额外 DOM 事件。
-   `onAPIChange(api)` 发布可用 API，卸载时传入 `null`。
-   `theme` 同步 Spectrum UI 与画布主题。`locale` 使用 Lit 的全局本地化状态，
    同一页面上的画布共享语言。
-   改变 `renderer`、`shaderCompilerPath` 或 `initializationTimeout` 会重建画布。

## 框架接入示例

[Vite 和 Next.js 最小示例](https://github.com/xiaoiver/infinite-canvas-tutorial/tree/master/examples)
包含 Provider、初始场景、响应式图形计数和撤销/重做工具栏。
Next.js 示例在 Server Component 页面中使用 Client Component 编辑器，支持 SSR 加载占位。
发布前的包验证会从真实 tarball 构建这些示例。

## 事件与加载状态

可以传入 `onChange`、`onNodesChange`、`onAppStateChange`、
`onSelectedNodesChange`、`onCameraZoomChange` 和 `onResize`。
这些回调具有 TypeScript 类型，更新回调不会重建画布。

`fallback` 用于加载提示，`renderError` 自定义错误显示。`onError` 报告运行时加载、
就绪超时、语言设置和异步准备错误。`initializationTimeout` 默认为 30000 毫秒，
设为 `0` 可关闭运行时与 GPU 就绪超时检查。

## 插件与多画布

在组件外创建一个共享运行时，然后传给所有同时挂载的画布：

```tsx
import {
    InfiniteCanvas,
    createCanvasRuntime,
} from '@infinite-canvas-tutorial/react';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';

const runtime = createCanvasRuntime({
    plugins: [LassoPlugin],
    loadUI: () => import('@infinite-canvas-tutorial/lasso/spectrum'),
});

export function Compare() {
    return (
        <>
            <InfiniteCanvas runtime={runtime} style={{ height: 400 }} />
            <InfiniteCanvas runtime={runtime} style={{ height: 400 }} />
        </>
    );
}
```

运行时自动包含 `DefaultPlugins` 和 `UIPlugin`。插件配置在启动时确定；修改插件前
需要卸载所有使用该运行时的画布。当前 Web Components 使用全局初始化队列，
因此同时使用不同运行时会报错。

每个画布拥有独立的 API 和订阅，最后一个画布卸载后才退出 App。
StrictMode 的立即挂载、清理、再次挂载会复用正在启动的 App。

React children 会放入 Web Component 的 light DOM，可使用已有的具名 slot。

## 异步准备

`onReady(api, { signal })` 可以返回 Promise。在每次 await 后检查取消信号，
避免卸载后继续操作 API：

```tsx
<InfiniteCanvas
    initialNodes={nodes}
    onReady={async (api, { signal }) => {
        const response = await fetch('/assets/config.json', { signal });
        const config = await response.json();
        if (signal.aborted) return;
        api.setAppState(config);
    }}
/>
```

上传、持久化和协作由宿主应用实现。
