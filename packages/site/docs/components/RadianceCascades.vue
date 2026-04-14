<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  RendererPlugin,
  DefaultRendererPlugin,
  CheckboardStyle,
  ThemeMode,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import {
  registerMermaidPasteStyler,
  unregisterMermaidPasteStyler,
} from '@infinite-canvas-tutorial/webcomponents/spectrum';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';
import { LassoPlugin } from '@infinite-canvas-tutorial/lasso';
import { EraserPlugin } from '@infinite-canvas-tutorial/eraser';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import {
  InitVello,
  VelloPipeline,
  registerFont,
} from '@infinite-canvas-tutorial/vello';
import { parseMermaidToSerializedNodes } from '@infinite-canvas-tutorial/mermaid';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((e: CustomEvent<any>) => void) | undefined;

function styleRadianceMermaidNodes(nodes: SerializedNode[]) {
  nodes.forEach((node) => {
    if (node.type === 'rect') {
      node.fill = 'black';
      node.strokeWidth = 0;
    } else if (node.type === 'line') {
      node.stroke = '#454343';
    } else if (node.type === 'polyline') {
      node.stroke = '#454343';
      node.markerFactor = 6;
    } else if (node.type === 'text') {
      node.fontFamily = 'Gaegu';
      node.fill = 'white';
      node.stroke = 'none';
    } else if (node.type === 'path') {
      node.fill = '#454343';
      node.strokeWidth = 0;
    }
  });
}
const giStrength = ref(0.1);

/** Ready-to-paste Mermaid snippets (styled via registerMermaidPasteStyler). */
const mermaidPasteExamples: { id: string; title: string; description: string; code: string }[] = [
  {
    id: 'flowchart-td',
    title: 'Flowchart (top-down)',
    description: 'Diamond decisions, labeled edges, and common node shapes.',
    code: `flowchart TD
  A[Christmas] -->|Get money| B(Go shopping)
  B --> C{Let me think}
  C -->|One| D[Laptop]
  C -->|Two| E[iPhone]
  C -->|Three| F[Car]`,
  },
  {
    id: 'flowchart-bidir',
    title: 'Bidirectional edges',
    description: 'Two-way links: o--o, <-->, x--x.',
    code: `flowchart LR
  A o--o B
  B <--> C
  C x--x D`,
  },
  {
    id: 'flowchart-simple',
    title: 'Simple left-to-right',
    description: 'LR direction with basic shapes.',
    code: `flowchart LR
  Start([Start]) --> Step[Process]
  Step --> End([End])`,
  },
  {
    id: 'sequence',
    title: 'Sequence diagram (excerpt)',
    description: 'Actors and messages; paste to render on the canvas.',
    code: `sequenceDiagram
  Alice->>John: Hello John, how are you?
  John-->>Alice: Great!
  Alice-)John: See you later!`,
  },
];

const copiedExampleId = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyMermaidExample(code: string, id: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedExampleId.value = id;
    if (copiedTimer) {
      clearTimeout(copiedTimer);
    }
    copiedTimer = setTimeout(() => {
      copiedExampleId.value = null;
    }, 2000);
  } catch {
    // Fallback: user can still select and copy manually
  }
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  onReady = async (e) => {
    api = e.detail;
    registerMermaidPasteStyler(api, styleRadianceMermaidNodes);

    api.setAppState({
      ...api.getAppState(),
      cameraZoom: 0.53,
      cameraX: -300,
      cameraY: -100,
      penbarSelected: Pen.SELECT,
      checkboardStyle: CheckboardStyle.NONE,
      themeMode: ThemeMode.DARK,
      penbarDrawRect: {
        ...api.getAppState().penbarDrawRect,
        fill: 'yellow',
        fillOpacity: 1,
        strokeWidth: 0,
      },
      penbarDrawEllipse: {
        ...api.getAppState().penbarDrawEllipse,
        fill: 'yellow',
        fillOpacity: 1,
        strokeWidth: 0,
      },
      penbarDrawLine: {
        ...api.getAppState().penbarDrawLine,
        stroke: 'blue',
        strokeWidth: 6,
      },
      giEnabled: true,
      giStrength: 0.1,
    });

    const node1 = {
      id: 'radiance-rect-1',
      type: 'rect',
      x: 500,
      y: 120,
      width: 100,
      height: 100,
      fill: 'black',
    };
    const node2 = {
      id: 'radiance-rect-2',
      type: 'ellipse',
      x: -100,
      y: 0,
      width: 100,
      height: 100,
      fill: 'red',
    };
    const node3 = {
      id: 'radiance-rect-3',
      type: 'rect',
      x: 600,
      y: 550,
      width: 100,
      height: 200,
      rotation: Math.PI / 6,
      fill: 'green',
    };

    const line = {
      id: 'radiance-line-3',
      type: 'line',
      x1: -100,
      y1: 500,
      x2: 0,
      y2: 700,
      stroke: 'grey',
      strokeWidth: 10,
    };

    const polyline = {
      id: 'radiance-polyline-1',
      type: 'polyline',
      points: '400,100 500,200 600,100',
      stroke: 'grey',
      strokeWidth: 4,
      rotation: -Math.PI / 1.5,
    };

    api.updateNodes([
      node1, node2, node3,
      line, polyline,
    ]);

    const nodes = await parseMermaidToSerializedNodes(`flowchart TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[Car]`);
    styleRadianceMermaidNodes(nodes);
    // import('webfontloader').then((module) => {
    //   const WebFont = module.default;
    //   WebFont.load({
    //     google: {
    //       families: ['Gaegu'],
    //     },
    //     active: () => {
    api.runAtNextTick(() => {
      api.updateNodes(nodes);
    });
    //     }
    //   });
    // });
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    await import('@infinite-canvas-tutorial/lasso/spectrum');
    await import('@infinite-canvas-tutorial/eraser/spectrum');
    await import('@infinite-canvas-tutorial/laser-pointer/spectrum');

    const VelloRendererPlugin = RendererPlugin.configure({
      setupDeviceSystemCtor: InitVello,
      rendererSystemCtor: VelloPipeline,
    });
    DefaultPlugins.splice(
      DefaultPlugins.indexOf(DefaultRendererPlugin),
      1,
      VelloRendererPlugin,
    );
    registerFont('/fonts/NotoSans-Regular.ttf');
    registerFont('/fonts/Gaegu-Regular.ttf');

    new App()
      .addPlugins(
        ...DefaultPlugins,
        UIPlugin,
        LaserPointerPlugin,
        LassoPlugin,
        EraserPlugin,
        YogaPlugin,
      )
      .run();
  }
});

onUnmounted(async () => {
  if (copiedTimer) {
    clearTimeout(copiedTimer);
  }

  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  if (api) {
    unregisterMermaidPasteStyler(api);
  }

  api?.destroy();
});

const onGiStrengthChange = (e: CustomEvent<number>) => {
  if (!api) {
    return;
  }

  const giStrength = parseFloat((e.target as HTMLInputElement).value);
  api.setAppState({
    giStrength,
  });
};
</script>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 600px"></ic-spectrum-canvas>
  <label for="giStrength">GI Strength: {{ giStrength }}</label>
  <input id="giStrength" type="range" min="0" max="0.2" step="0.01" v-model="giStrength" @input="onGiStrengthChange" />

  <section class="mermaid-paste-examples" aria-label="Mermaid paste examples">
    <h3 class="mermaid-paste-examples__title">Mermaid examples (copy, then paste on the canvas)</h3>
    <p class="mermaid-paste-examples__hint">
      Paste while the canvas is focused to use the same styling as the demo above (dark theme, Gaegu font, etc.).
    </p>
    <article
      v-for="ex in mermaidPasteExamples"
      :key="ex.id"
      class="mermaid-paste-examples__card"
    >
      <header class="mermaid-paste-examples__head">
        <div>
          <h4 class="mermaid-paste-examples__card-title">{{ ex.title }}</h4>
          <p class="mermaid-paste-examples__desc">{{ ex.description }}</p>
        </div>
        <button
          type="button"
          class="mermaid-paste-examples__copy"
          @click="copyMermaidExample(ex.code, ex.id)"
        >
          {{ copiedExampleId === ex.id ? 'Copied' : 'Copy' }}
        </button>
      </header>
      <pre class="mermaid-paste-examples__pre"><code>{{ ex.code }}</code></pre>
    </article>
  </section>
</template>

<style scoped>
.mermaid-paste-examples {
  margin-top: 1.25rem;
  max-width: 52rem;
}

.mermaid-paste-examples__title {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.mermaid-paste-examples__hint {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  opacity: 0.85;
  line-height: 1.5;
}

.mermaid-paste-examples__card {
  margin-bottom: 1rem;
  border: 1px solid var(--vp-c-divider, rgba(128, 128, 128, 0.35));
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-soft, rgba(127, 127, 127, 0.08));
}

.mermaid-paste-examples__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--vp-c-divider, rgba(128, 128, 128, 0.25));
}

.mermaid-paste-examples__card-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.mermaid-paste-examples__desc {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  opacity: 0.85;
}

.mermaid-paste-examples__copy {
  flex-shrink: 0;
  padding: 0.35rem 0.65rem;
  font-size: 0.8rem;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider, rgba(128, 128, 128, 0.45));
  background: var(--vp-c-bg, transparent);
  color: inherit;
}

.mermaid-paste-examples__copy:hover {
  border-color: var(--vp-c-brand-1, #888);
}

.mermaid-paste-examples__pre {
  margin: 0;
  padding: 0.75rem 0.85rem;
  overflow: auto;
  font-size: 0.78rem;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.mermaid-paste-examples__pre code {
  font-family: inherit;
  white-space: pre;
}
</style>