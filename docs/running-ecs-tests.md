# 运行 ECS 单元测试（Jest）环境说明

本文说明在本地运行 `pnpm test:ecs` 时，可能遇到的 **原生模块** 安装问题及处理方式。相关依赖定义在仓库根目录 `package.json`：

| 包       | 类型                   | 用途                                                                           |
| -------- | ---------------------- | ------------------------------------------------------------------------------ |
| `canvas` | `devDependencies`      | Jest 在 Node 中模拟 `OffscreenCanvas`（见 `__tests__/jest-pretext-canvas.js`） |
| `gl`     | `optionalDependencies` | Headless WebGL，用于 WebGL 快照对比（见 `__tests__/utils.ts`）                 |

## 运行命令

```bash
# 推荐：使用 Node 20 LTS（见下文「Node 版本」）
nvm use 20

pnpm install
pnpm test:ecs
```

等价命令：`pnpm cov`（带 coverage）。

单文件示例：

```bash
pnpm exec jest -c ./jest.ecs.config.js __tests__/ecs/group.spec.ts
```

## Node 版本

| Node 版本    | `canvas@3.1`                   | `gl@6.0.2`                                                                               |
| ------------ | ------------------------------ | ---------------------------------------------------------------------------------------- |
| **20.x LTS** | 通常有预编译包，或可从源码编译 | **推荐**：可从源码编译；预编译包覆盖较好                                                 |
| **24.x**     | 一般有预编译包                 | **不推荐**：无对应预编译包，源码编译常因 Node 24 头文件（C++20）与旧版 `gl` 不兼容而失败 |

`webgl.node` / `canvas.node` 与 **Node ABI 绑定**：在哪个 Node 版本下编译，就要用同一主版本运行 Jest。在 Node 20 下编译后，请用 Node 20 跑测试。

建议在仓库根目录使用 `.nvmrc`（若已添加）或手动：

```bash
nvm use 20
```

## 系统依赖（macOS）

从源码编译时，通常需要：

1. **Xcode Command Line Tools**

    ```bash
    xcode-select --install
    ```

2. **`python` 命令**（`gl` 编译 ANGLE 时会调用 `python`，不能只有 `python3` 且 PATH 里无 `python`）

    任选其一：

    - Homebrew：`brew install python`
    - 临时 shim（仓库内，不污染系统）：

        ```bash
        mkdir -p .local-bin
        printf '%s\n' '#!/bin/sh' 'exec /usr/bin/python3 "$@"' > .local-bin/python
        chmod +x .local-bin/python
        export PATH="$(pwd)/.local-bin:$PATH"
        ```

3. **`canvas` 可选系统库**（仅当 `canvas` 预编译失败、需本地编译时）

    ```bash
    brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
    ```

## 安装 / 重建原生模块

`pnpm install` 若跳过 lifecycle scripts（例如 `--ignore-scripts`），不会生成 `.node` 文件，测试会在 `require('canvas')` 或 `require('gl')` 阶段失败。

在 **Node 20** 且 PATH 中可用 `python` 的前提下：

### 1. `canvas`（`canvas.node`）

```bash
pnpm rebuild canvas
```

若仍报错 `Cannot find module '../build/Release/canvas.node'`，进入包目录执行安装脚本：

```bash
cd node_modules/.pnpm/canvas@3.1.0/node_modules/canvas
npm run install
cd -
```

或（会按当前 Node 从源码编译）：

```bash
npm install canvas --build-from-source
```

### 2. `gl`（`webgl.node`）

```bash
pnpm rebuild gl
```

若失败，进入包目录：

```bash
cd node_modules/.pnpm/gl@6.0.2/node_modules/gl
npm run install
cd -
```

编译耗时较长（ANGLE + node-gyp），属正常现象。

### 验证

```bash
node -e "require('canvas'); console.log('canvas ok')"
node -e "require('gl'); console.log('gl ok')"
```

两条均输出 `ok` 后再跑 `pnpm test:ecs`。

## 常见报错对照

### `Cannot find module '../build/Release/canvas.node'`

-   **原因**：`canvas` 原生扩展未安装/未编译。
-   **处理**：见上文「canvas」重建；确认未使用 `--ignore-scripts` 安装依赖。

### `Could not locate the bindings file` … `webgl.node`

-   **原因**：`gl` 未编译，或编译所用 Node 版本与当前运行 Jest 的 Node 不一致。
-   **处理**：
    1. `nvm use 20`
    2. 配置 `python`（见「系统依赖」）
    3. 重建 `gl`（见上文）
    4. 用 **同一 Node 20** 执行 `pnpm test:ecs`

### `python: command not found` / `Failed to locate 'python'`

-   **原因**：`gl` 的 `node-gyp` / ANGLE 脚本需要 `python` 可执行文件。
-   **处理**：安装 Python 或使用 `.local-bin/python` shim（见「系统依赖」）。

### `unknown type name 'concept'`（编译 `gl` 时）

-   **原因**：在 **Node 24+** 下编译 `gl@6.0.2`，与 Node 原生头文件不兼容。
-   **处理**：改用 **Node 20** 后重新 `npm run install`（在 `gl` 包目录或 `pnpm rebuild gl`）。

### `The module '.../webgl.node' was compiled against a different Node.js version`

-   **原因**：切换了 Node 主版本，未重新编译。
-   **处理**：在当前用于跑测试的 Node 版本下重新执行 `gl` / `canvas` 的安装脚本。

## 与业务代码的关系

上述问题仅影响 **本地 Jest ECS 测试**（Node + headless 环境），不影响：

-   浏览器中的 `packages/webcomponents` 开发示例
-   Vello WASM 构建（`pnpm run build:vello`）

若只开发前端示例、不跑 `test:ecs`，可不安装 `gl`；但 `canvas` 仍会被 Jest setup 文件加载，一般仍需可用的 `canvas` 原生模块。

## 相关文件

| 路径                               | 说明                                           |
| ---------------------------------- | ---------------------------------------------- |
| `jest.ecs.config.js`               | ECS 测试 Jest 配置                             |
| `__tests__/jest-pretext-canvas.js` | Node 下注入 `OffscreenCanvas`（依赖 `canvas`） |
| `__tests__/utils.ts`               | 测试工具，依赖 `gl` + `canvas`                 |
| `package.json`                     | `test:ecs` / `cov` 脚本与依赖声明              |
