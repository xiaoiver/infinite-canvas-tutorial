<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  serializedNodesToCode,
  type CodeFramework,
} from '@infinite-canvas-tutorial/ecs';
import { interfaceScenes } from './design-to-code-scenes';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});

const sceneId = ref(interfaceScenes[0].id);
const framework = ref<CodeFramework>('html-css');
const notice = ref('');
const preview = ref<HTMLElement | null>(null);
const previewScale = ref(1);
let resizeObserver: ResizeObserver | undefined;
const scene = computed(
  () => interfaceScenes.find((item) => item.id === sceneId.value)!,
);

onMounted(() => {
  if (!preview.value) return;
  resizeObserver = new ResizeObserver(([entry]) => {
    previewScale.value = Math.min(1, entry.contentRect.width / 1050);
  });
  resizeObserver.observe(preview.value);
});

onUnmounted(() => resizeObserver?.disconnect());

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

const html = computed(() =>
  htmlDocument(
    serializedNodesToCode(scene.value.nodes, {
      framework: 'html-css',
      variablesMode: 'css-var',
      variables: scene.value.variables,
    }),
  ),
);

const code = computed(() =>
  framework.value === 'html-css'
    ? html.value
    : serializedNodesToCode(scene.value.nodes, {
        framework: 'react-tailwind',
        variablesMode: 'resolved',
        componentStructure: 'preserve',
        componentName: scene.value.componentName,
        variables: scene.value.variables,
      }),
);

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value);
    notice.value = props.locale === 'zh' ? '已复制代码' : 'Code copied';
  } catch {
    notice.value =
      props.locale === 'zh'
        ? '复制失败，请手动选择代码'
        : 'Copy failed; select the code below';
  }
}

function downloadCode() {
  const extension = framework.value === 'html-css' ? 'html' : 'tsx';
  const url = URL.createObjectURL(
    new Blob([code.value], { type: 'text/plain' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${scene.value.id}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
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
          @click="
            sceneId = item.id;
            notice = '';
          "
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
    <div
      ref="preview"
      class="interface-demo-preview"
      :style="{ height: `${720 * previewScale}px` }"
      :aria-label="
        locale === 'zh' ? '生成的界面预览' : 'Generated interface preview'
      "
    >
      <iframe
        :title="scene.title"
        :srcdoc="html"
        sandbox=""
        loading="lazy"
        :style="{ transform: `scale(${previewScale})` }"
      />
    </div>

    <div class="interface-demo-codebar">
      <strong>{{ locale === 'zh' ? '生成的代码' : 'Generated code' }}</strong>
      <div>
        <button type="button" @click="copyCode">
          {{ locale === 'zh' ? '复制' : 'Copy' }}
        </button>
        <button type="button" @click="downloadCode">
          {{ locale === 'zh' ? '下载' : 'Download' }}
        </button>
      </div>
    </div>
    <p v-if="notice" class="interface-demo-notice" role="status">
      {{ notice }}
    </p>
    <pre class="interface-demo-code"><code>{{ code }}</code></pre>
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
.interface-demo-description {
  margin: 0;
  padding: 0 16px 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.interface-demo-preview {
  overflow: hidden;
  background: #f4f6fb;
  border-block: 1px solid var(--vp-c-divider);
}
.interface-demo-preview iframe {
  display: block;
  width: 1050px;
  height: 720px;
  border: 0;
  transform-origin: top left;
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
}
</style>
