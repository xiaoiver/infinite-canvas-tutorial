import {
  glyphToRGBA,
  getSDFStage,
  edt1d,
  edt,
  INF,
  isBlack,
  isWhite,
  isSolid,
  sqr,
  seq,
} from '../../packages/ecs/src/utils/glyph/tiny-sdf';

describe('glyphToRGBA', () => {
  it('should convert grayscale to RGBA', () => {
    const data = new Uint8Array([0, 128, 255]);
    const result = glyphToRGBA(data, 3, 1);

    expect(result.width).toBe(3);
    expect(result.height).toBe(1);
    expect(result.data).toHaveLength(12); // 3 * 1 * 4

    // Check first pixel (all channels same as input)
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
    expect(result.data[3]).toBe(0);

    // Check second pixel
    expect(result.data[4]).toBe(128);
    expect(result.data[5]).toBe(128);
    expect(result.data[6]).toBe(128);
    expect(result.data[7]).toBe(128);
  });

  it('should add padding when specified', () => {
    const data = new Uint8Array([255, 255]);
    const result = glyphToRGBA(data, 2, 1, 1);

    expect(result.width).toBe(4); // 2 + 1 * 2
    expect(result.height).toBe(3); // 1 + 1 * 2
  });
});

describe('getSDFStage', () => {
  it('should create stage with correct buffer sizes', () => {
    const stage = getSDFStage(10);

    expect(stage.size).toBe(10);
    expect(stage.outer).toHaveLength(100); // 10 * 10
    expect(stage.inner).toHaveLength(100);
    expect(stage.xo).toHaveLength(100);
    expect(stage.yo).toHaveLength(100);
    expect(stage.xi).toHaveLength(100);
    expect(stage.yi).toHaveLength(100);
    expect(stage.f).toHaveLength(10);
    expect(stage.z).toHaveLength(11); // size + 1
    expect(stage.b).toHaveLength(10);
    expect(stage.t).toHaveLength(10);
    expect(stage.v).toHaveLength(10);
  });

  it('should create Float32Arrays for floating point buffers', () => {
    const stage = getSDFStage(5);
    expect(stage.outer).toBeInstanceOf(Float32Array);
    expect(stage.inner).toBeInstanceOf(Float32Array);
    expect(stage.xo).toBeInstanceOf(Float32Array);
  });

  it('should create Uint16Array for v buffer', () => {
    const stage = getSDFStage(5);
    expect(stage.v).toBeInstanceOf(Uint16Array);
  });
});

describe('edt1d', () => {
  it('should perform 1D distance transform', () => {
    const size = 5;
    const grid = new Float32Array([0, INF, INF, INF, 0]);
    const f = new Float32Array(size);
    const z = new Float32Array(size + 1);
    const v = new Uint16Array(size);

    edt1d(grid, 0, 1, size, f, z, v);

    // Distance from nearest zero should decrease towards center
    expect(grid[0]).toBe(0);
    expect(grid[4]).toBe(0);
    expect(grid[2]).toBe(4); // Distance squared from either end
  });

  it('should handle uniform grid', () => {
    const size = 3;
    const grid = new Float32Array([INF, INF, INF]);
    const f = new Float32Array(size);
    const z = new Float32Array(size + 1);
    const v = new Uint16Array(size);

    edt1d(grid, 0, 1, size, f, z, v);

    // All should remain INF (no zeros to calculate distance from)
    expect(grid.every(v => v === INF)).toBe(true);
  });

  it('should handle all zeros', () => {
    const size = 3;
    const grid = new Float32Array([0, 0, 0]);
    const f = new Float32Array(size);
    const z = new Float32Array(size + 1);
    const v = new Uint16Array(size);

    edt1d(grid, 0, 1, size, f, z, v);

    expect(grid.every(v => v === 0)).toBe(true);
  });
});

describe('edt', () => {
  it('should perform 2D distance transform', () => {
    const width = 3;
    const height = 3;
    const size = 5;
    const data = new Float32Array(size * size).fill(INF);
    data[0] = 0; // One zero in corner

    const f = new Float32Array(size);
    const z = new Float32Array(size + 1);
    const v = new Uint16Array(size);

    edt(data, 0, 0, width, height, size, f, z, v);

    // Corner should be 0, opposite corner should have distance
    expect(data[0]).toBe(0);
    // Distance squared to opposite corner (2,2) from (0,0) is 8
    expect(data[8]).toBeGreaterThan(0);
  });

  it('should handle horizontal pass only', () => {
    const width = 3;
    const height = 3;
    const size = 5;
    const data = new Float32Array(size * size).fill(INF);
    data[4] = 0; // Center

    const f = new Float32Array(size);
    const z = new Float32Array(size + 1);
    const v = new Uint16Array(size);

    edt(data, 0, 0, width, height, size, f, z, v, 1);

    // Should only do horizontal pass
    expect(data[4]).toBe(0);
  });

  it('should handle vertical pass only', () => {
    const width = 3;
    const height = 3;
    const size = 5;
    const data = new Float32Array(size * size).fill(INF);
    data[4] = 0; // Center

    const f = new Float32Array(size);
    const z = new Float32Array(size + 1);
    const v = new Uint16Array(size);

    edt(data, 0, 0, width, height, size, f, z, v, 2);

    // Should only do vertical pass
    expect(data[4]).toBe(0);
  });
});

describe('helper functions', () => {
  describe('isBlack', () => {
    it('should return true for 0', () => {
      expect(isBlack(0)).toBe(true);
    });

    it('should return false for non-zero values', () => {
      expect(isBlack(1)).toBe(false);
      expect(isBlack(255)).toBe(false);
    });
  });

  describe('isWhite', () => {
    it('should return true for 1', () => {
      expect(isWhite(1)).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isWhite(0)).toBe(false);
      expect(isWhite(0.5)).toBe(false);
      expect(isWhite(255)).toBe(false);
    });
  });

  describe('isSolid', () => {
    it('should return true for 0', () => {
      expect(isSolid(0)).toBe(true);
    });

    it('should return true for 1', () => {
      expect(isSolid(1)).toBe(true);
    });

    it('should return false for intermediate values', () => {
      expect(isSolid(0.5)).toBe(false);
      expect(isSolid(0.1)).toBe(false);
    });
  });

  describe('sqr', () => {
    it('should square numbers correctly', () => {
      expect(sqr(2)).toBe(4);
      expect(sqr(-3)).toBe(9);
      expect(sqr(0)).toBe(0);
      expect(sqr(0.5)).toBe(0.25);
    });
  });

  describe('seq', () => {
    it('should generate sequence with default params', () => {
      const result = seq(5);
      expect(result).toEqual([0, 1, 2, 3, 4]);
    });

    it('should generate sequence with custom start', () => {
      const result = seq(3, 10);
      expect(result).toEqual([10, 11, 12]);
    });

    it('should generate sequence with custom step', () => {
      const result = seq(4, 0, 2);
      expect(result).toEqual([0, 2, 4, 6]);
    });

    it('should handle empty sequence', () => {
      const result = seq(0);
      expect(result).toEqual([]);
    });
  });
});

describe('INF constant', () => {
  it('should be a large number', () => {
    expect(INF).toBe(1e10);
    expect(INF).toBeGreaterThan(1e9);
  });
});
