---
title: "下划线与文本装饰"
description: "实验下划线粗细、跳过规则等参数。"
---
<!-- example-intro:zh -->

# 下划线与文本装饰

装饰线与 **选区**、**无障碍** 以及导出 PDF/SVG 相关；本页单独拉出参数便于试验。

若模拟系统输入框，请尽量贴近平台惯例。

## 交互示例

<script setup>
import TextDecoration from '../../components/TextDecoration.vue'
</script>

实现类似 CSS [text-decoration] 效果。

<TextDecoration />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: "I'd far rather be\nhappy than right any day.",
    fontSize: 45,
    fill: '#F67676',
    decorationColor: 'black',
    decorationLine: 'underline',
    decorationStyle: 'wavy',
    decorationThickness: 10,
});
```

[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration
