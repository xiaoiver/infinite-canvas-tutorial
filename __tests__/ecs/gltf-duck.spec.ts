import { readFileSync } from 'fs';
import path from 'path';
import { bakeGltfMesh } from '../../packages/ecs/src/utils/gltf/bake-gltf-mesh';
import type { GltfContainer } from '../../packages/ecs/src/utils/gltf/accessors';
import { gltfScenes } from '../helpers/gltf';

const dataDir = path.join(__dirname, '../../packages/site/docs/public/data');

function loadDuckContainer(): GltfContainer {
  const json = JSON.parse(
    readFileSync(path.join(dataDir, 'Duck.gltf'), 'utf8'),
  );
  const bin = readFileSync(path.join(dataDir, 'Duck0.bin'));
  return {
    json,
    buffers: [
      {
        arrayBuffer: bin.buffer.slice(
          bin.byteOffset,
          bin.byteOffset + bin.byteLength,
        ),
      },
    ],
  };
}

describe('gltf duck mesh', () => {
  it('bakes Duck.gltf with positions and indices', () => {
    const mesh = bakeGltfMesh(loadDuckContainer(), {
      baseUrl: '/data/Duck.gltf',
    });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.positions.length % 3).toBe(0);
    expect(mesh.uvs?.length).toBe((mesh.positions.length / 3) * 2);
    expect(mesh.map).toBe('/data/DuckCM.png');
  });

  it('normalizes duck bounds to roughly unit size', () => {
    const mesh = bakeGltfMesh(loadDuckContainer());
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      minX = Math.min(minX, mesh.positions[i]);
      maxX = Math.max(maxX, mesh.positions[i]);
      minY = Math.min(minY, mesh.positions[i + 1]);
      maxY = Math.max(maxY, mesh.positions[i + 1]);
      minZ = Math.min(minZ, mesh.positions[i + 2]);
      maxZ = Math.max(maxZ, mesh.positions[i + 2]);
    }
    const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    expect(extent).toBeGreaterThan(0.9);
    expect(extent).toBeLessThanOrEqual(1.01);
    expect(Math.abs(minX + maxX)).toBeLessThan(0.05);
    expect(Math.abs(minY + maxY)).toBeLessThan(0.05);
    expect(Math.abs(minZ + maxZ)).toBeLessThan(0.05);
  });
});

it('normalizes glTF scene primitives together so their relative placement survives', () => {
  const model = gltfScenes();
  const scenes = (model.json as unknown as { scenes: { nodes: number[] }[] }).scenes;
  scenes[0].nodes.push(1);
  const mesh = bakeGltfMesh(model, { scene: 0 });
  expect(mesh.parts).toHaveLength(2);
  expect(mesh.parts[0].baseColor).toEqual([0.2, 0.4, 0.6, 0.8]);
  expect(mesh.parts[1].baseColor).toEqual([0.8, 0.6, 0.4, 1]);
  expect(mesh.parts[0].positions[7]).toBeCloseTo(0);
  expect(mesh.parts[1].positions[7]).toBeCloseTo(0.5);
  expect(mesh.parts[0].indices).toEqual(new Uint32Array([0, 1, 2]));
  expect(mesh.parts[1].indices).toEqual(new Uint32Array([0, 1, 2]));
});
