<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  Pen,
  type API,
  type TextSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { ensureExampleWorld } from '../lib/ensure-example-world';

const props = withDefaults(defineProps<{ locale?: 'en' | 'zh' }>(), {
  locale: 'en',
});
const zh = computed(() => props.locale === 'zh');
const wrapper = ref<HTMLElement>();
const ready = ref(false);
const error = ref('');
const value = ref<Partial<TextSerializedNode>>({});
const paths = {
  curve: 'M40 230C160 35 440 35 560 230',
  circle: 'M180 170A120 120 0 1 1 420 170A120 120 0 1 1 180 170Z',
  line: 'M40 170H560',
};
let api: API | undefined;
let dispose: (() => void) | undefined;
let host: HTMLElement | undefined;
let disposed = false;
const id = 'ecs-path-text';
const sync = () => {
  value.value = { ...(api?.getNodeById(id) as TextSerializedNode) };
};
async function reset() {
  await api?.edit((editor) => {
    editor.deselectNodes(editor.getNodes());
    editor.deleteNodesById([id]);
    editor.updateNode({
      id,
      type: 'text',
      content: 'Text follows your curve',
      fontFamily: 'sans-serif',
      fontSize: 32,
      textAlign: 'center',
      path: paths.curve,
      side: 'left',
      startOffset: 0,
      pathOffset: 0,
      letterSpacing: 1,
      anchorX: 0,
      anchorY: 0,
      fills: [{ type: 'solid', value: '#e65b5b' }],
      zIndex: 1,
    });
    editor.setAppState({
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.HAND, Pen.SELECT],
      cameraX: -10,
      cameraY: -10,
      cameraZoom: Math.min(1, (host!.clientWidth - 20) / 600),
    });
  });
  sync();
}
async function update(patch: Partial<TextSerializedNode>) {
  await api?.edit((editor) => {
    const node = editor.getNodeById(id);
    if (node) editor.updateNode(node, patch);
  });
  sync();
}
function number(event: globalThis.Event) {
  return Number((event.target as HTMLInputElement).value);
}
function onReady(event: globalThis.Event) {
  if (disposed) return;
  api = (event as CustomEvent<API>).detail;
  dispose = api.subscribe(sync);
  reset()
    .then(() => {
      ready.value = true;
    })
    .catch((e) => {
      error.value = String(e);
    });
}
onMounted(async () => {
  host = wrapper.value;
  host?.addEventListener(Event.READY, onReady);
  try {
    await ensureExampleWorld();
  } catch (e) {
    error.value = String(e);
  }
});
onUnmounted(() => {
  disposed = true;
  host?.removeEventListener(Event.READY, onReady);
  dispose?.();
});
</script>

<template>
  <div class="ecs-text-path">
    <fieldset :disabled="!ready">
      <label
        >{{ zh ? '文字' : 'Text'
        }}<input
          :value="value.content"
          @change="
            update({ content: ($event.target as HTMLInputElement).value })
          "
      /></label>
      <label
        >{{ zh ? '路径' : 'Path'
        }}<select
          :value="value.path"
          @change="update({ path: ($event.target as HTMLSelectElement).value })"
        >
          <option :value="paths.curve">{{ zh ? '曲线' : 'Curve' }}</option>
          <option :value="paths.circle">{{ zh ? '圆形' : 'Circle' }}</option>
          <option :value="paths.line">{{ zh ? '直线' : 'Line' }}</option>
        </select></label
      >
      <label
        >{{ zh ? '方向' : 'Side'
        }}<select
          :value="value.side"
          @change="
            update({
              side: ($event.target as HTMLSelectElement).value as
                | 'left'
                | 'right',
            })
          "
        >
          <option value="left">{{ zh ? '正向' : 'Forward' }}</option>
          <option value="right">{{ zh ? '反向' : 'Reverse' }}</option>
        </select></label
      >
      <label
        >{{ zh ? '对齐' : 'Alignment'
        }}<select
          :value="value.textAlign"
          @change="
            update({
              textAlign: ($event.target as HTMLSelectElement)
                .value as CanvasTextAlign,
            })
          "
        >
          <option value="start">{{ zh ? '起点' : 'Start' }}</option>
          <option value="center">{{ zh ? '居中' : 'Center' }}</option>
          <option value="end">{{ zh ? '终点' : 'End' }}</option>
        </select></label
      >
      <label
        >{{ zh ? '沿路径偏移' : 'Start offset' }}
        <output>{{ value.startOffset }}</output
        ><input
          type="range"
          min="-500"
          max="500"
          :value="value.startOffset"
          @input="update({ startOffset: number($event) })"
      /></label>
      <label
        >{{ zh ? '法线偏移' : 'Normal offset' }}
        <output>{{ value.pathOffset }}</output
        ><input
          type="range"
          min="-80"
          max="80"
          :value="value.pathOffset"
          @input="update({ pathOffset: number($event) })"
      /></label>
      <button type="button" @click="api?.undo()">
        {{ zh ? '撤销' : 'Undo' }}
      </button>
      <button type="button" @click="api?.redo()">
        {{ zh ? '重做' : 'Redo' }}
      </button>
      <button type="button" @click="reset">{{ zh ? '重置' : 'Reset' }}</button>
    </fieldset>
    <p>
      {{
        zh
          ? '点击字形选中，再拖动或使用选框缩放、旋转。双击文字进入直线文本框编辑，提交后重新沿路径排版。'
          : 'Click a glyph to select, then drag, resize or rotate it. Double-click to edit in a straight text box; committing lays the text along its path again.'
      }}
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <ic-spectrum-canvas
      ref="wrapper"
      style="display: block; width: 100%; height: 400px"
    />
  </div>
</template>

<style scoped>
fieldset {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  border: 0;
  padding: 0;
}
label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
input,
select,
button {
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 4px 6px;
}
input[type='range'] {
  width: 100px;
}
button {
  cursor: pointer;
}
p {
  font-size: 13px;
}
</style>
