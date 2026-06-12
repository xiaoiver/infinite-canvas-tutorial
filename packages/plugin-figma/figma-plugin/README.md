# Infinite Canvas Import (companion Figma plugin)

This folder is a standalone [Figma plugin](https://www.figma.com/plugin-docs/)
that recreates an Infinite Canvas scene inside a Figma document. It implements
the `.ic` → Figma **export** direction, which the read-only Figma REST API
cannot do.

It is shipped as **source** (not part of the npm package build) because it runs
inside Figma's sandbox, not in the web app.

## Files

-   `manifest.json` — Figma plugin manifest.
-   `ui.html` — dependency-free UI; paste the scene JSON and click Import.
-   `code.ts` — main thread; replays a `FigmaScene` payload via the Plugin API.

## Build & run

```bash
# from this folder
npm init -y
npm install --save-dev typescript @figma/plugin-typings
npx tsc code.ts --target es2017 --lib es2017,dom --strict
```

Then in the Figma desktop app: **Plugins → Development → Import plugin from
manifest…** and pick `manifest.json`.

## Usage

1. In Infinite Canvas, export to Figma to obtain a scene JSON payload
   (`serializedNodesToFigmaScene`).
2. Run this plugin in Figma, paste the JSON, and click **Import**.
