---
outline: deep
description: 'CSS-like filter strings on shapes, raster post-effects, and 3D LUT (.cube) registration.'
---

# Filter

Serialized node types that include `FilterAttributes` — today `rect`, `ellipse`, `path`, `iconfont`, and property overrides on `ref` — accept a `filter` string, similar in spirit to the [CSS `filter`][mdn-filter] property. The engine parses the string into an internal effect list, rasterizes the shape’s bounds when needed, and runs GPU post-processing passes.

For the rendering pipeline and render-graph context, see [Lesson 30 - Post-processing and render graph](/guide/lesson-030).

[mdn-filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/filter

## `filter` on nodes {#filter-on-nodes}

Set `filter` on serialized nodes the same way you set fill or stroke. Multiple functions can appear in one string, separated by whitespace. Order matches application order.

Examples:

```ts
api.updateNodes([
    {
        ...node,
        filter: 'blur(4px) brightness(-0.1)',
    },
]);
```

Anything not covered in the subsections below is ignored by `parseEffect` (no matching branch). Source of truth: `parseEffect` / `formatFilter` in `@infinite-canvas-tutorial/ecs` (`utils/filter.ts`).

## Supported filter functions {#supported-filters}

Each `###` heading is one **function name** in the `filter` string. **Internal type** is `Effect['type']` where it differs. Unless noted, comma-separated lists use `parts[i]` after splitting on commas and trimming (see each branch in `filter.ts`).

**`formatFilter` round-trip:** only implemented cases are written back. Saturate-only `adjustment` → `saturate(…)`; other `adjustment` fields are **dropped**.

### `blur` {#blur}

| Field         | Parsed from                                                      | Default / clamp                                                            |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Internal type | —                                                                | `blur`                                                                     |
| `value`       | `parseFloat` on the whole parenthesis content (e.g. `4px` → `4`) | `NaN` → effectively `NaN` until GPU path clamps; prefer finite `px` values |

**Example:** `blur(6px)`

### `brightness` {#brightness}

| Field         | Parsed from                                            | Default / clamp                                                                                                             |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Internal type | —                                                      | `brightness`                                                                                                                |
| `value`       | `parseFloat(params.trim())` then `clampGlfxBrightness` | Clamped to **`[-1, 1]`**; `0` = no change. **Not** CSS `brightness()` multiplier (see comment above `clampGlfxBrightness`). |

**Example:** `brightness(-0.15)`

### `contrast` {#contrast}

| Field         | Parsed from                                          | Default / clamp                                                                                                             |
| ------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Internal type | —                                                    | `contrast`                                                                                                                  |
| `value`       | `parseFloat(params.trim())` then `clampGlfxContrast` | Same base clamp as brightness, then positive branch capped at **`0.999`** to avoid `(1 - contrast) → 0` in the shader path. |

**Example:** `contrast(0.2)`

### `saturate` {#saturate}

| Field         | Parsed from                    | Default / clamp                                                                                                                                                                            |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Internal type | —                              | `adjustment` (merged with `ADJUSTMENT_DEFAULTS`)                                                                                                                                           |
| `saturation`  | `parseCssFilterScalar(params)` | If the token ends with `%`, value is `parseFloat / 100`; otherwise `parseFloat` as-is. Other adjustment channels stay at defaults (`gamma`, `contrast`, `brightness`, RGB, `alpha` = `1`). |

**Example:** `saturate(1.2)` or `saturate(50%)` → `0.5` saturation field.

### `hue-rotate` {#hue-rotate}

| Field         | Parsed from                                       | Default / clamp                                                                                                                                           |
| ------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal type | —                                                 | `hueSaturation`                                                                                                                                           |
| `hue`         | `degreesToGlfxHue(parseHueRotateDegrees(params))` | `parseHueRotateDegrees`: supports `deg` / `rad` / `turn` / `grad` substrings, else treated as **degrees**. Mapped to glfx hue **`[-1, 1]`** (±1 ≈ ±180°). |
| `saturation`  | —                                                 | Always **`0`** for this token alone (saturation comes from a separate `saturate()` token).                                                                |

**Example:** `hue-rotate(90deg)`

### `drop-shadow` {#drop-shadow}

Whitespace-split tokens; leading numeric tokens are `parseFloat` (so `5px` works); remainder is joined as **`color`** (default `black` if empty).

| Field                      | Source                                        | Notes                                        |
| -------------------------- | --------------------------------------------- | -------------------------------------------- |
| `x`, `y`, `blur`, `spread` | 1st–4th numeric tokens                        | Missing trailing numbers default to **`0`**. |
| `color`                    | All tokens after the last leading numeric run | Can be multi-word (`rgb(...)`, etc.).        |

**Examples:** `drop-shadow(2px 4px 6px red)` — spread `0`. `drop-shadow(1px 1px 2px 3px rgba(0,0,0,.4))`

### `noise` {#noise}

| Field         | Parsed from                 | Notes         |
| ------------- | --------------------------- | ------------- |
| Internal type | `noise`                     |               |
| `value`       | `parseFloat` on full params | Single scalar |

### `pixelate` {#pixelate}

| Field         | Parsed from           | Notes                                                                                      |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Internal type | `pixelate`            |                                                                                            |
| `size`        | `parsePixelBlockSize` | Strips `px` (case-insensitive), `parseFloat`; if non-finite or `≤ 0`, defaults to **`1`**. |

**Example:** `pixelate(12px)`

### `dot` {#dot}

Comma-separated; each part `trim`med. Missing entries use parser defaults via `parseFloat` / `> 0.5` for the grayscale flag.

| Index | Property          | Default (from Pixi-style defaults in parser) |
| ----- | ----------------- | -------------------------------------------- |
| `0`   | `scale`           | `1`                                          |
| `1`   | `angle` (radians) | `5`                                          |
| `2`   | `grayscale`       | `1` if parsed `> 0.5` else `0`               |

**Example:** `dot(1, 5, 1)`

### `color-halftone` {#color-halftone}

| Branch               | Arguments → fields                                                                      |
| -------------------- | --------------------------------------------------------------------------------------- |
| **4+ numeric parts** | `(centerX, centerY, angle, size)` → all set; `size` must be `> 0` or replaced with `4`. |
| **2 parts**          | `(size, angle)` — no center (shader uses texture center at upload).                     |
| **1 part**           | `(size)` — `angle` defaults to `0`.                                                     |

`angle` is in **radians** on the effect; `size` is dot diameter in **pixels** (`scale = π / size` on GPU per glfx).

### `halftone-dots` {#halftone-dots}

Comma-separated. Indices map to `HalftoneDotsEffect`; see `HALFTONE_DOTS_DEFAULTS`.

| Index | Property         | Parser notes                                                                         |
| ----- | ---------------- | ------------------------------------------------------------------------------------ |
| `0`   | `size`           | `0–1` clamp                                                                          |
| `1`   | `radius`         | `0–2` clamp                                                                          |
| `2`   | `contrast`       | `0–1` clamp                                                                          |
| `3`   | `grid`           | `hex` / `1` → `1`, else numeric `> 0.5` → `1` (hex grid), else `0` (square)          |
| `4`   | `dotStyle`       | `classic`/`gooey`/`holes`/`soft` or integer `0–3`                                    |
| `5`   | `originalColors` | `false`/`0`/`no` → `false`; `true`/`1`/`yes` → `true`; else numeric `> 0.5` → `true` |

### `fluted-glass` {#fluted-glass}

**Internal type:** `flutedGlass`. **17** comma-separated numbers (all parsed with `parseFloat` / finite fallbacks to `FLUTED_GLASS_DEFAULTS`):

| Index     | Property                      | Default | GPU clamp (high level)                      |
| --------- | ----------------------------- | ------- | ------------------------------------------- |
| `0`       | `size`                        | `0.5`   | `0–1`                                       |
| `1`       | `shadows`                     | `0.6`   | `0–1`                                       |
| `2`       | `angle` (deg)                 | `45`    | `0–180`                                     |
| `3`       | `stretch`                     | `0.2`   | `0–1`                                       |
| `4`       | `shape`                       | `1`     | integer **`1–5`** (`GlassGridShapes`)       |
| `5`       | `distortion`                  | `0.5`   | `0–1`                                       |
| `6`       | `highlights`                  | `0.4`   | `0–1`                                       |
| `7`       | `distortionShape`             | `1`     | integer **`1–5`** (`GlassDistortionShapes`) |
| `8`       | `shift`                       | `0`     | `-1–1`                                      |
| `9`       | `blur`                        | `0.15`  | `0–1`                                       |
| `10`      | `edges`                       | `0.3`   | `0–1`                                       |
| `11`–`14` | `marginLeft` … `marginBottom` | `0`     | each `0–1`                                  |
| `15`      | `grainMixer`                  | `0`     | `0–1`                                       |
| `16`      | `grainOverlay`                | `0`     | `0–1`                                       |

### `tsunami` {#tsunami}

**Internal type:** `tsunami`. **11** comma-separated numbers → `TSUNAMI_DEFAULTS` fallbacks; `stripeCount` clamped **`1–256`** on GPU path; `stripeAngle` degrees → radians, clamped **`±180°`**; `blend` parsed as `> 0.5` → `1` else `0`; `drift` **`[-1, 1]`**.

| Index | Property            | Default |
| ----- | ------------------- | ------- |
| `0`   | `stripeCount`       | `45`    |
| `1`   | `stripeAngle` (deg) | `0`     |
| `2`   | `distortion`        | `0.32`  |
| `3`   | `reflection`        | `0.17`  |
| `4`   | `disturbance`       | `0.03`  |
| `5`   | `contortion`        | `0.13`  |
| `6`   | `blend`             | `0`     |
| `7`   | `dispersion`        | `0.22`  |
| `8`   | `drift`             | `0`     |
| `9`   | `shadowIntensity`   | `0.5`   |
| `10`  | `offset`            | `0`     |

### `burn` {#burn}

**Internal type:** `burn`. Comma-separated; indices `0–4` are numeric via `parseFloat` / defaults; colors and flags:

| Index | Property      | Rule                                      |
| ----- | ------------- | ----------------------------------------- |
| `0`   | `burn`        | default `0.5`, shader clamp `0–1`         |
| `1`   | `density`     | default `1`, min `0.01` on GPU            |
| `2`   | `softness`    | default `0.2`                             |
| `3`   | `dispersion`  | default `0.1`                             |
| `4`   | `distortion`  | default `0.3`                             |
| `5`   | `edgeColor`   | CSS color; used if **`parts.length ≥ 7`** |
| `6`   | `maskColor`   | CSS color; used if **`parts.length ≥ 7`** |
| `7`   | `invertMask`  | if present: `parseFloat > 0.5`            |
| `8`   | `transparent` | if present: `parseFloat > 0.5`            |

### `crt` {#crt}

**Internal type:** `crt`. Comma-separated. Let `n = parts.length`. **`timeIdx = n >= 11 ? 7 : 4`**. Token at `timeIdx`: if `auto` / `engine` (case-insensitive) → `useEngineTime: true`; else numeric `time`.

| Index     | Property        | Default (`CRT_DEFAULTS`)           |
| --------- | --------------- | ---------------------------------- |
| `0`       | `curvature`     | `1`                                |
| `1`       | `lineWidth`     | `1` (≥ `0` on GPU)                 |
| `2`       | `lineContrast`  | `0.25`                             |
| `3`       | `verticalLine`  | `0` (`> 0.5` → vertical scanlines) |
| `timeIdx` | `time` / engine | `0` or engine clock                |

**Layouts:** **5 args** → time at index `4`. **11+ args** → legacy Pixi layout, time at index **`7`**.

### `vignette` {#vignette}

**Internal type:** `vignette`. Two numbers; GPU clamps **`size`**, **`amount`** to **`[0, 1]`**.

| Index | Property | Default |
| ----- | -------- | ------- |
| `0`   | `size`   | `0.5`   |
| `1`   | `amount` | `0.5`   |

### `ascii` {#ascii}

**Internal type:** `ascii`.

| Index | Property       | Rule                                                      |
| ----- | -------------- | --------------------------------------------------------- |
| `0`   | `size`         | `parseFloat`, max **`1..min(textureW, textureH)`** on GPU |
| `1`   | `replaceColor` | if present: `parseFloat > 0.5`                            |
| `2+`  | `color`        | joined with commas, trimmed; default `#ffffff`            |

### `glitch` {#glitch}

**Internal type:** `glitch`. **Important:** `formatFilter` order is **`jitter`, `rgbSplit`, `time`, `blocks`** — same as comma index order below.

| Index | Property        | Rule                                                                                                                  |
| ----- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `0`   | `jitter`        | default `0.17` if omitted                                                                                             |
| `1`   | `rgbSplit`      | default `0.24` if omitted                                                                                             |
| `2`   | `time` / engine | If **`parts.length < 3`** → **`useEngineTime: true`**. Else token `auto`/`engine` → engine time; else numeric `time`. |
| `3`   | `blocks`        | if **`parts.length ≥ 4`**, else default **`0.2`**                                                                     |

### `liquid-glass` {#liquid-glass}

**Internal type:** `liquidGlass`. **17** comma-separated numbers → `LIQUID_GLASS_DEFAULTS`:

| Index    | Property           | Default                    |
| -------- | ------------------ | -------------------------- |
| `0`      | `powerFactor`      | `4`                        |
| `1`      | `fPower`           | `3`                        |
| `2`      | `noise`            | `0.1`                      |
| `3`      | `glowWeight`       | `0.3`                      |
| `4`      | `glowBias`         | `0`                        |
| `5`      | `glowEdge0`        | `0.06`                     |
| `6`      | `glowEdge1`        | `0`                        |
| `7`–`10` | `a`, `b`, `c`, `d` | `0.7`, `2.3`, `5.2`, `6.9` |
| `11`     | `centerX`          | `0.5`                      |
| `12`     | `centerY`          | `0.5`                      |
| `13`     | `scaleX`           | `1`                        |
| `14`     | `scaleY`           | `1`                        |
| `15`     | `ellipseSizeX`     | `1`                        |
| `16`     | `ellipseSizeY`     | `1`                        |

### `liquid-metal` {#liquid-metal}

**Internal type:** `liquidMetal`. Indices `0–7` numeric (`shape` floored to **`0–4`**). Then:

| Index | Property        | Rule                                                                                                                                               |
| ----- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `8`   | `useImage`      | if `parts.length > 8`: `parseFloat(parts[8]) > 0.5`                                                                                                |
| `9`   | `colorBack`     | if `parts.length === 10` **or** `≥ 11`, read string                                                                                                |
| `10`  | `colorTint`     | if `parts.length ≥ 11`                                                                                                                             |
| `11`  | `time` / engine | if `parts.length ≥ 12`: `auto`/`engine` → `useEngineTime`; else numeric `time`. If `< 12` and `LIQUID_METAL_DEFAULTS.useEngineTime` → engine time. |
| `12`  | `usePoisson`    | if `parts.length > 12`: `parseFloat > 0.5`                                                                                                         |

Defaults: `repetition` **`2`** (clamped **`1–10`** on GPU), `shape` **`3`**, `colorBack` **`transparent`**, `colorTint` **`#ffffff`**, `useEngineTime` default **`true`** in defaults object.

### `heat-map` / `heatmap` {#heat-map}

**Internal type:** `heatmap`. Same parser for **`heat-map`** and **`heatmap`**.

| Index    | Property                                              | Rule                                                                       |
| -------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `0`–`4`  | `contour`, `angle`, `noise`, `innerGlow`, `outerGlow` | numeric / defaults                                                         |
| `5`      | `useImage`                                            | if `parts.length > 5`                                                      |
| `6`      | `usePreprocess`                                       | if `parts.length > 6`                                                      |
| `7`      | `time` / engine                                       | if `parts.length > 7`: `auto`/`engine` or numeric                          |
| `8`      | `colorBack`                                           | if `parts.length > 8`                                                      |
| `9`–`17` | `colors[]`                                            | up to **9** extra comma fields (loop `c < 18`), appended as gradient stops |

Default palette: see `HEATMAP_DEFAULTS.colors` (7 stops).

### `gem-smoke` / `gemSmoke` {#gem-smoke}

**Internal type:** `gemSmoke`. Indices `0–6` numeric; `7` **`shape`** floored **`0–4`**.

| Index     | Property        | Rule                                       |
| --------- | --------------- | ------------------------------------------ |
| `8`       | `useImage`      | if `parts.length > 8`                      |
| `9`       | `usePoisson`    | if `parts.length > 9`                      |
| `10`      | `time` / engine | if `parts.length > 10`                     |
| `11`      | `colorBack`     | if `parts.length > 11`                     |
| `12`      | `colorInner`    | if `parts.length > 12`                     |
| `13`–`18` | `colors[]`      | up to **6** gradient tokens (`c < 13 + 6`) |

### `lut` / `LUT` {#lut-filter}

**Internal type:** `lut`. Params parsed by `parseLutFilterParams`:

| Form                 | `lutKey`                               | `strength`                                                                    |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `lut(url("…"), 0.5)` | String inside quotes                   | After closing `)`, first comma segment, clamped **`[0, 1]`**, default **`1`** |
| `lut(name("…"), 1)`  | Inner quoted name                      | same                                                                          |
| `lut(fuji, 1)`       | Identifier `^[a-zA-Z_][a-zA-Z0-9_-]*$` | second segment                                                                |
| `lut("my-key", 1)`   | Quoted first token                     | second segment                                                                |

Registration: [3D LUT](#lut).

### `fxaa` {#fxaa}

**Internal type:** `fxaa`. No parameters required; **`fxaa()`** adds a pass. Parser ignores unknown params.

## Parsing and formatting {#parsing-and-formatting}

Use these helpers when you build tooling or migrate stored data:

```ts
import { parseEffect, formatFilter } from '@infinite-canvas-tutorial/ecs';

const effects = parseEffect('blur(2px) lut(fuji, 0.65)');
const again = formatFilter(effects);
```

-   `parseEffect(filter: string)` returns a typed `Effect[]` (empty array if the string is missing or invalid).
-   `formatFilter(effects: Effect[])` serializes back to a filter string LUT segments preserve `lut(url("…"), strength)` when the key is not a simple identifier.

## 3D LUT (`.cube`) {#lut}

The `lut(…)` segment applies a 3D color cube. Sampling matches three.js [`LUTPass`](https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/LUTPass.js) conventions (half-texel inset and `intensity` mix).

**Register the cube once per WebGPU `Device` and logical name:**

```ts
import { registerCubeLutFromText } from '@infinite-canvas-tutorial/ecs';

const text = await fetch('/luts/grade_sRGB.cube').then((r) => r.text());
registerCubeLutFromText(device, 'fuji', text);
```

Then reference it from a node:

```ts
filter: 'lut(fuji, 1)',
```

Alternative spellings understood by the parser:

-   Named key: `lut(myKey, 0.8)` — must match the string passed to `registerCubeLutFromText`.
-   URL-style key: `lut(url("./grade.cube"), 1)` — the key is the path inside `url("…")` (must still be registered under that same key, or you register after resolving the path).

Use `listRegisteredCubeLutKeys(device)` to debug which keys exist; missing keys produce a one-time console warning in development.

Optional `RegisterCubeLutOptions.atlasFormat` (`'u8' | 'f16' | 'f32'`) controls GPU volume texel format for HDR or wide DOMAIN cubes.

## Engine-time animation {#engine-time}

Some filters (for example `crt`, `glitch`) can read engine time for animation. The package exports `filterStringUsesEngineTimeCrt`, `filterStringUsesEngineTimeGlitch`, and `filterStringUsesEngineTimePost` so you can detect that before exporting video. See [Export image](/reference/export-image) for `WEBM` / `GIF` options.
