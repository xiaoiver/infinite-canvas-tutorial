---
outline: deep
description: 'Learn to draw straight lines using line geometry and screen-space techniques. Implement grid and dots patterns, and add wireframe rendering for geometric shapes.'
head:
    - ['meta', { property: 'og:title', content: 'Lesson 5 - Grid' }]
---

# Lesson 5 - Grid

In this lesson, you will learn about the following:

-   Drawing straight lines using Line Geometry or screen-space techniques.
-   Drawing dots grid.
-   Drawing wireframe for Geometry.

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
checkboardStyle = Inputs.radio(['none', 'grid', 'dots'], {
    label: 'Checkboard Style',
    value: 'grid',
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson5;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false inspector=false
call(() => {
    const styles = ['none', 'grid', 'dots'];
    canvas.setCheckboardStyle(styles.indexOf(checkboardStyle));
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

In Figma and FigJam, grids appear when zooming in to a certain level, with the former displaying as lines and the latter as dots.

![figjam grid](/figjam-grid.png)

Miro supports switching between lines and dots:

![miro grid](/miro-grid.png)

Let's start with lines grid.

## Lines grid {#lines-grid}

Firstly, the grid should not be part of the scene graph. We do not want the grid to scale up and down as the canvas is zoomed. However, we do want it to have a fade-in and fade-out effect as zooming occurs. Therefore, we first render the grid in the `beginFrame` hook, passing in necessary information from the scene, such as the camera:

```ts
hooks.initAsync.tapPromise(async () => {
    this.#grid = new Grid();
});
hooks.beginFrame.tap(() => {
    this.#grid.render(
        this.#device,
        this.#renderPass,
        this.#uniformBuffer,
        camera,
    );
});
```

### Line Geometry {#line-geometry}

The most straightforward approach is similar to [GridHelper - Three.js], where a set of lines is created based on the grid size:

```ts
// https://github.com/mrdoob/three.js/blob/master/src/helpers/GridHelper.js#L25-L37
for (var i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
    vertices.push(-halfSize, 0, k, halfSize, 0, k);
    vertices.push(k, 0, -halfSize, k, 0, halfSize);
}

var geometry = new BufferGeometry();
geometry.addAttribute('position', new Float32BufferAttribute(vertices, 3));
geometry.addAttribute('color', new Float32BufferAttribute(colors, 3));

var material = new LineBasicMaterial({ vertexColors: VertexColors });
LineSegments.call(this, geometry, material);
```

In the [thetamath] project by Figma CTO Evan, the grid is also implemented in this manner, constructing the necessary lines for the grid from both horizontal and vertical directions:

```ts
for (let x = left; x < right; x++) {
    const tx = ox + (x * zoom) / step;
    this.strokeLine();
}
for (let y = top; y < bottom; y++) {
    const ty = oy - (y * zoom) / step;
    this.strokeLine();
}
```

How do we draw straight lines in WebGL? I have previously written a piece on [Drawing Straight Lines in WebGL (Chinese)]. In a nutshell, if we don't consider the joints, we only need to stretch outwards on both sides along the normal direction, using two triangles to draw:

![extrude line](https://pica.zhimg.com/70/v2-afa28c8cf89369a162816f21b7f53314_1440w.avis?source=172ae18b&biz_tag=Post)

[thetamath] also employs two small tricks. The first one is the use of [Triangle strip] which, compared to regular `Triangles`, can save on the number of vertices, reducing from `3N` to `N + 2`, where `N` is the number of triangles:

```ts{5}
this.#pipeline = device.createRenderPipeline({
    inputLayout: this.#inputLayout,
    program: this.#program,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    topology: PrimitiveTopology.TRIANGLE_STRIP,
});
```

Secondly, it stores the color in four `Bytes`:

```ts
255 | (255 << 8) | (255 << 16) | (127 << 24);
```

Along with [vertexAttribPointer], it declares that each component is `gl.UNSIGNED_BYTE` and needs to be normalized:

```ts{13}
this.#inputLayout = device.createInputLayout({
  vertexBufferDescriptors: [
    {
      arrayStride: 4 * 5,
      stepMode: VertexStepMode.VERTEX,
      attributes: [
        {
          format: Format.F32_RGBA,
          offset: 0,
          shaderLocation: 0,
        },
        {
          format: Format.U8_RGBA_NORM,
          offset: 4 * 4,
          shaderLocation: 1,
        },
      ],
    },
  ],
  indexBufferFormat: null,
  program: this.#program,
});
```

Let's try it out:

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);
    const $canvas = canvas.getDOM();

    canvas.setGridImplementation(0);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return $canvas;
})();
```

In this method, the larger the canvas size and the higher the grid density, the more vertices are needed. Is there a way to achieve this with fewer vertices? Since the grid always fills the entire screen, can it be accomplished in screen space?

### Patterns in fragment shader {#patterns-in-fragment-shader}

Just as [Building Flexible and Powerful Cross-Sections with GridPaper and WebGL] says：

> Instead of rendering all these lines as geometry, we can use a WebGL fragment shader to generate the lines on a per-pixel basis.

The advantage of implementing it in screen space is that only a single Quad that fills the screen is needed, requiring only four vertices, into which coordinates under the clip coordinate system are passed. Of course, it's also possible to use a fullscreen triangle, which only requires three vertices. This approach is quite common in post-processing:

```ts
this.appendVertex(-1, -1);
this.appendVertex(-1, 1);
this.appendVertex(1, -1);
this.appendVertex(1, 1);
```

This way, in the Vertex Shader, you can use them directly without any transformations:

```glsl
layout(location = 0) in vec4 a_Position;
void main() {
  gl_Position = vec4(a_Position.xy, 0, 1);
}
```

To draw the grid in the Fragment Shader, you will need the coordinates of the pixel points in the world coordinate system. Therefore, by using the inverse of the camera's projection transformation matrix, you can convert the coordinates from the clip coordinate system to the world coordinate system:

```glsl{4}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
};

out vec2 v_Position;

vec2 project_clipspace_to_world(vec2 p) {
  return (u_ViewProjectionInvMatrix * vec3(p, 1.0)).xy;
}

void main() {
  v_Position = project_clipspace_to_world(a_Position.xy);
}
```

In Canvas2D and SVG, grids are commonly implemented using Patterns. The basic idea in implementing this with a Fragment Shader is also similar, which involves using the built-in function `fract` to draw a Pattern. By scaling the initial coordinate space by a factor of n, and then using `fract` to obtain the fractional part, you only need to consider a small block with coordinate range `0-1`. For more information, you can refer to [the book of shaders - Patterns].

![patterns](https://pic4.zhimg.com/80/v2-1f7b0bc49eefe692f5a3c5935725feef_1440w.webp)

The following code is from Evan's [Anti-Aliased Grid Shader]:

```ts
vec4 render_grid_checkerboard(vec2 coord) {
  // Compute anti-aliased world-space grid lines
  vec2 grid = abs(fract(coord / gridSize - 0.5) - 0.5) / fwidth(coord) * gridSize;
  float line = min(grid.x, grid.y);
  float alpha = 1.0 - min(line, 1.0);
}
```

We want to draw two sets of grids with different thicknesses, where the spacing of the fine grid is `1/5` of the coarse grid. At the same time, we check if the current pixel point is closer to the coarse grid:

```glsl
vec2 size = scale_grid_size(u_ZoomScale);
float gridSize1 = size.x;
float gridSize2 = gridSize1 / 5.0;
```

### Texture-based grid {#texture-based}

[The Best Darn Grid Shader (Yet)] describes another texture based scheme. Especially when we want the lines themselves to have perspective, this scheme works better than a fixed-width grid in screen space. For example, in the image below, there is a clear “moiré” phenomenon on the right side, while the color of the lines farther to the left will be thinner and darker.

![texture grid vs line grid](https://miro.medium.com/v2/resize:fit:1360/format:webp/1*P4a5_Z1u5WXOQWpVglPb2g.png)

In the original article, the author made a number of improvements to the perspective thickness, alleviate the “moire” patterns, etc. Examples on Shadertoy are shown below:

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/mdVfWw?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

## Dots grid

For a dot grid, we still opt to handle it within the Fragment Shader in screen space. While it's possible to draw circles using the Signed Distance Field (SDF) method we discussed before, doing so would require a large number of vertices. Therefore, we continue to reuse the Pattern for straight line grids, only here we employ SDF to determine whether a pixel point is within a circle, a method we've already covered in the second lesson:

```glsl
vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * u_ZoomScale / zoomStep);
```

To support switching between straight line grids and dot grids, we can introduce a new uniform variable to differentiate the grid styles.

```glsl{6}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
```

Now we can draw different grids in Fragment Shader like this:

```glsl
const int CHECKERBOARD_STYLE_NONE = 0;
const int CHECKERBOARD_STYLE_GRID = 1;
const int CHECKERBOARD_STYLE_DOTS = 2;

vec4 render_grid_checkerboard(vec2 coord) {
  int checkboardStyle = int(floor(u_CheckboardStyle + 0.5));
  if (checkboardStyle == CHECKERBOARD_STYLE_GRID) {
    // lines grid
  } else if (checkboardStyle == CHECKERBOARD_STYLE_DOTS) {
    // dots grid
  }
}
```

You can go back to the example at the beginning of the page and switch between different grid styles.

Finally an interesting example incorporating mouse interaction is provided: [How to Code a Subtle Shader Background Effect with React Three Fiber]

<video autoplay="" controls="" loop="" muted="" src="https://codrops-1f606.kxcdn.com/codrops/wp-content/uploads/2024/10/shaderbackground.mp4?x39556" playsinline=""></video>

## Adjusting Brightness

In the shaders used in Figma / FigJam, the brightness of colors is also calculated, and based on the brightness values, the colors are adjusted. Specifically, it employs a brightness-based color adjustment algorithm designed to improve the visual appeal of colors, making text or graphics more clearly visible against brighter backgrounds.

A weight vector `weights` has been defined, with weights set according to the non-linear characteristics of the human eye's perception of brightness for different colors. This is commonly used to calculate brightness values in the RGB color space.

```glsl{2}
vec3 gridColor; // Store the final adjusted color value
vec3 weights = vec3(0.299, 0.587, 0.114);
float c2 = dot(rgb * rgb, weights); // Calculate weighted sum of squares of RGB, c2 is an estimate of color brightness
float luminance = sqrt(c2);
```

If the brightness value is greater than 0.5, this indicates that the color itself is already quite bright. The code will calculate an adjustment factor target, and use it to modify the color value rgb, making the color slightly darker. This change ensures that the color is easier to observe against a bright background. If the brightness value is not greater than 0.5, the color itself is comparatively dark, and the code will take an alternative strategy to adjust the color.

First, it calculates a new brightness target value target, and then uses the `mix` function to blend the rgb color with pure white `vec3(1)`, based on the calculation results of `b` and `a`. The final color mix ratio is determined by the relation of `b` to `a`. Here, `a` and `b` are calculated based on the original color's brightness value, and are used to control the color adjustment process.

```glsl
if (luminance > 0.5) {
    float target = (luminance - 0.05) / luminance;
    gridColor = rgb * target;
}
else {
    float target = luminance * 0.8 + 0.15;
    float c1 = dot(rgb, weights);
    float a = 1.0 - 2.0 * c1 + c2;
    float b = c2 - c1;
    gridColor = mix(rgb, vec3(1), (b + sqrt(b * b - a * (c2 - target * target))) / a);
}
rgb = mix(rgb, gridColor, gridWeight);
```

## Draw wireframe {#wireframe}

Draw wireframe also uses similar techniques, which can be used for debugging complex Geometry, such as [Draw polyline].

### Barycentric coordinates {#barycentric-coordinates}

The idea is actually quite simple. We want to draw wireframe on each triangle during rasterization, so we need to know how far the current fragment is from the three sides of the triangle. Once it is less than the width of the border, we will color the current fragment with the border color. So the key is how to calculate the distance of the fragment from the three sides of the triangle. We can use barycentric coordinates. Since we only care about the triangle where the current fragment is located, we can use the barycentric coordinates of the three vertices to build a barycentric coordinate system, and then use the interpolation of the fragment shader to get the barycentric coordinates of the current fragment.

In fact, the rendering pipeline also uses barycentric coordinates as weights to determine the color of the fragment, as shown in the figure below. You can continue to read the article on rasterization implementation on scratchapixel: [Rasterization].

![barycentric](https://www.scratchapixel.com/images/rasterization/barycentric2.png)

Let's look at the specific implementation. First, pass in the barycentric coordinates to the vertices. We need to ensure that the coordinates of the three vertices of the triangle are `(1,0,0)`, `(0,1,0)`, and `(0,0,1)`. If you are using `gl.drawArrays()` during drawing, you only need to pass in the coordinates of the three vertices in order, and repeat them multiple times (the number of triangles), for example:

```glsl
layout(location = BARYCENTRIC) in vec3 a_Barycentric;
out vec3 v_Barycentric;

void main() {
  v_Barycentric = a_Barycentric;
}
```

Then in the fragment shader, when any component of the barycentric coordinates is less than the threshold of the border width, it can be considered as a border. Here, the built-in glsl function `any()` and `lessThan()` are used:

```glsl
in vec3 v_Barycentric;
void main() {
  // less than border width
  if (any(lessThan(v_Barycentric, vec3(0.1)))) {
    // border color
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // fill background color
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
  }
}
```

And like the previous example of drawing straight line grids, we want the line width to remain constant regardless of the camera zoom, so we continue to use `fwidth()`:

```glsl
float edgeFactor() {
  vec3 d = fwidth(v_Barycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
  return min(min(a3.x, a3.y), a3.z);
}
```

### Reallocate vertex data {#reallocate-vertex-data}

In the previous example, we used `gl.drawArrays()` during drawing, but if we use `gl.drawElements()` which is more space efficient, that is, sharing some vertices (for example, a plane only uses 4 rather than 6 vertices), we cannot simply allocate barycentric coordinates based on the vertex order, but need to allocate them based on the vertex index. However, not all allocation methods are this simple. For example, the problem on Stack Overflow: [Issue with Barycentric coordinates when using shared vertices], you will find that the `?` cannot be allocated. The fundamental reason is that in the case of shared vertices, once the barycentric coordinates are allocated for one triangle, the remaining one vertex coordinate of the next triangle sharing the same side is actually already determined:

![there's no barycentric coordinate for the question mark](https://pica.zhimg.com/v2-30c2f4ab848d5f0cfcf8f6934b030298_b.jpg)

Therefore, when wireframe is enabled, the reused indices need to be expanded. For example, the original 6 vertices using 4 indices `[0, 1, 2, 0, 2, 3]` will be expanded to `[0, 1, 2, 3, 4, 5]`, and the data in the vertex array needs to be reallocated.

```ts
let cursor = 0;
const uniqueIndices = new Uint32Array(indiceNum); // Reallocate indices
for (let i = 0; i < indiceNum; i++) {
    const ii = this.#indexBufferData[i];
    for (let j = 0; j < bufferDatas.length; j++) {
        const { arrayStride } = this.#vertexBufferDescriptors[j];
        const size = arrayStride / 4;
        for (let k = 0; k < size; k++) {
            bufferDatas[j][cursor * size + k] =
                originalVertexBuffers[j][ii * size + k]; // Reallocate vertex data
        }
    }
    uniqueIndices[i] = cursor;
    cursor++;
}
```

The effect is as follows, and more drawing methods for graphics will be introduced later.

<script setup>
import Wireframe from '../components/Wireframe.vue'
</script>

<Wireframe />

## Extended reading

-   [thetamath]
-   [The Best Darn Grid Shader (Yet)]
-   [Drawing Grid in WebGL (Chinese)]
-   [How to Draw Plane Grid Lines with WebGL (Chinese)]
-   [How to Code a Subtle Shader Background Effect with React Three Fiber]
-   [Love, derivatives and loops]

[thetamath]: http://thetamath.com/app/y=x%5E(3)-x
[GridHelper - Three.js]: https://threejs.org/docs/#api/en/helpers/GridHelper
[Drawing Grid in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/66637363
[How to Draw Plane Grid Lines with WebGL (Chinese)]: https://www.zhihu.com/question/325261675/answer/3149510989
[Drawing Straight Lines in WebGL (Chinese)]: https://zhuanlan.zhihu.com/p/59541559
[Triangle strip]: https://en.wikipedia.org/wiki/Triangle_strip
[Building Flexible and Powerful Cross-Sections with GridPaper and WebGL]: https://medium.com/life-at-propeller/building-flexible-and-powerful-cross-sections-with-gridpaper-and-webgl-c5b3b9929c71
[vertexAttribPointer]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
[the book of shaders - Patterns]: https://thebookofshaders.com/09/?lan=ch
[Anti-Aliased Grid Shader]: https://madebyevan.com/shaders/grid/
[The Best Darn Grid Shader (Yet)]: https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8
[Draw polyline]: /guide/lesson-012
[Rasterization]: https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html
[Issue with Barycentric coordinates when using shared vertices]: https://stackoverflow.com/questions/24839857/wireframe-shader-issue-with-barycentric-coordinates-when-using-shared-vertices
[How to Code a Subtle Shader Background Effect with React Three Fiber]: https://tympanus.net/codrops/2024/10/31/how-to-code-a-subtle-shader-background-effect-with-react-three-fiber/
[Love, derivatives and loops]: https://medium.com/@akella/love-derivatives-and-loops-f4a0da6e2458
