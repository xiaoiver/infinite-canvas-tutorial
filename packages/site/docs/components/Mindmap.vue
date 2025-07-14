<script setup lang="ts">
import { Canvas, Rect, Path } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import { mindmap } from '@antv/hierarchy';

let canvas: Canvas;
let stats: any;

const wrapper = ref<HTMLCanvasElement | null>(null);

function measureText(text: string, fontSize: number) {
  const $canvas = document.createElement('canvas');
  const ctx = $canvas.getContext('2d');
  ctx!.font = `${fontSize}px Courier, monospace`;
  return ctx!.measureText(text).width;
}

function drawNode(node) {
  const origin = node.data;
  // const color = randomColor();
  const x = Math.round(node.x + node.hgap);
  const y = Math.round(node.y + node.vgap);
  const width = Math.round(node.width - node.hgap * 2);
  const height = Math.round(node.height - node.vgap * 2);

  // node
  const rect = new Rect({
    x,
    y: origin.isRoot ? y : y - 18,
    width,
    height,
    fill: 'red',
  });
  canvas.appendChild(rect);

  // node
  // const text = new Text({
  //   x: x + PEM * 0.8,
  //   y: y + (origin.isRoot ? PEM * 2 : PEM * 1),
  //   content: origin.label || 'none',
  //   fontSize: PEM,
  //   fill: '#666',
  // });
  // canvas.appendChild(text);
}

function drawLink(n, c) {
  let beginNode = n;
  let endNode = c;
  let side = 'right';
  if (n.x > c.x) {
    side = 'left';
    beginNode = c;
    endNode = n;
  }
  let beginX = Math.round(beginNode.x + beginNode.width - beginNode.hgap);
  let beginY = Math.round(beginNode.y + beginNode.height / 2);
  let endX = Math.round(endNode.x + endNode.hgap);
  let endY = Math.round(endNode.y + endNode.height / 2);
  if (beginNode.isRoot()) {
    beginX = Math.round(beginNode.x + beginNode.width / 2);
    beginY = Math.round(beginNode.y + beginNode.height / 2);
  }
  if (endNode.isRoot()) {
    endX = Math.round(endNode.x + endNode.width / 2);
    endY = Math.round(endNode.y + endNode.height / 2);
  }
  const line = new Path({
    stroke: 'black',
    strokeWidth: 4,
    fill: 'none',
    d: (side === 'right' ? `M${beginX},${beginY} ` : `M${beginNode.x + beginNode.hgap},${beginY} L${beginX},${beginY} `) + `C${Math.round(beginX + (beginNode.hgap + endNode.hgap) / 2)},${beginY} ${Math.round(endX - (beginNode.hgap + endNode.hgap) / 2)},${endY} ${endX},${endY}`
      + (side === 'right' ? `L${endX + endNode.width - endNode.hgap * 2},${endY}` : ''),
  });
  canvas.appendChild(line);
}

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  import('stats.js').then(m => {
    const Stats = m.default;
    stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';
    $canvas.parentElement!.appendChild($stats);
  });

  $canvas.addEventListener('ic-ready', async (e) => {
    canvas = (e as any).detail;

    {
      const res = await fetch('/data/mind.json');
      const root = await res.json();
      Object.assign(root, {
        isRoot: true
      });

      const rootNode = mindmap(root, {
        direction: 'H',
        getHeight(d) {
          if (d.isRoot) {
            return 60;
          }
          return 30;
        },
        getWidth(d) {
          const padding = d.isRoot ? 40 : 30;
          const fontSize = d.isRoot ? 24 : 16;
          return (
            measureText(d.id, fontSize) + padding
          );
        },
        getVGap: () => 6,
        getHGap: () => 60,
        getSubTreeSep(d) {
          if (!d.children || !d.children.length) {
            return 0;
          }
          return 20;
        }
      });

      rootNode.eachNode(node => {

        node.children.forEach(child => {
          drawLink(node, child);
        });

        drawNode(node);
      });

      canvas.root.position.x = 1000;
      canvas.root.position.y = 750;
    }
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats?.update();
  });
});
</script>

<template>
  <div style="position: relative;">
    <ic-canvas ref="wrapper" style="height: 500px" zoom="32"></ic-canvas>
  </div>
</template>
