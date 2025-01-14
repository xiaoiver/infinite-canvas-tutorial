<script setup>
import { Text } from '@infinite-canvas-tutorial/core';
import '@infinite-canvas-tutorial/ui';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';
import init from "harfbuzzjs/hb.wasm?init";
import hbjs, { HBBlob, HBFace, HBFont, HBHandle } from "harfbuzzjs/hbjs.js";

let canvas;

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
        const hb = hbjs(instance);

        const data = await (await window.fetch('/fonts/NotoSans-Regular.ttf')).arrayBuffer();

        const blob = hb.createBlob(data);
        const face = hb.createFace(blob, 0);
        const font = hb.createFont(face);

        console.log(font);

        // const text = new Text({
        //     x: 50,
        //     y: 100,
        //     content: 'Hello, world! \n🌹🌍🌞🌛',
        //     fontSize: 30,
        //     fill: '#F67676',
        // });
        // canvas.appendChild(text);
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
