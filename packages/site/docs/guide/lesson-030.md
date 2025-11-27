---
outline: deep
description: ''
publish: false
---

# Lesson 30 - Post-processing and render graph

## Post-processing Effects {#post-processing}

Based on Shaders, common image processing effects can be achieved, such as Gaussian blur, Perlin noise, Glitch, and of course, the recently popular "liquid glass":

![source: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Adjust in Photoshop Web](/adjust-ps-web.png)

For more effects, see: [Paper Shaders].

In implementation, [Pixi.js filters] calculate the application area based on the object's bounding box, render the object onto a temporary render texture, and then apply shader effects to that texture.

### Brightness {#brightness}

We can use the [CSS filter] syntax, for example `filter: brightness(0.4);`

[Paper Shaders]: https://shaders.paper.design/
[Pixi.js filters]: https://github.com/pixijs/filters
[CSS filter]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
