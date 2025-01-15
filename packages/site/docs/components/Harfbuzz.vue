<script setup>
import { Path } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { ref, onMounted, onUnmounted } from 'vue';
import Stats from 'stats.js';
import init from "harfbuzzjs/hb.wasm?init";
import hbjs from "harfbuzzjs/hbjs.js";

let canvas;
let hb;
let blob;
let face;
let font;
let buffer;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

onMounted(() => {
    const $canvas = wrapper.value;

    if (!$canvas) return;

    $canvas.parentElement.appendChild($stats);

    $canvas.addEventListener('ic-ready', async (e) => {
        canvas = e.detail;

        const instance = await init();
        hb = hbjs(instance);

        const data = await (await window.fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer();

        blob = hb.createBlob(data);
        face = hb.createFace(blob, 0);
        font = hb.createFont(face);
        font.setScale(32, 32);
        font.setVariations({ wdth: 200, wght: 700 });

        buffer = hb.createBuffer();
        buffer.addText('H');
        buffer.guessSegmentProperties();
        // TODO: use BiDi
        // buffer.setDirection(segment.direction);

        hb.shape(font, buffer);
        const result = buffer.json(font);
        buffer.destroy();

        const base = { x: 0, y: 0 };
        const glyphs = new Array();
        for (const glyph of result) {
            glyphs.push({
                id: glyph.g,
                base: { x: base.x + glyph.dx, y: base.y + glyph.dy },
            });
            base.x += glyph.ax;
            base.y += glyph.ay;
        }

        const bounds = { width: base.x, height: face.upem };

        window.console.log(glyphs, bounds);

        result.forEach(function (x) {
            const d = font.glyphToPath(x.g);
            const path = new Path({
                d,
                fill: '#F67676',
            });
            canvas.appendChild(path);

            path.position.x = 100;
            path.position.y = 100;
        });
    });

    $canvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});

onUnmounted(() => {
    blob?.destroy();
    face?.destroy();
    font?.destroy();
    buffer?.destroy();
});
</script>

<template>
    <div style="position: relative">
        <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
    </div>
</template>
