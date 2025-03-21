<script setup lang="ts">
import {
  App,
  System,
  Commands,
  PreStartUp,
  Parent,
  Children,
  Transform,
  Renderable,
  FillSolid,
  Stroke,
  Circle,
  Camera,
  Entity,
  svgElementsToSerializedNodes,
  serializedNodesToEntities,
  Ellipse,
  Path,
  Polyline,
  Rect,
  Text,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import '@infinite-canvas-tutorial/webcomponents/spectrum';
import { ref, onMounted, onUnmounted } from 'vue';

const wrapper = ref(null);
let app: App;

const MyPlugin = () => {
  return [StartUpSystem];
};

class StartUpSystem extends System {
  private readonly commands = new Commands(this);

  constructor() {
    super();
    this.schedule((s) =>
      s.before(PreStartUp),
    );
    this.query(
      (q) =>
        q.using(
          Transform,
          Parent,
          Children,
          Renderable,
          FillSolid,
          Stroke,
          Circle,
          Ellipse,
          Rect,
          Polyline,
          Path,
          Text,
        ).write,
    );
  }

  cameras = this.query((q) => q.added.with(Camera));

  entities: Entity[];

  $svg: SVGSVGElement;

  async prepare() {
    const res = await fetch('/maslow-hierarchy.svg');
    const svg = await res.text();
    // TODO: extract semantic groups inside comments
    const $container = document.createElement('div');
    $container.innerHTML = svg;
    this.$svg = $container.children[0] as SVGSVGElement;
  }

  initialize(): void {
    const nodes = svgElementsToSerializedNodes(
      Array.from(this.$svg.children) as SVGElement[],
      0,
      [],
      undefined,
    );
    this.entities = serializedNodesToEntities(nodes, this.commands);
    this.commands.execute();
  }

  execute(): void {
    this.cameras.added.forEach((camera) => {
      // const $canvas = camera.read(Camera).canvas.read(Canvas).element;
      this.entities.forEach((entity) => {
        if (!entity.has(Children)) {
          this.commands
            .entity(camera)
            .appendChild(this.commands.entity(entity));
        }
      });
      this.commands.execute();
    });
  }
}

onMounted(async () => {
  // import('@infinite-canvas-tutorial/webcomponents/spectrum');
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  app = new App().addPlugins(...DefaultPlugins, UIPlugin, MyPlugin);
  await app.run();
  console.log('mounted');
});

onUnmounted(async () => {

  await app.exit();
  console.log('unmounted');
});
</script>

<template>
  <div style="position: relative">
    <ic-spectrum-canvas ref="wrapper"></ic-spectrum-canvas>
  </div>
</template>