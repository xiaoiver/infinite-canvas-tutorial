import { expect } from '@playwright/test';
import type { ExportFormat } from '@infinite-canvas-tutorial/ecs';
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
