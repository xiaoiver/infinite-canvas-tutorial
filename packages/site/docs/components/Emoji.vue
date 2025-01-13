<script setup>
import { Text } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { useTemplateRef, onMounted } from 'vue';
import Stats from 'stats.js';

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const canvasRef = useTemplateRef('canvas');

onMounted(() => {
    const $canvas = canvasRef.value;

    if (!$canvas) return;

    $canvas.parentElement.appendChild($stats);

    $canvas.addEventListener('ic-ready', (e) => {
        canvas = e.detail;

        const text = new Text({
            x: 50,
            y: 100,
            content: '🌹🌍🌞🌛',
            fontSize: 30,
            fill: '#F67676',
        });
        canvas.appendChild(text);
    });

    $canvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
</script>

<template>
    <div style="position: relative">
        <ic-canvas ref="canvas" style="height: 200px"></ic-canvas>
    </div>
</template>
