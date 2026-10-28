import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { Mesh3D } from '../packages/ecs/src/components/geometry3d/Mesh3D';
import { MeshGPUCache } from '../packages/ecs/src/systems/mesh3d/mesh-gpu-cache';
import { svgElementsToExtrudedNodes } from '../packages/ecs/src/utils/deserialize/svg';
import { buildPathExtrusionMesh } from '../packages/ecs/src/utils/path-extrusion-mesh';
import { fakeMeshGPU } from '../__tests__/ecs/helpers/mesh-gpu';

const SEGMENTS = 1000;
const INSTANCES = 20;

function sampleSvg(): string {
  const points = Array.from({ length: SEGMENTS }, (_, index) => {
    const angle = (index * Math.PI * 2) / SEGMENTS;
    const radius = 100 + 12 * Math.sin(angle * 19);
    return `${(radius * Math.cos(angle) + 120).toFixed(3)} ${(
      radius * Math.sin(angle) +
      120
    ).toFixed(3)}`;
  });
  const path = `M${points.join(' L')} Z`;
  const uses = Array.from(
    { length: INSTANCES },
    (_, index) => `<use href="#motif" x="${index * 260}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="5200" height="240">
    <defs><path id="motif" d="${path}" fill="#3366dd"/></defs>${uses}</svg>`;
}

test('measure SVG import, mesh preparation and GPU buffer allocation', () => {
  const source = sampleSvg();
  const start = performance.now();
  const svg = new JSDOM(source, { contentType: 'image/svg+xml' }).window
    .document.documentElement as unknown as SVGSVGElement;
  const parsedMs = performance.now() - start;
  const importStart = performance.now();
  const nodes = svgElementsToExtrudedNodes(svg, 40);
  const importedMs = performance.now() - importStart;
  const paths = nodes.filter((node) => node.type === 'path' && node.extrude3d);
  expect(paths).toHaveLength(INSTANCES);

  const meshStart = performance.now();
  const meshes = paths.map((node) => {
    const mesh = buildPathExtrusionMesh(node.d, node.fillRule);
    if (!mesh) throw new Error(`Failed to extrude ${node.id}`);
    return new Mesh3D(mesh.geometry);
  });
  const meshMs = performance.now() - meshStart;
  const gpu = fakeMeshGPU();
  const cache = new MeshGPUCache(gpu.device);
  const uploadStart = performance.now();
  for (let index = 0; index < meshes.length; index++)
    cache.get(index, meshes[index]);
  const uploadMs = performance.now() - uploadStart;
  const stats = cache.stats();
  const cpuPositionBuffers = new Set(meshes.map((mesh) => mesh.positions)).size;
  expect(stats.instances).toBe(INSTANCES);
  expect(stats.uniqueGeometries).toBe(cpuPositionBuffers);
  console.log(
    JSON.stringify({
      segments: SEGMENTS,
      instances: INSTANCES,
      parsedMs: +parsedMs.toFixed(2),
      importedMs: +importedMs.toFixed(2),
      meshMs: +meshMs.toFixed(2),
      uploadMs: +uploadMs.toFixed(2),
      cpuPositionBuffers,
      ...stats,
      verticesPerMesh: meshes[0].vertexCount,
    }),
  );
  cache.destroy();
  gpu.scope.dispose();
});
