# Infinite Canvas CLI

Offline commands for `.ic` documents. Requires Node.js 20 or newer.

```sh
ic validate design.ic
ic inspect design.ic --json
ic codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
ic codegen design.ic --framework html-css --output design.html
```

`codegen` writes the same generated component or HTML/CSS fragment as the editor. Without `--output`, results go to stdout. The CLI does not load the renderer or access a project account. Temporary browser `blob:` URLs cannot be used across processes and cause `codegen` to fail; use data URLs or persistent URLs in the `.ic` document.
