<script setup>
import { Path, TesselationMethod } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { ref, onMounted } from 'vue';
import opentype from 'opentype.js';

let canvas;

const wrapper = ref(null);

onMounted(() => {
    const $canvas = wrapper.value;

    if (!$canvas) return;

    $canvas.addEventListener('ic-ready', async(e) => {
        canvas = e.detail;

        const buffer = await (await window.fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer();
        const font = opentype.parse(buffer);

        let d = '';
        font.getPath('Hello, world!', 100, 100, 32).commands.forEach((command) => {
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

        const path = new Path({
            d,
            fill: '#F67676',
            tessellationMethod: TesselationMethod.EARCUT,
            // wireframe: true,
        });
        canvas.appendChild(path);
    });
});
</script>

<template>
    <div style="position: relative">
        <ic-canvas ref="wrapper" style="height: 200px"></ic-canvas>
    </div>
</template>

