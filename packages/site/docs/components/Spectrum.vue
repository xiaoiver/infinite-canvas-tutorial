<script setup lang="ts">
import {
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
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted } from 'vue';

const wrapper = ref(null);

onMounted(() => {
  import('@infinite-canvas-tutorial/webcomponents/spectrum');
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  canvas.addEventListener('ic-ready', (e) => {
    const app = e.detail;
    app.addSystems(PreStartUp, StartUpSystem);
  });

  class StartUpSystem extends System {
    private readonly commands = new Commands(this);

    q = this.query(
      (q) =>
        q.using(
          Camera,
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

    initialize() {
      const nodes = svgElementsToSerializedNodes(
        Array.from(this.$svg.children) as SVGElement[],
        0,
        [],
        undefined,
      );

      this.entities = serializedNodesToEntities(nodes, this.commands);
      this.commands.execute();
    }

    execute() {
      this.cameras.added.forEach((camera) => {
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

});
</script>

<template>
  <div style="position: relative">
    <ic-spectrum-canvas ref="wrapper"></ic-spectrum-canvas>
  </div>
</template>