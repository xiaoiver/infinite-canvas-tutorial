<script setup>
import { Text, loadBitmapFont, Path } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';

let canvas;
let stats;

const wrapper = ref(null);

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
        $canvas.parentElement.appendChild($stats);
    });

    $canvas.addEventListener('ic-ready', async (e) => {
        canvas = e.detail;

        const res = await window.fetch('/fonts/msdf-sans-serif.json');
        const font = await loadBitmapFont.parse(await res.text());

        const text = new Text({
            x: 0,
            y: 0,
            // content: 'Hello world',
            content: 'Quick brown fox jumps over the lazy dog.',
            fontSize: 15,
            fill: '#F67676',
            fontFamily: 'sans-serif',
            bitmapFont: font,
            // path: "M0 0 L 1000 1000",
            path: "M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"
            // side: 'right',
            // startOffset: 100,
        });
        canvas.appendChild(text);
        text.position.x = 100;

        const path = new Path({
            d: "M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50",
            stroke: '#000',
            strokeWidth: 1,
            fill: 'none',
        });
        canvas.appendChild(path);
        path.position.x = 100;
    });

    $canvas.addEventListener('ic-frame', (e) => {
        stats?.update();
    });
});
</script>

<template>
    <div style="position: relative">
        <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
    </div>
</template>
