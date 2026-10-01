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
                    { id: 'rect', zIndex: 0, type: 'rect', x: 50, y: 50, width: 100, height: 80, fills: [{ type: 'solid', value: '#ff8400' }] },
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

试试添加矩形、修改颜色、缩放，以及撤销和重做。拖动图形可观察选区变化。
画布 A 和 B 分别使用独立的 Provider，并共享同一个 runtime；编辑其中一个，
另一个的历史和缩放不会改变。

<ReactCanvasExample locale="zh" />

取消勾选“显示第二个画布”，可以体验卸载一个画布后继续操作另一个。
**重置示例**会重新创建画布，并清空编辑和历史记录。示例放在独立的 iframe 中，
可与文档站其他画布示例共存。这里的修改只在当前示例中有效，不会保存。

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
            <button disabled={!canUndo} onClick={() => api?.undo()}>撤销</button>
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
两个 hooks 都必须在 Provider 内使用。同一个 Provider 同时挂载两个画布会报错；
多画布请分别包裹 Provider，并共享同一个 runtime。

`useCanvasSelector(selector, isEqual?)` 从 `CanvasState` 中选择 `api`、`appState`、
`nodes`、`canUndo` 或 `canRedo`。服务端和未就绪状态的 `api`、`appState` 为 `null`，
节点数组为空，两个历史标记为 `false`。selector 应保持纯函数，并把状态当作只读数据。
默认用 `Object.is` 比较选中值，仅在选中值变化时由订阅触发渲染；返回对象或数组时
可以传入比较函数：

```tsx
const history = useCanvasSelector(
    (state) => ({ undo: state.canUndo, redo: state.canRedo }),
    (a, b) => a.undo === b.undo && a.redo === b.redo,
);
```

节点与应用状态在 API 提交（`api.record()`）时更新；相机和选区事件也会立即刷新应用状态。
初始化场景和 `api.record('NEVER')` 同样会通知订阅者，但不增加撤销记录。
`initialNodes` 在准备完成后更新 selectors 和节点回调，无需额外调用 `record()`。
编辑、撤销、重做和 `clearHistory()` 都会通知历史可用状态，无需轮询。
直接调用 API 而未提交的修改，在下一次提交或事件时才反映到 hooks。
API 可用表示 GPU 已就绪，此时异步 `onReady` 可能还未完成。

## 编辑操作 hooks

`useCanvasActions()` 返回最近 Provider 的稳定操作对象。仅使用这些操作的组件
不会订阅场景变化；画布重建后，保留的操作会使用当前画布。
渲染就绪状态或场景数据时，继续使用 `useCanvasSelector`。

```tsx
import { useCanvasActions, useCanvasSelector } from '@infinite-canvas-tutorial/react';

function EnlargeButton({ onError }: { onError: (error: unknown) => void }) {
    const actions = useCanvasActions();
    const ready = useCanvasSelector((state) => state.api !== null);
    const enlarge = () => actions.updateNodes((nodes) =>
        nodes.filter((node) => node.type === 'rect').map((node) => ({
            ...node,
            width: (node.width ?? 100) + 20,
        })),
    );
    return (
        <button disabled={!ready} onClick={() => { void enlarge().catch(onError); }}>
            放大矩形
        </button>
    );
}
```

| 操作 | 行为 |
| --- | --- |
| `updateNodes(nodesOrUpdater, options?)` | 按 ID 新增或更新，保留未提供的节点。数组在排队前复制；函数式更新在执行时读取最新节点，请返回新数据，不修改输入。 |
| `setAppState(patchOrUpdater, options?)` | 按 API 语义合并状态；函数式更新读取执行时的最新状态。不参与历史记录的界面设置也会刷新 selectors。 |
| `selectNodes(ids, options?)` | 执行时解析 ID，忽略不存在或已删除的节点。`preserveSelection: true` 保留原有选区，传入 `[]` 清空选区。 |
| `edit(callback, options?)` | 在 ECS 帧边界执行同步修改，并在回调结束后调用一次 `record()`。 |
| `undo()`、`redo()`、`clearHistory()` | 使用当前画布的历史记录；撤销/重做排队执行，清空历史立即执行。 |

前四项返回 `Promise<boolean>`：提交成功后为 `true`，画布不可用或在执行前卸载时
为 `false`。执行失败会拒绝 Promise，请在调用组件中处理。
历史操作在 API 不可用时返回 `false`。操作的 API 可用时机与 `useCanvasAPI()`
一致，表示 GPU 就绪。

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

网络请求等异步工作应在调用 `edit` 前完成。回调必须同步，并使用不自行提交历史
的 API 修改方法；回调失败时不会自动回滚已执行的修改。
传入 `{ capture: 'NEVER' }` 可通知 selectors 而不增加撤销记录，默认值为
`'IMMEDIATELY'`。

## 初始化与 API

- `initialNodes` 在每次创建画布时复制一次，在异步 `onReady` 完成后写入 ECS。
  初始化不增加撤销记录，后续改变该属性不会覆盖用户编辑；更新图形请使用 `api.updateNodes()`。
- `initialAppState` 是初始化状态；后续通过 `api.setAppState()` 修改。
- `ref.current.api` 和 `ref.current.element` 是实时 getter，初始化前为 `null`。
  后者指向真正的 Web Component，可监听额外 DOM 事件。
- `onAPIChange(api)` 发布可用 API，卸载时传入 `null`。
- `theme` 同步 Spectrum UI 与画布主题。`locale` 使用 Lit 的全局本地化状态，
  同一页面上的画布共享语言。
- 改变 `renderer`、`shaderCompilerPath` 或 `initializationTimeout` 会重建画布。

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
import { InfiniteCanvas, createCanvasRuntime } from '@infinite-canvas-tutorial/react';
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
