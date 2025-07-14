<script setup>
import { Text, loadBitmapFont } from '@infinite-canvas-tutorial/core';
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

        // const text = new Text({
        //     x: 50,
        //     y: 100,
        //     content: 'Hello, world!',
        //     fontSize: 30,
        //     fill: '#F67676',
        //     decorationColor: '#000000',
        //     decorationLine: 'underline',
        //     decorationStyle: 'solid',
        //     decorationThickness: 4,
        // });
        // canvas.appendChild(text);

        const res = await window.fetch('/fonts/msdf-sans-serif.json');
        const font = await loadBitmapFont.parse(await res.text());

        {
            const text = new Text({
                x: 50,
                y: 100,
                content: 'I\'d far rather be \nhappy than right any day.',
                fontSize: 45,
                fill: '#F67676',
                fontFamily: 'sans-serif',
                bitmapFont: font,
                decorationColor: '#000000',
                decorationLine: 'underline',
                // decorationLine: 'line-through',
                // decorationStyle: 'solid',
                decorationStyle: 'wavy',
                decorationThickness: 4,
            });
            canvas.appendChild(text);

            // const polyline = new Polyline({
            //     points: [
            //         [50, 100],
            //         [50, 200],
            //         [100, 200],
            //         [NaN, NaN],
            //         [150, 200],
            //         [150, 100],
            //         [NaN, NaN],
            //         [250, 200],
            //         [250, 100],
            //     ],
            //     stroke: 'red',
            //     strokeWidth: 10,
            //     strokeDasharray: [5, 10],
            //     wireframe: true,
            // });
            // canvas.appendChild(polyline);
        }
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
