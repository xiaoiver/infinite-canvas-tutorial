---
title: "Minimal rich text editor surface"
description: "Edit runs of text with caret, selection, and basic styles."
---
<!-- example-intro:en -->

# Minimal rich text editor surface

Building a **text editor** on canvas means reimplementing caret movement, selection rectangles, and IME composition—see [Lesson 15](/guide/lesson-015) and [Lesson 16](/guide/lesson-016).

Start from this sample before adding collaboration or AI assists.

## Interactive demo

<script setup>
import TextEditor from '../components/TextEditor.vue'
</script>

Double-click the text to enter the editing state.

<TextEditor />
