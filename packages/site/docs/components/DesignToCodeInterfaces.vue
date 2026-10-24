<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Highlighter } from 'shiki';
import {
  Pen,
  downloadIcDocument,
  type API,
  type CodeFramework,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';
import { interfaceScenes } from './design-to-code-scenes';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});

const canvasElement = ref<HTMLElement | null>(null);
const sceneId = ref(interfaceScenes[0].id);
const framework = ref<CodeFramework>('html-css');
const code = ref('');
const highlightedCode = ref('');
const ready = ref(false);
const notice = ref('');
const scene = computed(
  () => interfaceScenes.find((item) => item.id === sceneId.value)!,
);

let api: API | undefined;
let disposeSubscription: (() => void) | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let onReady: ((event: CustomEvent<API>) => void) | undefined;
let highlighterPromise: Promise<Highlighter> | undefined;

function getHighlighter() {
  highlighterPromise ??= import('shiki/bundle/web')
    .then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: ['html', 'tsx'],
      }),
    )
    .catch((error) => {
      highlighterPromise = undefined;
      throw error;
    });
  return highlighterPromise;
}

function fitCamera() {
  if (!api || !canvasElement.value) return;
  const zoom = Math.min(
    0.52,
    Math.max(0.2, (canvasElement.value.clientWidth - 128) / 1050),
  );
  api.setAppState({
    cameraZoom: zoom,
    cameraX: -64 / zoom,
    cameraY: -64 / zoom,
  });
}

function htmlDocument(fragment: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${scene.value.title}</title>
  <style>* { box-sizing: border-box; } body { margin: 0; }</style>
</head>
<body>
${fragment}</body>
</html>`;
}

function generateCode() {
  if (!api) return '';
  if (framework.value === 'html-css') {
    return htmlDocument(
      api.exportCode(undefined, {
        framework: 'html-css',
        variablesMode: 'css-var',
      }),
    );
  }
  return api.exportCode(undefined, {
    framework: 'react-tailwind',
    variablesMode: 'resolved',
    componentStructure: 'preserve',
    componentName: scene.value.componentName,
  });
}

function refreshCode() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = undefined;
  code.value = generateCode();
}

function scheduleCodeRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshCode, 250);
}

async function loadScene(id: string) {
  if (!api) return;
  const next = interfaceScenes.find((item) => item.id === id);
  if (!next) return;
  sceneId.value = id;
  ready.value = false;
  code.value = '';
  try {
    await api.edit(
      (editor) => {
        editor.setAppState(
          {
            variables: next.variables,
            penbarSelected: Pen.SELECT,
            penbarAll: [Pen.HAND, Pen.SELECT],
            topbarVisible: true,
          },
          { replaceVariables: true },
        );
        editor.replaceDocument(next.nodes, 'remote');
      },
      { capture: 'NEVER' },
    );
    fitCamera();
    refreshCode();
    ready.value = true;
    notice.value = '';
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error);
  }
}

async function copyCode() {
  const current = generateCode();
  code.value = current;
  try {
    await navigator.clipboard.writeText(current);
    notice.value = props.locale === 'zh' ? '已复制代码' : 'Code copied';
  } catch {
    notice.value =
      props.locale === 'zh'
        ? '复制失败，请手动选择代码'
        : 'Copy failed; select the code below';
  }
}

function downloadCode() {
  const current = generateCode();
  code.value = current;
  const extension = framework.value === 'html-css' ? 'html' : 'tsx';
  const url = URL.createObjectURL(new Blob([current], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${scene.value.id}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadDesign() {
  if (!api) return;
  downloadIcDocument(
    api.exportIcDocument(window.location.origin),
    `${scene.value.id}.ic`,
  );
}

watch(framework, refreshCode);
watch([code, framework], async ([source, format], _previous, onCleanup) => {
  let cancelled = false;
  onCleanup(() => {
    cancelled = true;
  });
  highlightedCode.value = '';
  if (!source) return;
  try {
    const highlighter = await getHighlighter();
    const html = highlighter.codeToHtml(source, {
      lang: format === 'html-css' ? 'html' : 'tsx',
      themes: { light: 'github-light', dark: 'github-dark' },
    });
    if (!cancelled) highlightedCode.value = html;
  } catch {
    // Keep the generated code readable if highlighting cannot load.
  }
});

onMounted(async () => {
  const canvas = canvasElement.value;
  if (!canvas) return;
  onReady = (event) => {
    api = event.detail;
    disposeSubscription = api.subscribe((_snapshot, changes) => {
      if (changes.nodesChanged || changes.appStateChanged)
        scheduleCodeRefresh();
    });
    void loadScene(sceneId.value);
  };
  canvas.addEventListener(Event.READY, onReady);
  canvas.addEventListener(Event.RESIZED, fitCamera);
  await ensureExampleWorld();
});

onUnmounted(() => {
  const canvas = canvasElement.value;
  if (canvas && onReady) canvas.removeEventListener(Event.READY, onReady);
  canvas?.removeEventListener(Event.RESIZED, fitCamera);
  if (refreshTimer) clearTimeout(refreshTimer);
  disposeSubscription?.();
  api = undefined;
});
</script>

<template>
  <div class="interface-demo">
    <div class="interface-demo-toolbar">
      <div
        class="interface-demo-tabs"
        role="group"
        :aria-label="locale === 'zh' ? '界面示例' : 'Interface example'"
      >
        <button
          v-for="item in interfaceScenes"
          :key="item.id"
          type="button"
          :aria-pressed="sceneId === item.id"
          :class="{ active: sceneId === item.id }"
          @click="loadScene(item.id)"
        >
          {{ locale === 'zh' ? item.titleZh : item.title }}
        </button>
      </div>
      <div
        class="interface-demo-tabs"
        role="group"
        :aria-label="locale === 'zh' ? '导出格式' : 'Export format'"
      >
        <button
          type="button"
          :aria-pressed="framework === 'html-css'"
          :class="{ active: framework === 'html-css' }"
          @click="framework = 'html-css'"
        >
          HTML/CSS
        </button>
        <button
          type="button"
          :aria-pressed="framework === 'react-tailwind'"
          :class="{ active: framework === 'react-tailwind' }"
          @click="framework = 'react-tailwind'"
        >
          React + Tailwind
        </button>
      </div>
    </div>

    <p class="interface-demo-description">
      {{ locale === 'zh' ? scene.descriptionZh : scene.description }}
    </p>
    <div class="interface-demo-canvas">
      <ic-spectrum-canvas
        ref="canvasElement"
        style="width: 100%; height: 560px"
        renderer="webgl"
        app-state='{"topbarVisible":true,"cameraZoom":0.52,"cameraX":-123,"cameraY":-123}'
      />
    </div>

    <div class="interface-demo-codebar">
      <strong>{{
        locale === 'zh'
          ? '从当前画布生成的代码'
          : 'Code from the current canvas'
      }}</strong>
      <div>
        <button type="button" :disabled="!ready" @click="loadScene(sceneId)">
          {{ locale === 'zh' ? '重置画布' : 'Reset canvas' }}
        </button>
        <button type="button" :disabled="!ready" @click="refreshCode">
          {{ locale === 'zh' ? '更新代码' : 'Refresh code' }}
        </button>
        <button type="button" :disabled="!ready" @click="copyCode">
          {{ locale === 'zh' ? '复制' : 'Copy' }}
        </button>
        <button type="button" :disabled="!ready" @click="downloadCode">
          {{ locale === 'zh' ? '下载' : 'Download' }}
        </button>
        <button type="button" :disabled="!ready" @click="downloadDesign">
          {{ locale === 'zh' ? '下载 .ic' : 'Download .ic' }}
        </button>
      </div>
    </div>
    <p v-if="notice" class="interface-demo-notice" role="status">
      {{ notice }}
    </p>
    <div class="interface-demo-code">
      <div v-if="highlightedCode" v-html="highlightedCode" />
      <pre v-else><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.interface-demo {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  overflow: hidden;
}
.interface-demo-toolbar,
.interface-demo-codebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.interface-demo-tabs,
.interface-demo-codebar > div {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.interface-demo button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 6px 10px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.interface-demo button.active {
  color: #fff;
  background: #4f5ee9;
  border-color: #4f5ee9;
}
.interface-demo button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.interface-demo-description {
  margin: 0;
  padding: 0 16px 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.interface-demo-canvas {
  background: #f4f6fb;
  border-block: 1px solid var(--vp-c-divider);
}
.interface-demo-codebar {
  padding-block: 10px;
}
.interface-demo-notice {
  margin: 0;
  padding: 0 16px 8px;
  font-size: 12px;
}
.interface-demo-code {
  height: 230px;
  overflow: auto;
  margin: 0;
  padding: 16px;
  border-radius: 0;
  font-size: 12px;
  background: var(--vp-code-block-bg);
}
.interface-demo-code :deep(pre) {
  margin: 0;
  padding: 0;
  background: transparent !important;
  font-size: inherit;
}
:global(.dark .interface-demo-code .shiki) {
  color: var(--shiki-dark) !important;
}
:global(.dark .interface-demo-code .shiki span) {
  color: var(--shiki-dark) !important;
}
</style>
