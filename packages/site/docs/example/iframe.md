---
title: "Embed iframes (e.g. video)"
description: "Composite external media with canvas transforms."
---
<!-- example-intro:en -->

# Embed iframes (e.g. video)

iframes carry **sandbox** and **autoplay** policies—coordinate with your CSP. Useful for YouTube or Figma embeds inside a board ([Lesson 29](/guide/lesson-029)).

Capture thumbnails if you need static exports without network playback.

## Interactive demo

<script setup>
import Iframe from '../components/Iframe.vue'
</script>

Embed YouTube with `<iframe>`:

```ts
const node = {
    id: 'embed-1',
    type: 'embed',
    url: 'https://www.youtube.com/watch?v=37fvFffAmf8',
    x: 100,
    y: 100,
    width: 800,
    height: 450,
    lockAspectRatio: true,
};
```

<Iframe />
