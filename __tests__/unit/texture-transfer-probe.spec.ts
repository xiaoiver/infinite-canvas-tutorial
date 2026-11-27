import { installTextureTransfers } from '../browser/fixtures/texture-transfer-probe';
describe('native texture transfer recorder', () => {
  let oldWindow: any, gl: any, probe: any, original: any;
  beforeEach(() => {
    oldWindow = globalThis.window;
    class GL {
      TEXTURE0 = 33984;
      TEXTURE_2D = 3553;
      RGBA32F = 34836;
      RGBA = 6408;
      FLOAT = 5126;
      createTexture() {
        return {};
      }
      deleteTexture(_texture: any) {}
      activeTexture(_unit: number) {}
      bindTexture(_target: number, _texture: any) {}
      texStorage2D(..._args: any[]) {}
      texImage2D(..._args: any[]) {}
      texSubImage2D(..._args: any[]) {}
    }
    class GL2 extends GL {}
    original = GL.prototype.texSubImage2D;
    globalThis.window = {
      WebGLRenderingContext: GL,
      WebGL2RenderingContext: GL2,
    } as any;
    installTextureTransfers();
    gl = new GL2();
    probe = (window as any).textureTransfers;
  });
  afterEach(() => {
    probe?.dispose();
    globalThis.window = oldWindow;
  });
  it('counts an inherited API once and records full typed source bytes', () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 4, 2);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      4,
      2,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array(32),
    );
    expect(probe.snapshot()).toMatchObject({
      creates: 1,
      uploads: 1,
      typedBytes: 128,
      rgba32fBytesLive: 128,
      rgba32fBytesPeak: 128,
    });
  });
  it('tracks active units and records staging peaks before retirement', () => {
    const a = gl.createTexture(),
      b = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, a);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 4, 4);
    gl.activeTexture(gl.TEXTURE0 + 1);
    gl.bindTexture(gl.TEXTURE_2D, b);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 8, 4);
    gl.activeTexture(gl.TEXTURE0);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 2, 2);
    expect(probe.snapshot()).toMatchObject({
      rgba32fBytesLive: 576,
      rgba32fBytesPeak: 768,
    });
    gl.deleteTexture(a);
    expect(probe.snapshot().rgba32fBytesLive).toBe(512);
    probe.reset();
    expect(probe.snapshot().rgba32fBytesPeak).toBe(512);
    gl.deleteTexture(b);
    expect(probe.snapshot().rgba32fBytesLive).toBe(0);
  });
  it('separates DOM and offset uploads from known typed-byte totals', () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, 5121, {
      width: 4,
      height: 4,
    });
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      1,
      1,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array(8),
      4,
    );
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RGBA, gl.FLOAT, 0);
    expect(probe.snapshot()).toMatchObject({
      uploads: 3,
      typedBytes: 0,
      domUploads: 1,
      offsetUploads: 2,
    });
  });
  it('restores descriptors and disables wrappers retained by another observer', () => {
    expect(() => installTextureTransfers()).toThrow('already installed');
    const retained = Object.getPrototypeOf(
      Object.getPrototypeOf(gl),
    ).texSubImage2D;
    probe.dispose();
    expect(Object.getPrototypeOf(Object.getPrototypeOf(gl)).texSubImage2D).toBe(
      original,
    );
    expect((window as any).textureTransfers).toBeUndefined();
    retained.call(
      gl,
      gl.TEXTURE_2D,
      0,
      0,
      0,
      1,
      1,
      gl.RGBA,
      gl.FLOAT,
      new Float32Array(4),
    );
    expect(probe.snapshot().typedBytes).toBe(0);
  });
});
