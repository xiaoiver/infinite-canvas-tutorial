---
title: "Export the canvas to PNG or SVG"
description: "Snapshot vector or raster output for sharing and printing."
---
<!-- example-intro:en -->

# Export the canvas to PNG or SVG

Export ties the editor to the rest of the workflow—slides, docs, asset pipelines. This sample shows how to serialize the current scene to **image** formats; clipboard and file workflows appear in [Lesson 24](/guide/lesson-024).

Verify alpha, resolution, and color profile expectations for your target medium.

## Interactive demo

<script setup>
import Exporter from '../components/Exporter.vue'
</script>

<Exporter />
