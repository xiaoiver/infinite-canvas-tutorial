import { parse } from '@loaders.gl/core';
import { GLTFLoader } from '../../packages/ecs/node_modules/@loaders.gl/gltf';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import { extrudePathContours } from '../../packages/ecs/src/utils/geometry3d/extrude-path';
import { createUnitCubeGeometry } from '../../packages/ecs/src/utils/geometry3d/unit-cube';
import { exportMeshesToGlb } from '../../packages/ecs/src/utils/gltf/export-glb';
import { bakeGltfMesh } from '../../packages/ecs/src/utils/gltf/bake-gltf-mesh';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';

const outer: [number, number][] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const hole: [number, number][] = [
  [3, 3],
  [7, 3],
  [7, 7],
  [3, 7],
];

function readGlb(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  const binOffset = 20 + jsonLength;
  const json = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, binOffset)),
  );
  return { view, json, binOffset };
}

it('exports a holed Path with distinct cap and wall materials as a valid GLB', async () => {
  const result = extrudePathContours([outer, hole], 2, 'evenodd');
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const geometry = result.geometry;
  const original = new Float32Array(geometry.positions);
  const material = new Material3D({
    baseColor: [0, 0.5, 1, 1],
    sideColor: [1, 0, 0, 0.5],
    metallic: 0.2,
    roughness: 0.8,
  });
  const source = {
    name: 'ring',
    mesh: { ...geometry, uvs: geometry.uvs!, indices: geometry.indices },
    material,
    transform: new Transform3D({
      translation: [12, 34, 5],
      rotation: [0.2, 0.3, 0],
      scale: [1, 1, 20],
    }),
  };
  const bytes = exportMeshesToGlb([source, { ...source, name: 'ring-copy' }]);
  const { view, json, binOffset } = readGlb(bytes);

  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(bytes.length);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a);
  expect(view.getUint32(binOffset + 4, true)).toBe(0x004e4942);
  expect(view.getUint32(binOffset, true)).toBe(json.buffers[0].byteLength);
  expect(bytes.length % 4).toBe(0);
  expect(json.scenes[0].nodes).toEqual([0]);
  expect(json.nodes[0]).toMatchObject({
    rotation: [1, 0, 0, 0],
    children: [1, 2],
  });
  expect(json.nodes[1].name).toBe('ring');
  expect(json.nodes[1].matrix.slice(12, 15)).toEqual([12, 34, 5]);
  expect(json.meshes).toHaveLength(2);
  expect(json.meshes[0].primitives).toHaveLength(2);
  const [caps, walls] = json.meshes[0].primitives;
  expect(caps.attributes).toHaveProperty('TEXCOORD_0');
  expect(
    json.accessors[caps.indices].count + json.accessors[walls.indices].count,
  ).toBe(geometry.indices.length);
  expect(json.accessors[caps.attributes.POSITION]).toMatchObject({
    componentType: 5126,
    count: geometry.positions.length / 3,
    min: [0, 0, -1],
    max: [10, 10, 1],
  });
  expect(
    json.materials[caps.material].pbrMetallicRoughness.baseColorFactor[1],
  ).toBeCloseTo(0.21404, 4);
  expect(json.materials[walls.material]).toMatchObject({
    alphaMode: 'BLEND',
    pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 0.5] },
  });
  expect(geometry.positions).toEqual(original);
  const loaded = (await parse(bytes.buffer, GLTFLoader, {
    gltf: { loadBuffers: true },
  })) as { json: { meshes: unknown[]; materials: unknown[] } };
  expect(loaded.json.meshes).toHaveLength(2);
  expect(loaded.json.materials).toHaveLength(4);
  const roundTrip = bakeGltfMesh(loaded as GltfContainer);
  expect(roundTrip.indices).toHaveLength(geometry.indices.length * 2);
  expect([...roundTrip.positions].every(Number.isFinite)).toBe(true);
});

it('keeps beveled faces with the side material in GLB', () => {
  const result = extrudePathContours([outer], 2, 'nonzero', 0.5);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const bytes = exportMeshesToGlb([
    {
      mesh: result.geometry,
      material: new Material3D({ sideColor: [1, 0, 0, 1] }),
      transform: new Transform3D(),
    },
  ]);
  const { json } = readGlb(bytes);
  const [caps, sides] = json.meshes[0].primitives;
  expect(json.accessors[caps.indices].count).toBe(12);
  expect(json.accessors[sides.indices].count).toBe(72);
});

it('exports both outer and hole bevel faces with the side material', () => {
  const result = extrudePathContours(
    [
      outer,
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
      ],
    ],
    4,
    'evenodd',
    0.5,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const bytes = exportMeshesToGlb([
    {
      mesh: result.geometry,
      material: new Material3D({ sideColor: [1, 0, 0, 1] }),
      transform: new Transform3D(),
    },
  ]);
  const { json } = readGlb(bytes);
  const [caps, sides] = json.meshes[0].primitives;
  expect(json.accessors[caps.indices].count).toBeGreaterThan(0);
  expect(json.accessors[sides.indices].count).toBe(144);
});

it('keeps rounded bevel strips with the side material in GLB', () => {
  const result = extrudePathContours([outer], 8, 'nonzero', 1, 4);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const bytes = exportMeshesToGlb([
    {
      mesh: result.geometry,
      material: new Material3D({ sideColor: [1, 0, 0, 1] }),
      transform: new Transform3D(),
    },
  ]);
  const { json } = readGlb(bytes);
  const [caps, sides] = json.meshes[0].primitives;
  expect(json.accessors[caps.indices].count).toBe(12);
  expect(json.accessors[sides.indices].count).toBe(216);
});

it('rejects empty or malformed mesh data', () => {
  expect(() => exportMeshesToGlb([])).toThrow('No 3D meshes');
  const source = {
    mesh: {
      positions: new Float32Array([0, 0, 0]),
      normals: new Float32Array(0),
      uvs: null,
      indices: null,
    },
    material: new Material3D(),
    transform: new Transform3D(),
  };
  expect(() => exportMeshesToGlb([source])).toThrow('Invalid 3D mesh vertices');
  expect(() =>
    exportMeshesToGlb([
      {
        ...source,
        mesh: {
          ...createUnitCubeGeometry(),
          indices: new Uint32Array([0, 1, 999]),
        },
      },
    ]),
  ).toThrow('Invalid 3D mesh indices');
});

it('exports a plain rectangle without a second material or missing UVs', () => {
  const bytes = exportMeshesToGlb([
    {
      mesh: { ...createUnitCubeGeometry(), uvs: null },
      material: new Material3D(),
      transform: new Transform3D(),
    },
  ]);
  const { json } = readGlb(bytes);
  expect(json.meshes[0].primitives).toHaveLength(1);
  expect(json.meshes[0].primitives[0].attributes).not.toHaveProperty(
    'TEXCOORD_0',
  );
  expect(json.materials).toHaveLength(1);
});
