<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  API,
  SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin, ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import opentype from 'opentype.js';
import { svgPathProperties } from 'svg-path-properties';
import ClipperLib from 'clipper-lib';
import { Pane } from 'tweakpane';

const wrapper = ref<HTMLElement | null>(null);
let api: ExtendedAPI | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

function char2Path(font: opentype.Font, char: string, { fontSize, x, y }: { fontSize: number, x: number, y: number }) {
  let d = '';
  font.getPath(char, x, y, fontSize).commands.forEach((command) => {
    if (command.type === 'M' || command.type === 'L') {
      d += command.type + ' ' + command.x.toFixed(3) + ' ' + command.y.toFixed(3);
    } else if (command.type === 'C') {
      d += 'C ' + command.x1.toFixed(3) + ' ' + command.y1.toFixed(3) + ' ' + command.x2.toFixed(3) + ' ' + command.y2.toFixed(3) + ' ' + command.x.toFixed(3) + ' ' + command.y.toFixed(3);
    } else if (command.type === 'Q') {
      d += 'Q ' + command.x1.toFixed(3) + ' ' + command.y1.toFixed(3) + ' ' + command.x.toFixed(3) + ' ' + command.y.toFixed(3);
    } else if (command.type === 'Z') {
      d += 'Z ';
    }
  });
  return d;
}

function path2Polygon(path: string) {
  const properties = new svgPathProperties(path);
  const length = properties.getTotalLength();

  const numPoints = 200; // 根据需要调整精度
  const polygon: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const point = properties.getPointAtLength((i / numPoints) * length);
    polygon.push([point.x, point.y]);
  }

  return polygon;
}

function intersect(subject: [number, number][], clip: [number, number][]): [number, number][][] {
  const subj = new ClipperLib.Path();
  const clips = new ClipperLib.Path();

  subj.push(...subject.map(([x, y]) => new ClipperLib.IntPoint(x, y)));
  clips.push(...clip.map(([x, y]) => new ClipperLib.IntPoint(x, y)));

  const solution = new ClipperLib.Paths();
  const c = new ClipperLib.Clipper();
  c.AddPath(subj, ClipperLib.PolyType.ptSubject, true);
  c.AddPath(clips, ClipperLib.PolyType.ptClip, true);
  c.Execute(ClipperLib.ClipType.ctIntersection, solution);

  return solution.map((path) => path.map((point) => [point.X, point.Y]));
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  const PARAMS = {
    message: '你好世界',
    // fontFamily: 'NotoSans',
    fontFamily: 'LXGW',
    color1: { r: 235, g: 113, b: 139 },
    color2: { r: 174, g: 219, b: 163 },
    color3: { r: 127, g: 127, b: 209 },
    color4: { r: 203, g: 203, b: 33 },
    color5: { r: 255, g: 255, b: 255 },
    intersect: { r: 0, g: 0, b: 255 },
    density: 1,
  };

  const fonts = {
    LXGW: {
      url: '/fonts/LXGWWenKaiLite-Light.ttf',
      fontFamily: 'LXGW',
      font: null,
    },
    NotoSans: {
      url: '/fonts/NotoSans-Regular.ttf',
      fontFamily: 'NotoSans',
      font: null,
    }
  };
  let input = PARAMS.message.split('');
  let texts: SerializedNode[] = [];
  let polygons: SerializedNode[] = [];
  let font: opentype.Font | null = null;

  async function generate(fontFamily: string, density: number, regeneratePolygonsOnly = false) {
    if (!fonts[fontFamily].font) {
      const buffer = await (await fetch(fonts[fontFamily].url)).arrayBuffer();
      fonts[fontFamily].font = opentype.parse(buffer);
    }

    font = fonts[fontFamily].font;

    if (texts.length > 0 && !regeneratePolygonsOnly) {
      api?.deleteNodesById(texts.map((text) => text.id));
    }
    if (polygons.length > 0) {
      api?.deleteNodesById(polygons.map((polygon) => polygon.id));
    }

    const fontSize = 300;
    const x = 200;
    const y = 400;

    const paths = input.map((char) => {
      return path2Polygon(char2Path(font!, char, { fontSize, x, y }));
    });
    // 两两组合 polygons
    const results: [number, number][][][] = [];
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        results.push(intersect(paths[i], paths[j]));
      }
    }
    const result = results[0].slice(0, Math.floor(results[0].length * density));

    if (!regeneratePolygonsOnly) {
      texts = input.map((char, index) => {
        return {
          id: `text-${index}`,
          type: 'text',
          fontFamily,
          fontSize,
          anchorX: x,
          anchorY: y,
          content: char,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          fill: 'none',
          stroke: `rgb(${Math.round(PARAMS[`color${index + 1}`].r)}, ${Math.round(PARAMS[`color${index + 1}`].g)}, ${Math.round(PARAMS[`color${index + 1}`].b)})`,
          strokeWidth: 6,
        };
      });
    }

    polygons = result.map((path, index) => {
      const d = 'M ' + path.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L ') + ' Z';
      return {
        id: `path-${index}`,
        type: 'path',
        d,
        fill: `rgb(${Math.round(PARAMS.intersect.r)}, ${Math.round(PARAMS.intersect.g)}, ${Math.round(PARAMS.intersect.b)})`,
        stroke: `rgb(${Math.round(PARAMS.intersect.r)}, ${Math.round(PARAMS.intersect.g)}, ${Math.round(PARAMS.intersect.b)})`,
        strokeWidth: 6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        x,
        y,
      };
    });

    api?.runAtNextTick(() => {
      api?.updateNodes([
        ...(regeneratePolygonsOnly ? [] : texts),
        ...polygons,
      ]);
    });
  }

  const pane = new Pane({
    container: document.getElementById('tweakpane')!,
  });

  pane.addBinding(PARAMS, 'message').on('change', (ev) => {
    // 取前五个字
    input = ev.value.slice(0, 5).split('');
    generate(PARAMS.fontFamily, PARAMS.density);
  });
  pane.addBlade({
    view: 'list',
    label: 'font',
    options: [
      { text: 'LXGWWenKaiLite', value: 'LXGW' },
      { text: 'NotoSans', value: 'NotoSans' },
    ],
    value: PARAMS.fontFamily,
    // @ts-ignore
  }).on('change', (e) => {
    generate(e.value, PARAMS.density);
  });
  pane.addBlade({
    view: 'slider',
    label: 'density',
    min: 0,
    max: 1,
    value: 0.5,
    // @ts-ignore
  }).on('change', (e) => {
    generate(PARAMS.fontFamily, e.value, true);
  });
  const f1 = pane.addFolder({
    title: 'Palette',
  });
  f1.addBinding(PARAMS, 'color1').on('change', (ev) => {
    if (input.length >= 1) {
      api?.updateNode({
        id: 'text-0',
        stroke: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
      });
    }
  });
  f1.addBinding(PARAMS, 'color2').on('change', (ev) => {
    if (input.length >= 2) {
      api?.updateNode({
        id: 'text-1',
        stroke: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
      });
    }
  });
  f1.addBinding(PARAMS, 'color3').on('change', (ev) => {
    if (input.length >= 3) {
      api?.updateNode({
        id: 'text-2',
        stroke: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
      });
    }
  });
  f1.addBinding(PARAMS, 'color4').on('change', (ev) => {
    if (input.length >= 4) {
      api?.updateNode({
        id: 'text-3',
        stroke: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
      });
    }
  });
  f1.addBinding(PARAMS, 'color5').on('change', (ev) => {
    if (input.length >= 5) {
      api?.updateNode({
        id: 'text-4',
        stroke: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
      });
    }
  });
  f1.addBinding(PARAMS, 'intersect').on('change', (ev) => {
    polygons.forEach((polygon) => {
      api?.updateNode({
        id: polygon.id,
        stroke: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
        fill: `rgb(${Math.round(ev.value.r)}, ${Math.round(ev.value.g)}, ${Math.round(ev.value.b)})`,
      });
    });
  });

  onReady = async (e) => {
    api = e.detail as ExtendedAPI;

    api.setAppState({
      ...api.getAppState(),
      contextBarVisible: false,
      penbarVisible: false,
      taskbarVisible: false,
      rotateEnabled: false,
      flipEnabled: false,
    });
    api.setPen(Pen.SELECT);

    const module = await import('webfontloader');
    const WebFont = module.default;
    WebFont.load({
      custom: {
        families: ['LXGW', 'NotoSans'],
      },
      active: async () => {
        generate(PARAMS.fontFamily, PARAMS.density);
      }
    });
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
  }
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  api?.destroy();
});
</script>

<style>
@font-face {
  font-family: 'LXGW';
  src: url('/fonts/LXGWWenKaiLite-Light.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'NotoSans';
  src: url('/fonts/NotoSans-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

#tweakpane {
  width: 256px;
  position: absolute;
  top: 48px;
  right: 0;
}
</style>

<style>
:root {
  --tp-base-background-color: hsla(230, 5%, 90%, 1.00);
  --tp-base-shadow-color: hsla(0, 0%, 0%, 0.10);
  --tp-button-background-color: hsla(230, 7%, 75%, 1.00);
  --tp-button-background-color-active: hsla(230, 7%, 60%, 1.00);
  --tp-button-background-color-focus: hsla(230, 7%, 65%, 1.00);
  --tp-button-background-color-hover: hsla(230, 7%, 70%, 1.00);
  --tp-button-foreground-color: hsla(230, 10%, 30%, 1.00);
  --tp-container-background-color: hsla(230, 15%, 30%, 0.20);
  --tp-container-background-color-active: hsla(230, 15%, 30%, 0.32);
  --tp-container-background-color-focus: hsla(230, 15%, 30%, 0.28);
  --tp-container-background-color-hover: hsla(230, 15%, 30%, 0.24);
  --tp-container-foreground-color: hsla(230, 10%, 30%, 1.00);
  --tp-groove-foreground-color: hsla(230, 15%, 30%, 0.10);
  --tp-input-background-color: hsla(230, 15%, 30%, 0.10);
  --tp-input-background-color-active: hsla(230, 15%, 30%, 0.22);
  --tp-input-background-color-focus: hsla(230, 15%, 30%, 0.18);
  --tp-input-background-color-hover: hsla(230, 15%, 30%, 0.14);
  --tp-input-foreground-color: hsla(230, 10%, 30%, 1.00);
  --tp-label-foreground-color: hsla(230, 10%, 30%, 0.70);
  --tp-monitor-background-color: hsla(230, 15%, 30%, 0.10);
  --tp-monitor-foreground-color: hsla(230, 10%, 30%, 0.50);
}
</style>

<template>
  <div style="position: relative;">
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 600px"></ic-spectrum-canvas>
    <div id="tweakpane"></div>
  </div>
</template>