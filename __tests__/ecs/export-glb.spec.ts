import { parse } from '@loaders.gl/core';
import { PNG } from 'pngjs';
import { GLTFLoader } from '../../packages/ecs/node_modules/@loaders.gl/gltf';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { Transform3D } from '../../packages/ecs/src/components/geometry3d/Transform3D';
import { extrudePathContours } from '../../packages/ecs/src/utils/geometry3d/extrude-path';
import { createUnitCubeGeometry } from '../../packages/ecs/src/utils/geometry3d/unit-cube';
import { exportMeshesToGlb, type GlbMeshSource } from '../../packages/ecs/src/utils/gltf/export-glb';
import { loadGlbImages } from '../../packages/ecs/src/utils/gltf/load-glb-images';
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

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';

it('separates independent SVG stacks without moving intersecting 3D objects', () => {
  const cube = createUnitCubeGeometry();
  const source = (
    name: string,
    x: number,
    y: number,
    z: number,
    painterOrder?: number,
  ): GlbMeshSource => ({
    name,
    mesh: cube,
    material: new Material3D({ baseColor: [1, 0, 0, 1] }),
    transform: new Transform3D({ translation: [x, y, z], scale: [40, 40, 24] }),
    painterOrder,
  });
  const layers = [
    source('a', 0, 0, -12, 0),
    source('b', 10, 10, -12, 1),
    source('c', 200, 0, -12, 2),
    source('d', 210, 10, -12, 3),
  ];
  const positions = (sources: GlbMeshSource[]) => {
    const { json } = readGlb(exportMeshesToGlb(sources));
    return Object.fromEntries(json.nodes.slice(1).map(
      (node: { name: string; matrix: number[] }) => [node.name, node.matrix[14]],
    ));
  };
  const remote = positions([...layers, source('mesh', 500, 0, -12)]);
  expect(remote.b).toBeLessThan(remote.a);
  expect(remote.d).toBeLessThan(remote.c);
  expect(remote.mesh).toBe(-12);

  const near = positions([...layers, source('mesh', 0, 0, -12)]);
  expect(near.a).toBe(-12);
  expect(near.b).toBe(-12);
  expect(near.d).toBeLessThan(near.c);

  const elevated = positions([...layers, source('elevated', 200, 0, -8, 4)]);
  expect(elevated.b).toBeLessThan(elevated.a);
  expect(elevated.c).toBe(-12);
  expect(elevated.d).toBe(-12);
  expect(elevated.elevated).toBe(-8);
});

it('embeds an emissive-only texture in exported GLB', async () => {
  const source = {
    mesh: createUnitCubeGeometry(),
    material: new Material3D({
      emissiveFactor: [1, 0.5, 0],
      emissiveStrength: 3,
      unlit: true,
      emissiveMap: png,
    }),
    transform: new Transform3D(),
  };
  const images = await loadGlbImages([source]);
  expect(images.size).toBe(1);
  const bytes = exportMeshesToGlb([source], images);
  const { json } = readGlb(bytes);
  expect(json.images).toHaveLength(1);
  expect(json.materials[0].emissiveFactor).toEqual([1, 0.5, 0]);
  expect(json.materials[0].extensions).toEqual({
    KHR_materials_emissive_strength: { emissiveStrength: 3 },
    KHR_materials_unlit: {},
  });
  expect(json.extensionsUsed).toContain('KHR_materials_emissive_strength');
  expect(json.extensionsUsed).toContain('KHR_materials_unlit');
  expect(json.materials[0].emissiveTexture).toEqual({ index: 0 });
  const loaded = (await parse(bytes.buffer, GLTFLoader, {
    gltf: { loadBuffers: true, loadImages: false },
  })) as GltfContainer;
  expect(bakeGltfMesh(loaded).unlit).toBe(true);
});

it('embeds a shared base-color texture once and imports it from the GLB buffer', async () => {
  const source = {
    mesh: createUnitCubeGeometry(),
    material: new Material3D({
      map: png,
      metallicRoughnessMap: png,
      alphaMode: 'mask',
      alphaCutoff: 0.4,
    }),
    transform: new Transform3D(),
  };
  const images = await loadGlbImages([source, source]);
  expect(images.size).toBe(1);
  const bytes = exportMeshesToGlb([source, source], images);
  const { json, binOffset } = readGlb(bytes);
  expect(json.images).toHaveLength(1);
  expect(json.textures).toEqual([{ source: 0 }]);
  expect(json.images[0].mimeType).toBe('image/png');
  expect(json.images[0]).not.toHaveProperty('uri');
  const view = json.bufferViews[json.images[0].bufferView];
  expect(view).not.toHaveProperty('target');
  expect(
    Array.from(
      bytes.subarray(
        binOffset + 8 + view.byteOffset,
        binOffset + 16 + view.byteOffset,
      ),
    ),
  ).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(
    json.materials.map(
      (material: { pbrMetallicRoughness: { baseColorTexture: unknown } }) =>
        material.pbrMetallicRoughness.baseColorTexture,
    ),
  ).toEqual([{ index: 0 }, { index: 0 }]);
  expect(
    json.materials.map(
      (material: {
        pbrMetallicRoughness: { metallicRoughnessTexture: unknown };
      }) => material.pbrMetallicRoughness.metallicRoughnessTexture,
    ),
  ).toEqual([{ index: 0 }, { index: 0 }]);
  const loaded = (await parse(bytes.buffer, GLTFLoader, {
    gltf: { loadBuffers: true, loadImages: false },
  })) as GltfContainer;
  const roundTrip = bakeGltfMesh(loaded);
  expect(roundTrip.map).toBe(png);
  expect(roundTrip.metallicRoughnessMap).toBe(png);
  expect(roundTrip.parts.map((part) => part.map)).toEqual([png, png]);
  expect(roundTrip.parts.map((part) => part.metallicRoughnessMap)).toEqual([
    png,
    png,
  ]);
  expect(roundTrip.alphaMode).toBe('mask');
});

it('keeps distinct textures on separate material primitives', async () => {
  const blue = new PNG({ width: 1, height: 1 });
  blue.data.set([0, 0, 255, 255]);
  const blueUrl = `data:image/png;base64,${PNG.sync
    .write(blue)
    .toString('base64')}`;
  const geometry = createUnitCubeGeometry();
  const mesh = {
    ...geometry,
    uvs1: Float32Array.from(geometry.uvs!, (value) => 1 - value),
  };
  const transform = new Transform3D();
  const sources = [
    {
      mesh,
      transform,
      material: new Material3D({
        baseColor: [0.25, 0.5, 0.75, 1],
        map: png,
        mapTexCoord: 1,
        mapTextureTransform: {
          offset: [0.25, 0.5],
          scale: [2, 0.5],
          rotation: Math.PI / 2,
        },
        metallicRoughnessMap: blueUrl,
        metallicRoughnessTextureTransform: { offset: [0.75, 0] },
        emissiveFactor: [0.2, 0.5, 0.8],
        emissiveStrength: 2.5,
        emissiveMap: blueUrl,
        emissiveTexCoord: 1,
        emissiveTextureTransform: { scale: [0.5, 1] },
        alphaMode: 'mask',
      }),
    },
    {
      mesh,
      transform,
      material: new Material3D({
        baseColor: [0.5, 0.25, 0.75, 0.5],
        map: blueUrl,
        metallicRoughnessMap: png,
        metallicRoughnessTexCoord: 1,
        unlit: true,
        alphaMode: 'blend',
      }),
    },
  ];
  const bytes = exportMeshesToGlb(sources, await loadGlbImages(sources));
  const { json } = readGlb(bytes);
  expect(json.images).toHaveLength(2);
  expect(json.textures).toHaveLength(2);
  expect(
    json.materials.map(
      (material: { pbrMetallicRoughness: { baseColorTexture: unknown } }) =>
        material.pbrMetallicRoughness.baseColorTexture,
    ),
  ).toEqual([
    {
      index: 0,
      texCoord: 1,
      extensions: {
        KHR_texture_transform: {
          offset: [0.25, 0.5],
          scale: [2, 0.5],
          rotation: Math.PI / 2,
        },
      },
    },
    { index: 1 },
  ]);
  expect(
    json.materials.map(
      (material: {
        pbrMetallicRoughness: { metallicRoughnessTexture: unknown };
      }) => material.pbrMetallicRoughness.metallicRoughnessTexture,
    ),
  ).toEqual([
    {
      index: 1,
      extensions: { KHR_texture_transform: { offset: [0.75, 0] } },
    },
    { index: 0, texCoord: 1 },
  ]);
  expect(json.extensionsUsed).toContain('KHR_texture_transform');
  expect(json.materials[0].pbrMetallicRoughness.baseColorFactor[0]).toBeCloseTo(
    0.050876,
    5,
  );
  expect(json.materials[0].emissiveFactor).toEqual([0.2, 0.5, 0.8]);
  expect(json.materials[0].extensions).toEqual({
    KHR_materials_emissive_strength: { emissiveStrength: 2.5 },
  });
  expect(json.materials[0].emissiveTexture).toEqual({
    index: 1,
    texCoord: 1,
    extensions: { KHR_texture_transform: { scale: [0.5, 1] } },
  });
  expect(json.materials[1].extensions).toEqual({ KHR_materials_unlit: {} });
  expect(json.meshes[0].primitives[0].attributes.TEXCOORD_1).toBeDefined();
  const loaded = (await parse(bytes.buffer, GLTFLoader, {
    gltf: {
      loadBuffers: true,
      loadImages: false,
      excludeExtensions: { KHR_texture_transform: false },
    },
  })) as GltfContainer;
  expect(bakeGltfMesh(loaded).parts.map((part) => part.map)).toEqual([
    png,
    blueUrl,
  ]);
  expect(
    bakeGltfMesh(loaded).parts.map((part) => part.metallicRoughnessMap),
  ).toEqual([blueUrl, png]);
  expect(bakeGltfMesh(loaded).parts.map((part) => part.mapTexCoord)).toEqual([
    1, 0,
  ]);
  expect(
    bakeGltfMesh(loaded).parts.map((part) => part.metallicRoughnessTexCoord),
  ).toEqual([0, 1]);
  expect(bakeGltfMesh(loaded).parts[0].uvs1).toEqual(mesh.uvs1);
  expect(bakeGltfMesh(loaded).parts[0].mapTextureTransform).toEqual({
    offset: [0.25, 0.5],
    scale: [2, 0.5],
    rotation: Math.PI / 2,
  });
  expect(
    bakeGltfMesh(loaded).parts[0].metallicRoughnessTextureTransform,
  ).toEqual({ offset: [0.75, 0], scale: [1, 1], rotation: 0 });
  expect(bakeGltfMesh(loaded).parts[0].emissiveFactor).toEqual([0.2, 0.5, 0.8]);
  expect(bakeGltfMesh(loaded).parts[0].emissiveStrength).toBe(2.5);
  expect(bakeGltfMesh(loaded).parts[1].unlit).toBe(true);
  expect(bakeGltfMesh(loaded).parts[0].baseColor[0]).toBeCloseTo(0.25, 5);
  expect(bakeGltfMesh(loaded).parts[0].baseColor[1]).toBeCloseTo(0.5, 5);
  expect(bakeGltfMesh(loaded).parts[0].baseColor[2]).toBeCloseTo(0.75, 5);
  expect(bakeGltfMesh(loaded).parts[1].baseColor[0]).toBeCloseTo(0.5, 5);
  expect(bakeGltfMesh(loaded).parts[1].baseColor[3]).toBe(0.5);
  expect(bakeGltfMesh(loaded).parts[0].emissiveMap).toBe(blueUrl);
  expect(bakeGltfMesh(loaded).parts[0].emissiveTexCoord).toBe(1);
  expect(bakeGltfMesh(loaded).parts[0].emissiveTextureTransform).toEqual({
    offset: [0, 0],
    scale: [0.5, 1],
    rotation: 0,
  });
});

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
    alphaMode: 'blend',
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

it('preserves explicit alpha modes and mask cutoff through GLB export', async () => {
  const geometry = createUnitCubeGeometry();
  const bytes = exportMeshesToGlb([
    ...(
      [
        { alphaMode: 'mask', alphaCutoff: 0.3 },
        { alphaMode: 'blend', alphaCutoff: 0.5 },
        { alphaMode: 'opaque', alphaCutoff: 0.5 },
      ] as const
    ).map((settings) => ({
      mesh: geometry,
      material: new Material3D({
        baseColor: [0.4, 0.5, 0.6, 0.25],
        ...settings,
      }),
      transform: new Transform3D(),
    })),
    {
      mesh: geometry,
      material: {
        baseColor: [0.4, 0.5, 0.6, 0.25],
        sideColor: null,
        metallic: 0,
        roughness: 1,
      },
      transform: new Transform3D(),
    },
  ]);
  const { json } = readGlb(bytes);
  expect(
    json.materials.map((material: { alphaMode: string }) => material.alphaMode),
  ).toEqual(['MASK', 'BLEND', 'OPAQUE', 'BLEND']);
  expect(json.materials[0].alphaCutoff).toBeCloseTo(0.3);
  expect(json.materials[1]).not.toHaveProperty('alphaCutoff');
  const loaded = (await parse(bytes.buffer, GLTFLoader, {
    gltf: { loadBuffers: true },
  })) as GltfContainer;
  const roundTrip = bakeGltfMesh(loaded);
  expect(roundTrip.alphaMode).toBe('mask');
  expect(roundTrip.alphaCutoff).toBeCloseTo(0.3);
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
  expect(() =>
    exportMeshesToGlb([
      {
        ...source,
        mesh: {
          ...createUnitCubeGeometry(),
          tangents: new Float32Array(24 * 4),
        },
      },
    ]),
  ).toThrow('Invalid 3D mesh vertices');
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
