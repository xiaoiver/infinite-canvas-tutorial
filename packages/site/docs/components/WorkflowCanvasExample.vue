<script setup lang="ts">
import { ref } from 'vue';
import { withBase } from 'vitepress';

const props = defineProps<{ locale: 'en' | 'zh' }>();
const shell = ref<HTMLElement>();
const loaded = ref(false);
const fullscreenError = ref(false);
const source = withBase('/workflow-canvas/index.html');
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await shell.value?.requestFullscreen();
  } catch {
    fullscreenError.value = true;
  }
}
</script>

<template>
  <main ref="shell" class="workflow-example">
    <header class="workflow-example-bar">
      <a
        :href="
          withBase(
            locale === 'zh'
              ? '/zh/example/solar-system'
              : '/example/solar-system',
          )
        "
      >
        ← {{ props.locale === 'zh' ? '返回示例' : 'Back to examples' }}
      </a>
      <span class="workflow-example-title"
        >FRAME <span>· ECS / WebGL</span></span
      >
      <nav :aria-label="locale === 'zh' ? '示例选项' : 'Example options'">
        <a
          :href="
            withBase(
              locale === 'zh'
                ? '/example/workflow-canvas'
                : '/zh/example/workflow-canvas',
            )
          "
        >
          {{ locale === 'zh' ? 'English' : '简体中文' }}
        </a>
        <button type="button" @click="fullscreen">
          {{ locale === 'zh' ? '全屏' : 'Fullscreen' }} ⛶
        </button>
        <a :href="source" target="_blank" rel="noopener">
          {{ locale === 'zh' ? '独立打开' : 'Open standalone' }} ↗
        </a>
      </nav>
    </header>
    <p v-if="!loaded" class="workflow-example-loading" role="status">
      {{
        locale === 'zh' ? '正在加载工作流画布…' : 'Loading the workflow canvas…'
      }}
    </p>
    <p v-if="fullscreenError" class="workflow-example-notice" role="status">
      {{
        locale === 'zh'
          ? '浏览器不支持全屏，请使用“独立打开”。'
          : 'Fullscreen is unavailable. Use “Open standalone” instead.'
      }}
    </p>
    <iframe
      :src="source"
      :title="
        locale === 'zh' ? 'FRAME 节点工作流画布' : 'FRAME node workflow canvas'
      "
      allow="fullscreen"
      allowfullscreen
      @load="loaded = true"
    ></iframe>
  </main>
</template>

<style scoped>
.workflow-example {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #171b18;
  color: #d4dfca;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.workflow-example-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  min-height: 44px;
  padding: 8px 18px;
  border-bottom: 1px solid #ffffff13;
  background: #111612;
  font-size: 11px;
}
.workflow-example-bar a,
.workflow-example-bar button {
  color: #b4c8a5;
  text-decoration: none;
  white-space: nowrap;
}
.workflow-example-bar a:hover,
.workflow-example-bar button:hover {
  color: #d5f4b9;
}
.workflow-example-bar :focus-visible {
  outline: 2px solid #c6ee9c;
  outline-offset: 4px;
}
.workflow-example-title {
  font-weight: 600;
  letter-spacing: 1px;
}
.workflow-example-title span {
  color: #6f8264;
  font-size: 10px;
  font-weight: 400;
}
.workflow-example-bar nav {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}
.workflow-example-bar button {
  font: inherit;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 0;
}
.workflow-example iframe {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
}
.workflow-example-loading {
  position: absolute;
  top: 70px;
  left: 25px;
  color: #b4c8a5;
  font-size: 12px;
  pointer-events: none;
}
.workflow-example-notice {
  margin: 0;
  padding: 8px 18px;
  font-size: 11px;
}
@media (max-width: 650px) {
  .workflow-example-title {
    display: none;
  }
  .workflow-example-bar {
    gap: 12px;
    padding: 8px 12px;
    font-size: 10px;
  }
  .workflow-example-bar nav {
    gap: 12px;
  }
}
</style>
