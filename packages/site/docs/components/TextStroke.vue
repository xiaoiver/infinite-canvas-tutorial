<script setup>
import { Text, loadBitmapFont } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

onMounted(() => {
    import('@infinite-canvas-tutorial/ui');

    const $canvas = wrapper.value;

    if (!$canvas) return;

    $canvas.parentElement.appendChild($stats);

    $canvas.addEventListener('ic-ready', async (e) => {
        canvas = e.detail;

        const text = new Text({
            x: 50,
            y: 100,
            content: 'Hello, world!',
            fontSize: 45,
            fill: '#F67676',
            stroke: 'black',
            strokeWidth: 8,
        });
        canvas.appendChild(text);

        const res = await window.fetch('/fonts/msdf-sans-serif.json');
        const font = await loadBitmapFont.parse(await res.text());

        {
            const text = new Text({
                x: 50,
                y: 150,
                content: 'Hello, world!',
                fontSize: 45,
                fill: '#F67676',
                fontFamily: 'sans-serif',
                bitmapFont: font,
                stroke: 'black',
                strokeWidth: 8,
            });
            canvas.appendChild(text);
        }
    });

    $canvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
</script>

<template>
    <div style="position: relative">
        <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
    </div>
</template>
