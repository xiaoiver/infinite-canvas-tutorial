---
title: "Pretext for shaping and layout metrics"
description: "Use Pretext to obtain consistent measurements across engines."
---
<!-- example-intro:en -->

# Pretext for shaping and layout metrics

**Pretext** helps unify shaping data when mixing multiple backends. The upstream project documents API nuances—treat this page as a bridge experiment.

Validate line breaks against HarfBuzz for production.

## Interactive demo

<script setup>
import Pretext from '../components/Pretext.vue'
</script>

Use [pretext] to do text shaping & layout.

<Pretext />

[pretext]: https://github.com/chenglou/pretext
