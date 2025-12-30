<script setup lang="ts">
import {
    App,
    Pen,
    DefaultPlugins,
    RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
import { LaserPointerPlugin } from '@infinite-canvas-tutorial/laser-pointer';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;

onMounted(async () => {
    const canvas = wrapper.value;
    if (!canvas) {
        return;
    }

    onReady = async (e) => {
        api = e.detail;

        api.setAppState({
            ...api.getAppState(),
            penbarSelected: Pen.SELECT,
            penbarAll: [Pen.SELECT, Pen.DRAW_RECT],
            snapToPixelGridEnabled: true,
            snapToPixelGridSize: 10,
        });

        const node: RectSerializedNode = {
            id: 'snap-to-pixel-grid-1',
            type: 'rect',
            x: 200,
            y: 100,
            width: 200,
            height: 100,
            fill: '#e0f2ff',
            fillOpacity: 0.5,
            stroke: '#147af3',
            strokeWidth: 1,
        };

        api.updateNode(node);
        api.selectNodes([node]);
        api.record();
    };

    canvas.addEventListener(Event.READY, onReady);

    // App only runs once
    if (!(window as any).worldInited) {
        (window as any).worldInited = true;
        await import('@infinite-canvas-tutorial/webcomponents/spectrum');
        new App().addPlugins(...DefaultPlugins, UIPlugin, LaserPointerPlugin).run();
    } else {
        // 等待组件更新完成后检查API是否已经准备好
        setTimeout(() => {
            // 检查canvas的apiProvider是否已经有值
            const canvasElement = canvas as any;
            if (canvasElement.apiProvider?.value) {
                // 如果API已经准备好，手动触发onReady
                const readyEvent = new CustomEvent(Event.READY, {
                    detail: canvasElement.apiProvider.value
                });
                onReady?.(readyEvent);
            } else {
                // 如果API还没准备好，监听API的变化
                let checkCount = 0;
                const checkInterval = setInterval(() => {
                    checkCount++;
                    if (canvasElement.apiProvider?.value) {
                        clearInterval(checkInterval);
                        const readyEvent = new CustomEvent(Event.READY, {
                            detail: canvasElement.apiProvider.value
                        });
                        onReady?.(readyEvent);
                    } else if (checkCount > 50) { // 5秒超时
                        clearInterval(checkInterval);
                        console.warn('Canvas API initialization timeout');
                    }
                }, 100);
            }
        }, 100);
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

<template>
    <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
</template>