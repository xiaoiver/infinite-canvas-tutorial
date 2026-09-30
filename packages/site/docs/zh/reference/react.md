---
outline: deep
---

# React

`@infinite-canvas-tutorial/react` 提供 React 18/19 的便利封装。第一版复用
Spectrum Web Component，负责画布生命周期、类型化回调和 API 获取。

```sh
npm install @infinite-canvas-tutorial/react
```

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
                    { id: 'rect', type: 'rect', x: 50, y: 50, width: 100, height: 80, fill: '#ff8400' },
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

## 初始化与 API

- `initialNodes` 在每次创建画布时复制一次，在异步 `onReady` 完成后写入 ECS。
  后续改变该属性不会覆盖用户编辑；更新图形请使用 `api.updateNodes()`。
- `initialAppState` 是初始化状态；后续通过 `api.setAppState()` 修改。
- `ref.current.api` 和 `ref.current.element` 是实时 getter，初始化前为 `null`。
  后者指向真正的 Web Component，可监听额外 DOM 事件。
- `onAPIChange(api)` 发布可用 API，卸载时传入 `null`。
- `theme` 同步 Spectrum UI 与画布主题。`locale` 使用 Lit 的全局本地化状态，
  同一页面上的画布共享语言。
- 改变 `renderer`、`shaderCompilerPath` 或 `initializationTimeout` 会重建画布。

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

上传、持久化和协作由宿主应用实现。Provider 和 selector hooks 将作为后续扩展。
