---
publish: false
---

<script setup>
import PythagoreanTheorem from '../components/PythagoreanTheorem.vue'
</script>

-   [TheoremExplainAgent: Towards Multimodal Explanations for LLM Theorem Understanding]
-   [The Pythagorean Theorem and Its Geometric Proof]

<PythagoreanTheorem />

[Manim] is a Python animation engine created by 3Blue1Brown for generating mathematical animations.

![manim](https://raw.githubusercontent.com/3b1b/manim/master/logo/cropped.png)

![3Blue1Brown's space in bilibili](/3blue1brown.png)

Many famous examples require significant time to write scripts:

-   [How I animate 3Blue1Brown | A Manim demo with Ben Sparks] The author demonstrates the creation process
-   [Pythagoras' Theorem | Maths made Beautiful]

Existing practices:

-   [Manim Web: Mathematical Animation Engine, for the web] A Dart port with very low completion, maintenance discontinued
-   [Generative Manim] Has a fine-tuned model trained on Manim corpus, capable of generating Manim code and producing videos on the server side.

What I want to do:

-   Use LLM with Chain-of-Thought (CoT) to explain mathematical problems step by step, generating animation scripts suitable for visual narratives
-   Implement an infinite canvas rendering animation scripts based on WebGL / WebGPU, supporting the following features:
    -   Common 2D / 3D shapes. Frequently used geometric elements like Axis, Grid, etc.
    -   [LaTeX](/zh/guide/lesson-016#tex-math-rendering) Required for mathematical formulas
    -   [Camera animation](/zh/guide/lesson-004#camera-animation) Required for visual storytelling
-   Interactive editing (Natural Language Interface (NLI) + GUI). For example, modify shape styles using property panels, adjust animation parameters using timeline, etc.
-   Export to other formats like Gif / Lottie / Rive / Video

Current implementation completion is relatively low:

-   Claude 3.5 sonnet returns Schema containing graphics and animation descriptions
-   Supports hand-drawn style rendering engine
-   Animation engine based on Web Animations API
-   Limited variety of supported animations

[Manim]: https://github.com/3b1b/manim
[Manim Web: Mathematical Animation Engine, for the web]: https://manim-web.hugos29.dev/
[Generative Manim]: https://generative-manim.vercel.app/
[Pythagoras' Theorem | Maths made Beautiful]: https://www.youtube.com/watch?v=l4FC6mIRyNQ
[How I animate 3Blue1Brown | A Manim demo with Ben Sparks]: https://www.youtube.com/watch?v=rbu7Zu5X1zI
[The Pythagorean Theorem and Its Geometric Proof]: https://omerseyfeddinkoc.medium.com/the-pythagorean-theorem-and-its-geometric-proof-41188a7b5fac
[TheoremExplainAgent: Towards Multimodal Explanations for LLM Theorem Understanding]: https://tiger-ai-lab.github.io/TheoremExplainAgent/
