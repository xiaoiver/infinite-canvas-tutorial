/**
 * naga-oil：`load_composable` 的模块内不能带 compute-toys 那套 `alias int = i32`（会触发
 * “Composable module identifiers must not require substitution … `int`”）。
 * 可组合片段需展开成标准 WGSL；根着色器仍用 `alias + …` 再 `wgsl_compile`。
 */
import { alias, camera, math, prelude } from '../wgslUtils';
import { WGSLComposer } from '../../../../rust/glsl-wgsl-compiler/pkg/glsl_wgsl_compiler';

/** 将 utils 里 prelude/math/camera 等使用的别名换成 naga 可组合模块接受的写法。 */
export function expandComputeToyAliasesForComposable(src: string): string {
  let s = src;
  const longFirst: [string, string][] = [
    ['float4x4', 'mat4x4<f32>'],
    ['float4x3', 'mat4x3<f32>'],
    ['float4x2', 'mat4x2<f32>'],
    ['float3x4', 'mat3x4<f32>'],
    ['float3x3', 'mat3x3<f32>'],
    ['float3x2', 'mat3x2<f32>'],
    ['float2x4', 'mat2x4<f32>'],
    ['float2x3', 'mat2x3<f32>'],
    ['float2x2', 'mat2x2<f32>'],
    ['uint4', 'vec4<u32>'],
    ['uint3', 'vec3<u32>'],
    ['uint2', 'vec2<u32>'],
    ['int4', 'vec4<i32>'],
    ['int3', 'vec3<i32>'],
    ['int2', 'vec2<i32>'],
    ['float4', 'vec4<f32>'],
    ['float3', 'vec3<f32>'],
    ['float2', 'vec2<f32>'],
    ['bool4', 'vec4<bool>'],
    ['bool3', 'vec3<bool>'],
    ['bool2', 'vec2<bool>'],
  ];
  for (const [from, to] of longFirst) {
    s = s.split(from).join(to);
  }
  s = s.replace(/\buint\b/g, 'u32');
  s = s.replace(/\bint\b/g, 'i32');
  s = s.replace(/\bfloat\b/g, 'f32');
  return s;
}

export function flattenParticleComputeWgsl(
  customModule: string,
  rootWithImports: string,
): string {
  const composer = new WGSLComposer();
  composer.load_composable(expandComputeToyAliasesForComposable(prelude));
  composer.load_composable(expandComputeToyAliasesForComposable(math));
  composer.load_composable(expandComputeToyAliasesForComposable(camera));
  composer.load_composable(expandComputeToyAliasesForComposable(customModule));
  return composer.wgsl_compile(alias + rootWithImports);
}
