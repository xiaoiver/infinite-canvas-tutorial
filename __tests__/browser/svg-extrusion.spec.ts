import { expect } from '@playwright/test';
import type { ExportFormat, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { PNG } from 'pngjs';
import { test } from '../isolated-webkit-test';
import type {} from './fixtures/gizmo';

function glbJson(bytes: number[]) {
  const buffer = Uint8Array.from(bytes);
  const view = new DataView(buffer.buffer);
  expect(view.getUint32(0, true)).toBe(0x46546c67);
  expect(view.getUint32(4, true)).toBe(2);
  expect(view.getUint32(8, true)).toBe(buffer.byteLength);
  const jsonLength = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a);
  return JSON.parse(
    new TextDecoder().decode(buffer.subarray(20, 20 + jsonLength)),
  );
}

/** Canvas fixtures are 200 CSS pixels; mobile screenshots use device pixels. */
function canvasRgbAt(png: PNG, x: number, y: number): [number, number, number] {
  const px = Math.floor((x + 0.5) * png.width / 200);
  const py = Math.floor((y + 0.5) * png.height / 200);
  const offset = (py * png.width + px) * 4;
  return [...png.data.subarray(offset, offset + 3)] as [number, number, number];
}

test('App linked 3D camera renders an imported SVG extrusion', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    '/gizmo.html?extrudePath&appCamera&width=800&height=800&zoom=0.35',
  );
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(() => window.gizmoTest.svgExtrusionState().triangles),
  ).toBeGreaterThan(0);
  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (g > r * 1.3 && b > r * 1.3 && g > 70) teal++;
  }
  expect(teal).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('overlapping SVG extrusions preserve the source paint order', async ({
  page,
}) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.gizmoTest.showSvgArtwork(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <g><rect x="20" y="20" width="120" height="120" fill="#ff0000"/></g>
      <g><rect x="60" y="60" width="120" height="120" fill="#0000ff"/></g>
    </svg>
  `));
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const [red, , blue] = canvasRgbAt(png, 100, 100);
  expect(blue).toBeGreaterThan(red * 1.3);
  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const layers = api.getNodes().filter((node) => node.type === 'rect');
    const bottom = layers[0];
    await api.edit((editor) => editor.updateNode(
      editor.getNodeById(bottom.id),
      { zIndex: Math.max(...layers.map((node) => node.zIndex)) + 1 },
    ));
    await window.gizmoTest.settle();
  });
  const reordered = PNG.sync.read(await page.locator('#canvas').screenshot());
  const [newRed, , newBlue] = canvasRgbAt(reordered, 100, 100);
  expect(newRed).toBeGreaterThan(newBlue * 1.3);
});

test('an independent GLB depth pass keeps the upper SVG layer visible', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const pixels = await page.evaluate(async () => {
    await window.gizmoTest.showSvgArtwork(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
        <rect id="red" width="40" height="40" fill="red"/>
        <rect id="blue" x="20" y="20" width="40" height="40" fill="blue"/>
      </svg>
    `, { x: 30, y: 30 });
    const bytes = window.gizmoTest.api().export({
      format: 'glb' as ExportFormat.GLB,
      download: false,
    });
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonLength = data.getUint32(12, true);
    const binOffset = 20 + jsonLength + 8;
    const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
      nodes: { name?: string; children?: number[]; matrix?: number[]; mesh?: number }[];
      meshes: { primitives: { attributes: { POSITION: number }; indices: number; material: number }[] }[];
      accessors: { bufferView: number; byteOffset?: number; count: number }[];
      bufferViews: { byteOffset?: number }[];
      materials: { pbrMetallicRoughness: { baseColorFactor: number[] } }[];
    };
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const gl = canvas.getContext('webgl', { antialias: false });
    if (!gl) throw new Error('WebGL is required for the GLB depth check');
    const shader = (type: number, source: string) => {
      const handle = gl.createShader(type)!;
      gl.shaderSource(handle, source);
      gl.compileShader(handle);
      if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(handle) ?? 'Shader failed');
      return handle;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec3 position;
      uniform mat4 model;
      void main() {
        vec4 p = model * vec4(position, 1.0);
        // The exported Canvas root rotates 180 degrees around X.
        p.yz = -p.yz;
        gl_Position = vec4((p.x - 30.0) / 30.0,
          (p.y + 30.0) / 30.0, -p.z / 50.0, 1.0);
      }
    `));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision highp float;
      uniform vec4 color;
      void main() { gl_FragColor = color; }
    `));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? 'Program failed');
    gl.useProgram(program);
    gl.viewport(0, 0, 64, 64);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.DITHER);
    gl.clearColor(1, 1, 1, 1);
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    const modelLocation = gl.getUniformLocation(program, 'model');
    const colorLocation = gl.getUniformLocation(program, 'color');
    const accessorOffset = (index: number) => {
      const accessor = json.accessors[index];
      return binOffset + (json.bufferViews[accessor.bufferView].byteOffset ?? 0) +
        (accessor.byteOffset ?? 0);
    };
    // Draw the lower red node first. If the caps were still coplanar, LESS
    // would reject the blue node and this pixel would remain red.
    const children = json.nodes[0].children!.slice().reverse();
    const redZ = json.nodes[children[0]].matrix![14];
    const draw = (flatten: boolean) => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const index of children) {
        const node = json.nodes[index];
        const matrix = node.matrix!.slice();
        if (flatten && index === children[1]) matrix[14] = redZ;
        gl.uniformMatrix4fv(modelLocation, false, matrix);
        for (const primitive of json.meshes[node.mesh!].primitives) {
          const positions = accessorOffset(primitive.attributes.POSITION);
          const indices = accessorOffset(primitive.indices);
          const count = json.accessors[primitive.indices].count;
          const vertices = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            const vertex = data.getUint32(indices + i * 4, true);
            for (let axis = 0; axis < 3; axis++)
              vertices[i * 3 + axis] = data.getFloat32(positions + vertex * 12 + axis * 4, true);
          }
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
          gl.uniform4fv(colorLocation,
            json.materials[primitive.material].pbrMetallicRoughness.baseColorFactor);
          gl.drawArrays(gl.TRIANGLES, 0, count);
        }
      }
      const pixel = new Uint8Array(4);
      gl.readPixels(27, 37, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('GLB depth draw failed');
      return Array.from(pixel.subarray(0, 3));
    };
    return { coplanar: draw(true), separated: draw(false) };
  });
  expect(pixels.coplanar[0]).toBeGreaterThan(pixels.coplanar[2] * 2);
  expect(pixels.separated[2]).toBeGreaterThan(pixels.separated[0] * 2);
});

test('layered Tiger SVG keeps its eye visible over the orange face', async ({
  page,
}, testInfo) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const source = await page.evaluate(() =>
    fetch('/Ghostscript_Tiger.svg').then((response) => response.text()),
  );
  const artwork = await page.evaluate(
    (svg) => window.gizmoTest.showSvgArtwork(svg),
    source,
  );
  expect(artwork.extrudedNodes).toBeGreaterThan(100);
  await page.evaluate(async () => {
    window.gizmoTest.api().gotoLandmark({ zoom: 2 }, { duration: 0 });
    await window.gizmoTest.settle();
  });
  const png = PNG.sync.read(await page.locator('#canvas').screenshot({
    path: testInfo.outputPath('tiger-layered-eye.png'),
  }));
  let green = 0;
  for (let y = 80; y < 180; y++) {
    for (let x = 120; x < 200; x++) {
      const [red, channelGreen, blue] = canvasRgbAt(png, x, y);
      if (channelGreen > red * 1.25 && channelGreen > blue * 1.25 && channelGreen > 60)
        green++;
    }
  }
  expect(green).toBeGreaterThan(10);
});

test('Vercel SVG exports modern RGB strokes as a valid GLB', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const source = await fetch('/vercel.svg').then((response) => response.text());
    const artwork = await window.gizmoTest.showSvgArtwork(source);
    const glb = window.gizmoTest.api().export({
      format: 'glb' as ExportFormat.GLB,
      download: false,
    });
    return { ...artwork, bytes: glb.byteLength };
  });
  expect(result.extrudedNodes).toBeGreaterThan(0);
  expect(result.bytes).toBeGreaterThan(1000);
});

test('mixed Maslow SVG keeps its 2D layers visible while exporting 3D layers', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const source = await fetch('/maslow-hierarchy.svg').then((response) => response.text());
    const artwork = await window.gizmoTest.showSvgArtwork(source);
    const api = window.gizmoTest.api();
    const glb = api.export({ format: 'glb' as ExportFormat.GLB, download: false });
    const background = api.getNodes().find((node) => node.type === 'rect' && node.width === 800);
    const pattern = api.getNodes().find((node) => node.type === 'rect' && node.width === 80);
    return {
      ...artwork,
      textNodes: api.getNodes().filter((node) => node.type === 'text').length,
      glbBytes: glb.byteLength,
      backgroundFill: background?.type === 'rect' ? background.fills?.[0]?.type : undefined,
      backgroundExtruded: !!(background && 'extrude3d' in background && background.extrude3d),
      patternFill: pattern?.type === 'rect' ? pattern.fills?.[0]?.type : undefined,
      patternExtruded: !!(pattern && 'extrude3d' in pattern && pattern.extrude3d),
    };
  });
  expect(result.extrudedNodes).toBeGreaterThan(0);
  expect(result.extrudedNodes).toBeLessThan(result.nodes);
  expect(result.textNodes).toBeGreaterThan(0);
  expect(result.glbBytes).toBeGreaterThan(1000);
  expect(result.backgroundFill).toBe('gradient');
  expect(result.backgroundExtruded).toBe(false);
  expect(result.patternFill).toBe('pattern');
  expect(result.patternExtruded).toBe(false);
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  let colored = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const rgb = png.data.subarray(i, i + 3);
    if (Math.max(...rgb) - Math.min(...rgb) > 50) colored++;
  }
  expect(colored).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('standalone Canvas2D repeats an SVG tile with transparent gaps', async ({ page }) => {
  const samples = await page.evaluate(async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="4" fill="red"/></svg>';
    const img = new Image();
    img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    await img.decode();
    const bitmap = await createImageBitmap(img);
    try {
      return [1, 3].map((scale) => {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 20 * scale;
        const tileContext = tile.getContext('2d')!;
        tileContext.drawImage(bitmap, 0, 0, tile.width, tile.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 60 * scale;
        const ctx = canvas.getContext('2d')!;
        const pattern = ctx.createPattern(tile, 'repeat');
        if (!pattern) throw new Error('Could not create canvas pattern');
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return [10, 20, 30].map((x) =>
          Array.from(ctx.getImageData(x * scale, 10 * scale, 1, 1).data),
        );
      });
    } finally {
      bitmap.close();
    }
  });
  for (const [first, gap, second] of samples) {
    expect(first).toEqual([255, 0, 0, 255]);
    expect(gap[3]).toBe(0);
    expect(second).toEqual([255, 0, 0, 255]);
  }
});

test.describe('SVG pattern rasterization', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    // The solid tile case works in WebKit; the other SVG pattern cases can
    // still render blank or crash during rerasterization.
    test.skip(
      browserName === 'webkit' &&
        testInfo.title !== 'zoomed opaque SVG pattern has no visible tile seams',
      'WebKit SVG pattern rasterization is not yet reliable',
    );
  });

test('SVG user-space pattern renders repeated dots as a 2D fill', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(() => window.gizmoTest.showSvgArtwork(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="4" fill="red"/>
      </pattern></defs>
      <rect width="100" height="100" fill="url(#dots)"/>
    </svg>
  `));
  expect(result.extrudedNodes).toBe(0);
  const points = await page.evaluate(() => {
    const api = window.gizmoTest.api();
    const rect = api.getNodes().find((node) => node.type === 'rect')!;
    const bounds = api.getGeometryBounds([rect]);
    return [10, 20, 30].map((x) => api.canvas2Viewport({
      x: bounds.minX + x, y: bounds.minY + 10,
    }));
  });
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    return points.map((point) => {
      const [r, g, b] = canvasRgbAt(png, point.x, point.y);
      return r > 150 && r > g * 2 && r > b * 2;
    });
  }, { timeout: 10_000 }).toEqual([true, false, true]);
});

test('SVG pattern inheritance and local use render repeated marks', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const fill = await page.evaluate(async () => {
    await window.gizmoTest.showSvgArtwork(`
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
        <rect width="80" height="80" fill="url(#derived)"/>
        <defs>
          <circle id="mark" cx="4" cy="4" r="3" fill="red"/>
          <pattern id="base" width="20" height="20" patternUnits="userSpaceOnUse">
            <use href="#mark" x="6" y="6"/>
          </pattern>
          <pattern id="derived" href="#base"/>
        </defs>
      </svg>
    `);
    const rect = window.gizmoTest.api().getNodes().find((node) => node.type === 'rect');
    return rect?.type === 'rect' ? rect.fills?.[0] : undefined;
  });
  expect(fill?.type).toBe('pattern');
  const points = await page.evaluate(() => {
    const api = window.gizmoTest.api();
    const rect = api.getNodes().find((node) => node.type === 'rect')!;
    const bounds = api.getGeometryBounds([rect]);
    return [10, 20, 30].map((x) => api.canvas2Viewport({
      x: bounds.minX + x, y: bounds.minY + 10,
    }));
  });
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    return points.map((point) => {
      const [r, g, b] = canvasRgbAt(png, point.x, point.y);
      return r > 150 && r > g * 2 && r > b * 2;
    });
  }, { timeout: 10_000 }).toEqual([true, false, true]);
});

test('SVG patternTransform moves the repeated tile in the rendered fill', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.gizmoTest.showSvgArtwork(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <defs><pattern id="stripes" width="20" height="20" patternUnits="userSpaceOnUse"
        patternTransform="translate(5 0)">
        <rect width="20" height="20" fill="white"/>
        <rect width="5" height="20" fill="red"/>
      </pattern></defs>
      <rect width="80" height="80" fill="url(#stripes)"/>
    </svg>
  `));
  const points = await page.evaluate(() => {
    const api = window.gizmoTest.api();
    const rect = api.getNodes().find((node) => node.type === 'rect')!;
    return [2, 7, 12, 22, 27].map((x) => api.canvas2Viewport({
      x: rect.x + x, y: rect.y + 30,
    }));
  });
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    return points.map((point) => {
      const [r, g, b] = canvasRgbAt(png, point.x, point.y);
      return r > 150 && r > g * 2 && r > b * 2;
    });
  }, { timeout: 10_000 }).toEqual([false, true, false, false, true]);
});

test('SVG pattern origin stays aligned across a positioned Rect and Path', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.gizmoTest.showSvgArtwork(`
    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">
      <defs><pattern id="stripes" x="5" width="20" height="20"
        patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="white"/>
        <rect width="5" height="20" fill="red"/>
      </pattern></defs>
      <g fill="url(#stripes)">
        <rect x="0" y="0" width="20" height="20"/>
        <rect x="30" y="0" width="20" height="20"/>
        <path d="M30 30 H50 V50 H30 Z"/>
      </g>
    </svg>
  `));
  const points = await page.evaluate(() => {
    const api = window.gizmoTest.api();
    const rects = api.getNodes().filter((node) => node.type === 'rect')
      .sort((a, b) => a.x - b.x);
    const path = api.getNodes().find((node) => node.type === 'path')!;
    const samples: [SerializedNode, number][] = [
      [rects[0], 7], [rects[0], 2],
      [rects[1], 17], [rects[1], 7],
      [path, 17], [path, 7],
    ];
    return samples.map(([node, dx]) => {
      const bounds = api.getGeometryBounds([node]);
      return api.canvas2Viewport({
        x: bounds.minX + Number(dx), y: bounds.minY + 10,
      });
    });
  });
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    return points.map((point) => {
      const [r, g, b] = canvasRgbAt(png, point.x, point.y);
      return r > 150 && r > g * 2 && r > b * 2;
    });
  }, { timeout: 10_000 }).toEqual([true, false, true, false, true, false]);
});

test('zoomed SVG pattern keeps its tile spacing and rerasterizes the tile', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const url = await page.evaluate(async () => {
    await window.gizmoTest.showSvgArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="4" fill="red"/>
      </pattern></defs>
      <rect width="80" height="80" fill="url(#dots)"/>
    </svg>`);
    const rect = window.gizmoTest.api().getNodes().find((node) => node.type === 'rect');
    const fill = rect?.type === 'rect' ? rect.fills?.[0] : undefined;
    if (!fill || fill.type !== 'pattern') throw new Error('Expected an SVG pattern');
    return fill.value;
  });
  await page.evaluate(async () => {
    window.gizmoTest.api().gotoLandmark({ x: 100, y: 100, zoom: 3 }, { duration: 0 });
    await window.gizmoTest.settle();
  });
  await expect.poll(() => page.evaluate((source) =>
    window.gizmoTest.svgFillRasterSize(source)?.width ?? 0, url),
  ).toBeGreaterThanOrEqual(80);
  const points = await page.evaluate(() => {
    const api = window.gizmoTest.api();
    const rect = api.getNodes().find((node) => node.type === 'rect')!;
    return [50, 60, 70].map((x) => api.canvas2Viewport({
      x: rect.x + x, y: rect.y + 50,
    }));
  });
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const [first, gap, second] = points.map((point) =>
    canvasRgbAt(png, point.x, point.y));
  for (const [r, g, b] of [first, second]) {
    expect(r).toBeGreaterThan(150);
    expect(r).toBeGreaterThan(g * 2);
    expect(r).toBeGreaterThan(b * 2);
  }
  expect(gap[1]).toBeGreaterThan(140);
  expect(gap[2]).toBeGreaterThan(140);
});

test('zoomed opaque SVG pattern has no visible tile seams', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const url = await page.evaluate(async () => {
    await window.gizmoTest.showSvgArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <defs><pattern id="solid" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="red"/>
      </pattern></defs>
      <rect width="100" height="100" fill="url(#solid)"/>
    </svg>`);
    const rect = window.gizmoTest.api().getNodes().find((node) => node.type === 'rect' && node.width === 100);
    const fill = rect?.type === 'rect' ? rect.fills?.[0] : undefined;
    if (!fill || fill.type !== 'pattern') throw new Error('Expected an SVG pattern');
    window.gizmoTest.api().gotoLandmark({ x: 100, y: 100, zoom: 3 }, { duration: 0 });
    await window.gizmoTest.settle();
    return fill.value;
  });
  await expect.poll(() => page.evaluate((source) =>
    window.gizmoTest.svgFillRasterSize(source)?.width ?? 0, url),
  ).toBeGreaterThanOrEqual(80);
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    let missing = 0;
    for (let x = 20; x < 130; x++) {
      const [r, g, b] = canvasRgbAt(png, x, 100);
      if (r < 150 || g > 80 || b > 80) missing++;
    }
    return missing;
  }, { timeout: 10_000 }).toBe(0);
});

test('SVG pattern tiles render local gradients and embedded images', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWP4z8DwHwAFAAH/e+m+7wAAAABJRU5ErkJggg==';
  await page.evaluate((src) => window.gizmoTest.showSvgArtwork(`
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="40">
      <defs>
        <linearGradient id="shade"><stop stop-color="blue"/>
          <stop offset="1" stop-color="lime"/></linearGradient>
        <pattern id="tile" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="url(#shade)"/>
          <image x="6" y="6" width="8" height="8" href="${src}"/>
        </pattern>
      </defs>
      <rect width="80" height="40" fill="url(#tile)"/>
    </svg>
  `), image);
  const points = await page.evaluate(() => {
    const api = window.gizmoTest.api();
    const rect = api.getNodes().find((node) => node.type === 'rect')!;
    const bounds = api.getGeometryBounds([rect]);
    return [2, 10, 18, 30].map((x) => api.canvas2Viewport({
      x: bounds.minX + x, y: bounds.minY + 10,
    }));
  });
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    const colors = points.map((point) => canvasRgbAt(png, point.x, point.y));
    return [
      colors[0][2] > colors[0][1] * 2,
      colors[1][0] > colors[1][1] * 2,
      colors[2][1] > colors[2][2] * 2,
      colors[3][0] > colors[3][1] * 2,
    ];
  }, { timeout: 10_000 }).toEqual([true, true, true, true]);
});

});

test('SVG circular radial gradient keeps its colors and local center in 2D', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const artwork = await window.gizmoTest.showSvgArtwork(`
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="140">
        <defs><radialGradient id="glow" gradientUnits="userSpaceOnUse"
          cx="60" cy="70" r="50">
          <stop offset="0" stop-color="red"/>
          <stop offset="1" stop-color="blue"/>
        </radialGradient></defs>
        <rect x="10" y="20" width="100" height="100" fill="url(#glow)"/>
      </svg>
    `);
    const rect = window.gizmoTest.api().getNodes().find((node) => node.type === 'rect');
    return { ...artwork, fill: rect?.type === 'rect' ? rect.fills?.[0] : undefined };
  });
  expect(result.extrudedNodes).toBe(0);
  expect(result.fill).toMatchObject({
    type: 'gradient',
    value: 'radial-gradient(circle 50px at 50px 50px, red 0%, blue 100%)',
  });
  const png = PNG.sync.read(await page.locator('#canvas').screenshot());
  const [centerRed, , centerBlue] = canvasRgbAt(png, 100, 100);
  const [edgeRed, , edgeBlue] = canvasRgbAt(png, 140, 100);
  expect(centerRed).toBeGreaterThan(centerBlue * 2);
  expect(edgeBlue).toBeGreaterThan(edgeRed * 2);
});

test('SVG elliptical radial fill matches the native paint with a shifted focus', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60">
      <defs><radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"
        fx="0.2" fy="0.35" gradientTransform="rotate(12 0.5 0.5)">
        <stop offset="0" stop-color="#ff0000"/>
        <stop offset="1" stop-color="#0000ff"/>
      </radialGradient></defs>
      <rect width="120" height="60" fill="url(#glow)"/>
    </svg>`;
    const artwork = await window.gizmoTest.showSvgArtwork(source);
    const rect = window.gizmoTest.api().getNodes().find((node) => node.type === 'rect');
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 60;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const samples = [[15, 30], [40, 20], [75, 30], [105, 40]];
    return {
      ...artwork,
      fillType: rect?.type === 'rect' ? rect.fills?.[0]?.type : undefined,
      samples,
      expected: samples.map(([x, y]) =>
        Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3)),
    };
  });
  expect(result.extrudedNodes).toBe(0);
  expect(result.fillType).toBe('image');
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    return Math.max(...result.samples.map(([x, y], index) => {
      const actual = canvasRgbAt(png, 40 + x, 70 + y);
      const expected = result.expected[index];
      return Math.max(...actual.map((value, channel) => Math.abs(value - expected[channel])));
    }));
  }, { timeout: 10_000 }).toBeLessThan(35);
});

test('SVG radial image fills align with Path and circle geometry', async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80">
      <defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5" fx="0.3" fy="0.3">
        <stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/>
      </radialGradient></defs>
      <path d="M10 10 H70 V70 H10 Z M30 30 H50 V50 H30 Z" fill-rule="evenodd" fill="url(#g)"/>
      <circle cx="120" cy="40" r="30" fill="url(#g)"/>
    </svg>`;
    const artwork = await window.gizmoTest.showSvgArtwork(source);
    const nodes = window.gizmoTest.api().getNodes();
    const path = nodes.find((node) => node.type === 'path');
    const circle = nodes.find((node) => node.type === 'ellipse');
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const samples = [[20, 20], [60, 60], [105, 40], [135, 40]];
    return {
      ...artwork,
      fillTypes: [path, circle].map((node) => node?.fills?.[0]?.type),
      offset: [path!.x - 10, path!.y - 10],
      samples,
      expected: samples.map(([x, y]) =>
        Array.from(context.getImageData(x, y, 1, 1).data).slice(0, 3)),
    };
  });
  expect(result.extrudedNodes).toBe(0);
  expect(result.fillTypes).toEqual(['image', 'image']);
  await expect.poll(async () => {
    const png = PNG.sync.read(await page.locator('#canvas').screenshot());
    return Math.max(...result.samples.map(([x, y], index) => {
      const actual = canvasRgbAt(png, x + result.offset[0], y + result.offset[1]);
      const expected = result.expected[index];
      return Math.max(...actual.map((value, channel) => Math.abs(value - expected[channel])));
    }));
  }, { timeout: 10_000 }).toBeLessThan(35);
});

for (const shape of ['rect', 'path'] as const) test(`zooming into an SVG ${shape} fill rerasterizes its vector source`, async ({ page }) => {
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const url = await page.evaluate(async (shape) => {
    await window.gizmoTest.showSvgArtwork(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
      <defs><radialGradient id="g" fx="0.2" fy="0.3">
        <stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/>
      </radialGradient></defs>
      ${shape === 'rect'
        ? '<rect width="80" height="80" fill="url(#g)"/>'
        : '<path d="M0 0 H80 V80 H0 Z" fill="url(#g)"/>'}
    </svg>`);
    const node = window.gizmoTest.api().getNodes().find((node) => node.type === shape);
    const fill = node && 'fills' in node ? node.fills?.[0] : undefined;
    if (!fill || fill.type !== 'image') throw new Error('Expected an SVG image fill');
    return fill.value;
  }, shape);
  await expect.poll(() => page.evaluate((source) =>
    window.gizmoTest.svgFillRasterSize(source)?.width ?? 0, url),
  ).toBeGreaterThanOrEqual(80);
  await page.evaluate(async () => {
    window.gizmoTest.api().gotoLandmark({ x: 100, y: 100, zoom: 3 }, { duration: 0 });
    await window.gizmoTest.settle();
  });
  await expect.poll(() => page.evaluate((source) =>
    window.gizmoTest.svgFillRasterSize(source)?.width ?? 0, url),
  ).toBeGreaterThanOrEqual(320);
  const rasterAtZoom3 = await page.evaluate((source) =>
    window.gizmoTest.svgFillRasterSize(source)?.width, url);
  await page.evaluate(async () => {
    window.gizmoTest.api().gotoLandmark({ x: 100, y: 100, zoom: 3.4 }, { duration: 0 });
    await window.gizmoTest.settle();
  });
  expect(await page.evaluate((source) =>
    window.gizmoTest.svgFillRasterSize(source)?.width, url)).toBe(rasterAtZoom3);
});

test('App SVG import, extrusion editing and GLB export work together', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(() =>
    window.gizmoTest.importAndExportSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"
      viewBox="0 0 200 100"><g fill="#33aabb">
      <path d="M60 20 H140 V80 H60 Z M80 40 H120 V60 H80 Z" fill-rule="evenodd"/>
      <path d="M10 10 L30 30" fill="none" stroke="black"/>
      </g></svg>`),
  );
  const extruded = result.nodes.filter(
    (node) => 'extrude3d' in node && node.extrude3d,
  );
  expect(extruded).toHaveLength(2);
  expect(extruded[0]).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    extrude3d: {
      depth: 32,
      bevelSize: 3,
      bevelSegments: 4,
      sideColor: '#ff00ff',
    },
  });
  expect(result.nodes.filter((node) => node.type === 'path')).toHaveLength(2);
  expect(extruded[1]).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    fills: [{ type: 'solid', value: 'black' }],
  });
  const initial = glbJson(result.initialGlb);
  const edited = glbJson(result.editedGlb);
  expect(initial.meshes).toHaveLength(2);
  expect(edited.meshes).toHaveLength(2);
  expect(edited.meshes[0].primitives).toHaveLength(2);
  expect(
    edited.materials.some(
      (material: { pbrMetallicRoughness: { baseColorFactor: number[] } }) =>
        material.pbrMetallicRoughness.baseColorFactor[0] > 0.9 &&
        material.pbrMetallicRoughness.baseColorFactor[1] < 0.1,
    ),
  ).toBe(true);
  expect(result.editedGlb.length).toBeGreaterThan(result.initialGlb.length);
  expect(errors).toEqual([]);
});

test('repeated SVG instances keep separate editable meshes and GLB exports', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(() =>
    window.gizmoTest.importAndExportSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" width="240" height="80">
        <defs><path id="tile" d="M0 0 H50 V50 H0 Z" fill="#33aabb"/></defs>
        <use href="#tile" x="0"/><use href="#tile" x="80"/>
        <use href="#tile" x="160"/>
      </svg>`),
  );
  expect(
    result.nodes.filter((node) => 'extrude3d' in node && node.extrude3d),
  ).toHaveLength(3);
  expect(glbJson(result.initialGlb).meshes).toHaveLength(3);
  expect(glbJson(result.editedGlb).meshes).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('an imported SVG hole produces a visible 3D companion and restores its 2D source', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const before = await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    const state = window.gizmoTest.svgExtrusionState();
    await api.edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
    await window.gizmoTest.settle();
    return state;
  });
  expect(before).toMatchObject({
    type: 'path',
    fillRule: 'evenodd',
    depth: 20,
  });
  expect(before.triangles).toBeGreaterThan(0);
  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (g > r * 1.3 && b > r * 1.3 && g > 70) teal++;
  }
  expect(teal).toBeGreaterThan(100);

  await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), { extrude3d: false }),
    );
    await window.gizmoTest.settle();
  });
  expect(
    await page.evaluate(() => {
      const node = window.gizmoTest.api().getNodeById('model');
      return 'extrude3d' in node ? node.extrude3d : undefined;
    }),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('an SVG ellipse renders its curved extrusion mesh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePrimitive');
  await expect(page.locator('#status')).toHaveText('Ready');
  const state = await page.evaluate(() => window.gizmoTest.svgExtrusionState());
  expect(state).toMatchObject({ type: 'path', depth: 20 });
  expect(state.triangles).toBeGreaterThan(20);

  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (g > r * 1.3 && b > r * 1.3 && g > 20) teal++;
  }
  expect(teal).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('side color paints only the walls without rebuilding SVG geometry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const uploads = await page.evaluate(async () => {
    const api = window.gizmoTest.api();
    await api.edit((editor) => editor.selectNodes([]), { capture: 'NEVER' });
    await window.gizmoTest.settle();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), {
        extrude3d: { depth: 20, rotation: [0.6, -0.5, 0] },
      }),
    );
    await window.gizmoTest.settle();
    window.gizmoTest.trackGeometryUploads();
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById('model'), {
        extrude3d: {
          depth: 20,
          rotation: [0.6, -0.5, 0],
          sideColor: '#ff00ff',
        },
      }),
    );
    await window.gizmoTest.settle();
    return window.gizmoTest.geometryUploads();
  });
  expect(uploads).toBe(0);

  const pixels = PNG.sync.read(await page.locator('#canvas').screenshot());
  let magenta = 0;
  let teal = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (r > g * 1.4 && b > g * 1.4 && r > 40 && b > 40) magenta++;
    if (g > r * 1.3 && b > r * 1.3 && g > 40) teal++;
  }
  expect(magenta).toBeGreaterThan(20);
  expect(teal).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('switching an SVG extrusion from straight to rounded bevel updates its rendered mesh', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/gizmo.html?extrudePath');
  await expect(page.locator('#status')).toHaveText('Ready');
  const profile = async (bevelSegments: number) =>
    page.evaluate(async (segments) => {
      const api = window.gizmoTest.api();
      await api.edit((editor) => {
        editor.selectNodes([]);
        editor.updateNode(editor.getNodeById('model'), {
          extrude3d: {
            depth: 20,
            bevelSize: 4,
            bevelSegments: segments,
            rotation: [0.6, -0.5, 0],
            sideColor: '#ff00ff',
          },
        });
      });
      await window.gizmoTest.settle();
      return window.gizmoTest.svgExtrusionState().triangles;
    }, bevelSegments);

  const straight = await profile(1);
  const straightPixels = PNG.sync.read(
    await page.locator('#canvas').screenshot(),
  );
  const rounded = await profile(4);
  const roundedPixels = PNG.sync.read(
    await page.locator('#canvas').screenshot(),
  );
  expect(rounded).toBeGreaterThan(straight);

  let magenta = 0;
  let changed = 0;
  for (let i = 0; i < roundedPixels.data.length; i += 4) {
    const [r, g, b] = roundedPixels.data.subarray(i, i + 3);
    if (r > g * 1.4 && b > g * 1.4 && r > 40 && b > 40) magenta++;
    if (
      Math.max(
        Math.abs(r - straightPixels.data[i]),
        Math.abs(g - straightPixels.data[i + 1]),
        Math.abs(b - straightPixels.data[i + 2]),
      ) > 20
    )
      changed++;
  }
  expect(magenta).toBeGreaterThan(20);
  expect(changed).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});
