<script setup>
import { fromSVGElement, deserializeNode } from '@infinite-canvas-tutorial/core';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';

/**
 * @see https://github.com/motion-canvas/motion-canvas/blob/13c9de85280cc1b893a178b9d6eecd8d639fd7bb/packages/2d/src/lib/components/Latex.ts#L32
 */
import {mathjax} from 'mathjax-full/js/mathjax';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html';
import {TeX} from 'mathjax-full/js/input/tex';
import {AllPackages} from 'mathjax-full/js/input/tex/AllPackages';
import {SVG} from 'mathjax-full/js/output/svg';

function renderMathJaxToSVGElement(formula) {
    const Adaptor = liteAdaptor();
    RegisterHTMLHandler(Adaptor);

    const JaxDocument = mathjax.document('', {
        InputJax: new TeX({packages: AllPackages}),
        OutputJax: new SVG({fontCache: 'local'}),
    });

    const svg = Adaptor.innerHTML(JaxDocument.convert(formula));
    if (svg.includes('data-mjx-error')) {
        window.console.error('MathJax 渲染错误');
        return;
    }

    const parser = new window.DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const $svg = doc.documentElement;

    return $svg;
}

let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

onMounted(() => {
    // @see https://vitepress.dev/guide/ssr-compat#importing-in-mounted-hook
    import('@infinite-canvas-tutorial/ui');

    const $canvas = wrapper.value;

    if (!$canvas) return;

    $canvas.parentElement.appendChild($stats);

    $canvas.addEventListener('ic-ready', async (e) => {
        canvas = e.detail;

        ['a^2 + b^2 = c^2', 'F(x) = \\frac{(1 + erf(\\frac{x}{\\sigma \\sqrt2}))}{2}'].forEach(async (formula, index) => {
            const $svg = renderMathJaxToSVGElement(formula);
            const root = await deserializeNode(fromSVGElement($svg));
            root.scale.x = 0.05;
            root.scale.y = 0.05;    
            root.position.x = 100;
            root.position.y = 100 * (index + 1);

            canvas.appendChild(root);
        });
    });

    $canvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
</script>

<template>
    <div style="position: relative">
        <ic-canvas ref="wrapper" style="height: 300px"></ic-canvas>
    </div>
</template>
