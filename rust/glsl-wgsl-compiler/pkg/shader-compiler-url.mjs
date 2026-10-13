// Keep import.meta in a lazy ESM module so CommonJS/SSR can import the bindings
// without evaluating a browser asset URL or loading the compiler.
export default new URL('./glsl_wgsl_compiler_bg.wasm', import.meta.url);
