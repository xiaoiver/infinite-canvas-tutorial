<script setup lang="ts">
import {
  Pen,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT],
    });

    const nodes = await parseMermaidToSerializedNodes(`classDiagram
  class Vehicle {
    +startEngine() void
    +stopEngine() void
  }

  class Car
  class Motorcycle
  class Engine
  class Driver {
    +drive(Vehicle vehicle) void
  }

  Vehicle <|-- Car : Inheritance
  Vehicle <|-- Motorcycle : Inheritance
  Vehicle *-- Engine : Composition
  Driver o-- Vehicle : Aggregation

  note for Vehicle "Base class for all transport types"
  note for Engine "Internal combustion or electric"

  style Vehicle fill:#f9f,stroke:#333,stroke-width:2px
  style Car fill:#bbf,stroke:#333,stroke-width:1px
  style Motorcycle fill:#bbf,stroke:#333,stroke-width:1px
  style Engine fill:#dfd,stroke:#333,stroke-width:1px
  style Driver fill:#ffd,stroke:#333,stroke-width:1px`);


    api.runAtNextTick(() => {
      api.updateNodes(nodes);
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  await ensureExampleWorld();
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

});
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 400px"
    app-state='{"topbarVisible":true, "cameraZoom": 0.38, "cameraX": -200, "cameraY": -100}'>
  </ic-spectrum-canvas>
</template>