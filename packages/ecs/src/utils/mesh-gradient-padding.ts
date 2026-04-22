import { isNumber } from '@antv/util';

/**
 * 与站点 `packages/site/docs/components/utils.ts` 中 `paddingUniforms` 一致，用于
 * `mesh-fill-gradient` 的 UBO 打包含 `u_Points[0..9]` 等字段的紧凑布局。
 */
export function paddingMeshGradientUniforms(
  uniforms: (number | number[] | Float32Array)[],
): number[] {
  let offset = 0;
  const uboBuffer: number[] = [];
  uniforms.forEach((value) => {
    if (
      isNumber(value) ||
      Array.isArray(value) ||
      value instanceof Float32Array
    ) {
      const array = isNumber(value) ? [value] : value;
      const formatByteSize = array.length > 4 ? 4 : array.length;

      const emptySpace = 4 - (offset % 4);
      if (emptySpace !== 4) {
        if (emptySpace >= formatByteSize) {
        } else {
          offset += emptySpace;
          for (let j = 0; j < emptySpace; j++) {
            uboBuffer.push(0);
          }
        }
      }

      offset += array.length;

      uboBuffer.push(...array);
    }
  });

  const emptySpace = 4 - (uboBuffer.length % 4);
  if (emptySpace !== 4) {
    for (let j = 0; j < emptySpace; j++) {
      uboBuffer.push(0);
    }
  }
  return uboBuffer;
}

const MAX_POINTS = 10;

/** 3×3 网格角点 UV（行主序）+ 第 10 点占位，与站点 mesh 模式一致。 */
export const DEFAULT_MESH_GRADIENT_CORNER_POSITIONS: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [1, 0],
  [0, 0.5],
  [0.5, 0.5],
  [1, 0.5],
  [0, 1],
  [0.5, 1],
  [1, 1],
  [0, 0],
];

/**
 * 与站点 `MeshGradient.vue` 中 `paddingUniforms(Object.values(uniforms))` 一致：
 * 每点为 `color` 三元组与 `position` 二元组两个独立元素（与 std140 内 vec3+vec2 的
 * 字节对齐在 TS 打包里一致），背景为 `vec3` 数组后再跟标量。
 */
export function buildMeshGradientUniformValues(params: {
  backgroundRgb: [number, number, number];
  pointColors: [number, number, number][];
  pointPositions: [number, number][];
  pointsNum: number;
  noiseRatio: number;
  noiseTime: number;
  warpShapeIndex: number;
  warpSize: number;
  warpRatio: number;
  gradientTypeIndex: number;
  time: number;
}): number[] {
  const values: (number | number[] | Float32Array)[] = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    const c = params.pointColors[i] ?? [0, 0, 0];
    const p = params.pointPositions[i] ?? [0, 0];
    values.push([c[0]!, c[1]!, c[2]!], [p[0]!, p[1]!]);
  }
  values.push(
    [params.backgroundRgb[0]!, params.backgroundRgb[1]!, params.backgroundRgb[2]!],
    params.pointsNum,
    params.noiseRatio,
    params.noiseTime,
    params.warpShapeIndex,
    params.warpSize,
    params.warpRatio,
    params.gradientTypeIndex,
    params.time,
  );
  return paddingMeshGradientUniforms(values);
}

/** 与站点 UBO 缓冲 96 float 一致；`buildMeshGradientUniformValues` 实际为 92，右侧补 0。 */
export const MESH_GRADIENT_UNIFORM_FLOAT32_COUNT = 96;
