// Source-based tools use the Rust build. The package build replaces this bridge
// with self-contained bindings, declarations, and WASM in lib/esm/vendor.
export {
  default,
  glsl_compile,
  WGSLComposer,
} from '../../../../rust/glsl-wgsl-compiler/pkg/glsl_wgsl_compiler';
