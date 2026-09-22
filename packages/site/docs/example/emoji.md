---
title: "Color emoji alongside plain text"
description: "Render emoji glyphs with the same text pipeline as Latin text."
---
<!-- example-intro:en -->

# Color emoji alongside plain text

Emoji require **color** tables and often different fallback fonts. This sample extends the baseline text lesson ([Lesson 15](/guide/lesson-015)) with multi-codepoint sequences in one string.

Verify line height and baseline when mixing emoji with math or CJK.

<a href="/guide/lesson-015">Draw text</a>

<script setup>
import Emoji from '../components/Emoji.vue'
</script>

<Emoji />

```ts
const text = new Text({
    x: 50,
    y: 100,
    content: 'Hello, world! \n🌹🌍🌞🌛',
    fontSize: 30,
    fill: '#F67676',
});
```
