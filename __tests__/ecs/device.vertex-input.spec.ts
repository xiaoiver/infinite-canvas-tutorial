import { BufferUsage, Format } from '../../packages/device-api/src/api';
import * as utils from '../../packages/device-api/src/webgl/utils';
import { Device_GL } from '../../packages/device-api/src/webgl/Device';

function fixture(webgl2: boolean) {
  const version = jest.spyOn(utils, 'isWebGL2').mockReturnValue(webgl2);
  const pointers: { buffer: unknown; args: (number | boolean)[] }[] = [];
  let bound: unknown;
  const gl = {
    ARRAY_BUFFER: 34962,
    ELEMENT_ARRAY_BUFFER: 34963,
    bindBuffer: jest.fn((target, buffer) => {
      if (target === 34962) bound = buffer;
    }),
    vertexAttribPointer: jest.fn((...args) =>
      pointers.push({ buffer: bound, args }),
    ),
  };
  const format = { size: 2, type: 5126, normalized: false };
  const attribute = (shaderLocation: number, offset: number) => ({
    shaderLocation,
    offset,
    vertexFormat: format,
  });
  const layout = {
    vao: {},
    indexBufferFormat: Format.U16_R,
    vertexBufferDescriptors: [
      {
        arrayStride: 32,
        attributes: [attribute(0, 0), attribute(1, 8), attribute(2, 16)],
      },
      { arrayStride: 16, attributes: [attribute(3, 0), attribute(4, 8)] },
    ],
    program: {
      attributes: [
        { location: 7 },
        { location: 2 },
        undefined,
        { location: 5 },
        { location: 11 },
      ],
    },
  };
  const device = Object.assign(Object.create(Device_GL.prototype), {
    gl,
    currentPipeline: { inputLayout: layout },
    bindVAO: jest.fn(),
  }) as Device_GL;
  const buffer = (name: string) => ({
    usage: name === 'index' ? BufferUsage.INDEX : BufferUsage.VERTEX,
    pageByteSize: 1024,
    gl_buffer_pages: [{ name }],
  });
  const a = buffer('a'),
    b = buffer('b'),
    index = buffer('index');
  const bind = (
    vertices: any[] = [{ buffer: a, offset: 12 }, { buffer: b }],
    offset = 4,
  ) =>
    device.setVertexInput(layout as any, vertices, {
      buffer: index as any,
      offset,
    });
  return { gl, pointers, layout, device, a, b, index, bind, version };
}

describe.each([true, false])('vertex input with WebGL2=%s', (webgl2) => {
  afterEach(() => jest.restoreAllMocks());
  it('preserves each attribute buffer, offset and mapped location with one bind per used slot', () => {
    const f = fixture(webgl2);
    f.bind();
    expect(f.gl.bindBuffer.mock.calls).toEqual([
      [34962, f.a.gl_buffer_pages[0]],
      [34962, f.b.gl_buffer_pages[0]],
      [34963, f.index.gl_buffer_pages[0]],
    ]);
    const expected = webgl2
      ? [
          [f.a, 0, 12, 32],
          [f.a, 1, 20, 32],
          [f.a, 2, 28, 32],
          [f.b, 3, 0, 16],
          [f.b, 4, 8, 16],
        ]
      : [
          [f.a, 7, 12, 32],
          [f.a, 2, 20, 32],
          [f.b, 5, 0, 16],
          [f.b, 11, 8, 16],
        ];
    expect(f.pointers).toEqual(
      expected.map(([buffer, location, offset, stride]) => ({
        buffer: (buffer as any).gl_buffer_pages[0],
        args: [location, 2, 5126, false, stride, offset],
      })),
    );
    expect((f.device as any).currentIndexBufferByteOffset).toBe(4);
  });
  it('does not retain a binding across calls, even with a shared layout and replaced buffers', () => {
    const f = fixture(webgl2);
    f.bind();
    const count = f.pointers.length;
    f.bind(
      [
        { buffer: f.b, offset: 20 },
        { buffer: f.a, offset: 4 },
      ],
      10,
    );
    expect(f.pointers[count]).toEqual({
      buffer: f.b.gl_buffer_pages[0],
      args: [webgl2 ? 0 : 7, 2, 5126, false, 32, 20],
    });
    expect(f.pointers[f.pointers.length - 1].buffer).toBe(
      f.a.gl_buffer_pages[0],
    );
    expect(f.gl.bindBuffer).toHaveBeenCalledTimes(6);
    expect((f.device as any).currentIndexBufferByteOffset).toBe(10);
  });
  it('leaves null vertex slots untouched and still binds the index buffer', () => {
    const f = fixture(webgl2);
    f.bind([null, { buffer: f.b }]);
    expect(f.gl.bindBuffer.mock.calls).toEqual([
      [34962, f.b.gl_buffer_pages[0]],
      [34963, f.index.gl_buffer_pages[0]],
    ]);
    expect(f.pointers.every((p) => p.buffer === f.b.gl_buffer_pages[0])).toBe(
      true,
    );
  });
  it('defers configuration until render-bundle replay', () => {
    const f = fixture(webgl2),
      bundle = [];
    (f.device as any).renderBundle = bundle;
    f.bind();
    expect(f.gl.bindBuffer).not.toHaveBeenCalled();
    (f.device as any).renderBundle = null;
    bundle[0]();
    expect(f.gl.bindBuffer).toHaveBeenCalledTimes(3);
  });
});
it('does not bind buffers for a WebGL1 slot whose attributes were optimized out', () => {
  const f = fixture(false);
  try {
    f.layout.program.attributes = [];
    f.bind();
    expect(f.gl.bindBuffer.mock.calls).toEqual([
      [34963, f.index.gl_buffer_pages[0]],
    ]);
    expect(f.pointers).toEqual([]);
  } finally {
    f.version.mockRestore();
  }
});
