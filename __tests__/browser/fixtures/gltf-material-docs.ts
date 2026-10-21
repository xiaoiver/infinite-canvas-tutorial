import { createApp } from 'vue';
import GltfMaterial from '../../../packages/site/docs/components/GltfMaterial.vue';
import {
  Material3D,
  Mesh3D,
  Mesh3DNode,
  type API,
} from '../../../packages/ecs/src';
import { settleECSFrames } from './ecs-frames';

let api: API | undefined;
const app = createApp(GltfMaterial);
app.mount('#demo');
document.querySelector('ic-spectrum-canvas')!.addEventListener(
  'ic-ready',
  (event) => {
    api = (event as CustomEvent<API>).detail;
  },
  { once: true },
);

const probe = {
  ready: () => {
    const node = api?.getNodeById('normal-tangent-test');
    if (!api || !node) return false;
    const mesh = api.getEntity(node).read(Mesh3DNode).meshEntity;
    return !!mesh && mesh.read(Mesh3D).positions.length > 1000;
  },
  material: () => {
    const source = api!.getEntity(api!.getNodeById('normal-tangent-test')!);
    const material = source.read(Mesh3DNode).meshEntity!.read(Material3D);
    return {
      normalMap: material.normalMap,
      occlusionMap: material.occlusionMap,
      doubleSided: material.doubleSided,
    };
  },
  settle: () => settleECSFrames(api!),
  unmount: () => app.unmount(),
};
declare global {
  interface Window {
    gltfMaterialDocs: typeof probe;
  }
}
window.gltfMaterialDocs = probe;
