# CLI 与 WebMCP 实施计划

2026-10-27 调研。目标是让同一份 `.ic` 设计既能在本地构建流程中处理，也能在已打开的编辑器里由浏览器代理操作。两条入口复用文档校验和代码生成语义，但保留各自的运行时边界。

## 当前基础与缺口

-   `.ic` 的 `parseIcDocumentJson` 已校验版本、节点类型、父子关系等；`serializedNodesToCode` 已支持 HTML/CSS 与 React/Tailwind，设计变量可从文档传入。编辑器操作统一走 `api.edit()`。
-   直接在 Node 中加载构建后的 ECS 入口会报 `Cannot read properties of undefined (reading 'ref')`，栈顶位于 `components/camera/Camera.js`。目前 `.ic` 格式模块和代码生成模块仍通过运行时导入链触达 ECS 组件，不能据此宣称它们已经适合 CLI 使用。
-   应用已有登录态、项目接口与画布 API；现有聊天工具并未提供通用的画布读写工具注册层。文档中课程 38 的“命令行”小节为空，课程 28 的 MCP 仍标为 WIP。
-   [Chrome WebMCP 文档](https://developer.chrome.com/docs/ai/webmcp/)将 WebMCP 定位为浏览器内代理调用当前网页工具的接口。Chrome 149 起提供 origin trial，本地开发可用实验性开关。首版应使用 imperative API 的 `document.modelContext.registerTool()` 并检测能力；它不等同于供桌面客户端连接的独立 MCP server。

## 阶段 0：抽出 Node 可用的文档与转译入口

将 `.ic` 解析、校验及代码生成所需的纯函数从 ECS 运行时导入链中隔离，提供稳定的 Node 入口。保留浏览器端现有 API 调用方式，不复制一份校验或转译实现。导出的类型与错误信息应与编辑器一致。

验收：在 Node 20+ 的干净进程中加载新入口，解析真实 `.ic` 文件并生成 HTML 与 TSX；无需 `window`、`document`、WebGL 或画布 polyfill。同一文档在编辑器与 Node 中生成的代码相同。

## 阶段 1：离线 CLI

新增可发布的 `@infinite-canvas-tutorial/cli` 包，提供 `ic` 命令：

```sh
ic validate design.ic
ic inspect design.ic --json
ic codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
ic codegen design.ic --framework html-css --output design.html
```

`validate` 使用现有 `.ic` 校验语义；`inspect` 返回节点数、根节点、复用组件、变量和资源引用的摘要；`codegen` 使用文档的 `elements` 与 `variables`。输出到 stdout 或指定文件，失败给出非零退出码和可定位的错误。第一版默认不联网，不启动渲染器；遇到无法跨进程使用的 `blob:` 资源时明确报错。截图和图片导出另开浏览器驱动阶段。

验收：子进程测试覆盖有效与损坏的 `.ic`、两种框架、变量模式、输出文件和退出码；同一输入连续生成的字节一致。补齐中英文课程 38 的命令行说明及最小示例。

## 阶段 2：编辑器中的 WebMCP

在应用的画布 API 就绪且当前项目可用时注册工具；组件卸载、项目切换或 API 失效时注销。未提供 `document.modelContext` 的浏览器照常运行编辑器。首批工具建议：

| 工具                 | 作用                                                   | 写入 |
| -------------------- | ------------------------------------------------------ | ---- |
| `get_canvas_summary` | 返回当前项目、节点数量与根节点摘要                     | 否   |
| `get_selection`      | 返回选中节点的 ID、类型与有限属性                      | 否   |
| `get_nodes`          | 按 ID 读取少量节点，限制返回数量和长度                 | 否   |
| `export_canvas_code` | 按指定框架导出当前设计代码                             | 否   |
| `create_shape`       | 通过 `api.edit()` 新建支持的图形                       | 是   |
| `update_node`        | 校验 ID 和允许修改的属性后，通过 `api.edit()` 更新节点 | 是   |

工具参数使用明确的 JSON Schema 并在执行前再次校验。读操作限制输出体积；写操作保留编辑器的撤销和协作通知，不直接写数据库或绕过画布 API。按当前项目作用域读取节点，默认只暴露给同源上下文，不设置跨域 `exposedTo`。为工具标注 `readOnlyHint` 等 WebMCP 元数据；画布文本及外部资源按不可信内容处理。应用自身仍负责登录与项目权限，工具不得返回凭据。

验收：在开启 WebMCP 的 Chrome 中发现工具，读取选区、创建与修改节点，验证画布变化、撤销和项目切换后的注销；在无 WebMCP API 的浏览器中验证无报错和无功能回退。依照[官方安全指引](https://developer.chrome.com/docs/ai/webmcp/secure-tools)检查工具描述、输出与跨域暴露。补充课程 28 的实例和支持条件。

## 后续边界

CLI 的文件处理与 WebMCP 的实时编辑共享 `.ic` 模型和转译代码；浏览器工具的执行层仍应依赖当前画布 API。若要让未打开网页的桌面代理直接连接，需要独立的 stdio/HTTP MCP server 与项目授权设计，不能把 WebMCP 当作该服务。大批量文档变更、远程项目同步及浏览器截图在上述两阶段验收后再排期。
