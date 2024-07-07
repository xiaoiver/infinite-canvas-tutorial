---
outline: deep
---

# 课程 15 - 图片导入导出

-   拓展 SVG 的能力，以 stroke 为例
-   导入图片
-   导出 SVG / PNG

`opacity` `stroke-opacity` 和 `fill-opacity` 的区别：

<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" fill="red" stroke="black" stroke-width="20" opacity="0.5" />
  <circle cx="150" cy="50" r="40" fill="red" stroke="black" stroke-width="20" fill-opacity="0.5" stroke-opacity="0.5" />
</svg>

[How to simulate stroke-align (stroke-alignment) in SVG]

Figma 中的 Stroke 取值包括 `Center / Inside / Outside`

![Stroke center in Figma](/figma-stroke-center.png)

[How to simulate stroke-align (stroke-alignment) in SVG]: https://stackoverflow.com/questions/74958705/how-to-simulate-stroke-align-stroke-alignment-in-svg
