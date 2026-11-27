/** The same resource and cache contract is exercised against both renderers. */
export function strokeReuseContract(
  makePath: () => any,
  changePath: (shape: any, d: string) => void,
  makeDraw: (device: any, full?: boolean) => any,
) {
  const prepare = (draw: any, shape: any) => {
    draw.shapes = [shape];
    draw.prepareGeometry({});
    return draw.pathPoints.get(shape);
  };
  it('reuses screen curve levels across page retirement while full passes and devices stay independent', () => {
    const shape = makePath(),
      owner = {};
    const first = makeDraw(owner),
      next = makeDraw(owner);
    const points = prepare(first, shape);
    first.destroy();
    expect(prepare(next, shape)).toBe(points);
    expect(prepare(makeDraw(owner, true), shape)).not.toBe(points);
    expect(prepare(makeDraw({}), shape)).not.toBe(points);
    changePath(shape, 'M0 0 C20 -40 30 50 60 0');
    const edited = prepare(next, shape);
    expect(edited).not.toBe(points);
    expect(prepare(makeDraw(owner), shape)).toBe(edited);
    changePath(shape, '');
    expect(prepare(next, shape)).toEqual([]);
  });
  it('shares linear projection work inside one page and refreshes reused camera uniforms for the next pass', () => {
    const shapes = Array.from({length: 12}, makePath), draw = makeDraw({});
    const uniforms = {u_ProjectionMatrix:[1,0,0,0,1,0,0,0,1],u_ViewMatrix:[1,0,0,0,1,0,0,0,1],u_Viewport:[2,2]};
    draw.shapes = shapes;
    draw.prepareGeometry(uniforms);
    const old = draw.pathPoints.get(shapes[0]);
    const hypot = jest.spyOn(Math, 'hypot');
    try {
      draw.prepareGeometry(uniforms);
      expect(hypot).toHaveBeenCalledTimes(6);
    } finally { hypot.mockRestore(); }
    uniforms.u_ViewMatrix[0] = uniforms.u_ViewMatrix[4] = 16;
    draw.geometryDirty = false;
    draw.prepareGeometry(uniforms);
    expect(draw.pathPoints.get(shapes[0])).not.toBe(old);
    expect(draw.geometryDirty).toBe(true);
    const full = makeDraw({}, true);
    full.shapes = [shapes[0]];
    full.prepareGeometry(uniforms);
    expect(draw.pathPoints.get(shapes[0])).toEqual(full.pathPoints.get(shapes[0]));
    const singleHypot = jest.spyOn(Math, 'hypot');
    try {
      full.prepareGeometry(uniforms);
      expect(singleHypot).toHaveBeenCalledTimes(6);
    } finally { singleHypot.mockRestore(); }

  });
  function resources() {
    const buffers: any[] = [];
    const allocate = () => {
      const buffer = { destroy: jest.fn(), setSubData: jest.fn() };
      buffers.push(buffer);
      return buffer;
    };
    return { buffers, allocate, device: { createBuffer: jest.fn(allocate) } };
  }
  it('uploads the owned Float32 stroke snapshots directly and replaces them independently on rebuild', () => {
    const { device } = resources();
    const shape = makePath(), draw = makeDraw(device);
    prepare(draw, shape);
    draw.createGeometry();
    const check = () => {
      const points = draw.vertexBufferDatas[0] as Float32Array;
      const travel = draw.vertexBufferDatas[6] as Float32Array;
      const pointUpload = draw.vertexBuffers[0].setSubData.mock.calls.at(-1)[1] as Uint8Array;
      const travelUpload = draw.vertexBuffers[6].setSubData.mock.calls.at(-1)[1] as Uint8Array;
      expect(draw.pointsBuffer).toBe(points);
      expect(draw.travelBuffer).toBe(travel);
      expect(pointUpload.buffer).toBe(points.buffer);
      expect(travelUpload.buffer).toBe(travel.buffer);
      expect(pointUpload.byteLength).toBe(points.byteLength);
      expect(travelUpload.byteLength).toBe(travel.byteLength);
      expect(points).toEqual(new Float32Array(draw.pointsBuffer));
      expect(travel).toEqual(new Float32Array(draw.travelBuffer));
      expect(draw.vertexBufferDatas.slice(0, 5).every((v: unknown) => v === points)).toBe(true);
      return { points, travel };
    };
    const first = check();
    const originalPoints = first.points.slice(), originalTravel = first.travel.slice();
    changePath(shape, 'M0 0 C20 -40 30 50 60 0 L100 20');
    prepare(draw, shape);
    draw.createGeometry();
    const second = check();
    expect(second.points.buffer).not.toBe(first.points.buffer);
    expect(second.travel.buffer).not.toBe(first.travel.buffer);
    expect(first.points).toEqual(originalPoints);
    expect(first.travel).toEqual(originalTravel);
    draw.destroy();
  });
  it('keeps the full non-page builder on its existing number-array path', () => {
    const { device } = resources(), shape=makePath(), draw=makeDraw(device,true);
    prepare(draw,shape);draw.createGeometry();
    expect(Array.isArray(draw.pointsBuffer)).toBe(true);
    expect(Array.isArray(draw.travelBuffer)).toBe(true);
    expect(draw.vertexBufferDatas[0]).toEqual(new Float32Array(draw.pointsBuffer));
    draw.destroy();
  });
  it('keeps fixed buffers and retained capacity through edits, resizes pairs, and releases once', () => {
    const { device, buffers } = resources();
    const shape = makePath(),
      draw = makeDraw(device);
    prepare(draw, shape);
    draw.createGeometry();
    expect(buffers).toHaveLength(4);
    const initial = [...buffers];
    const index = draw.indexBuffer,
      vertices = draw.vertexBuffers[5];
    for (let i = 0; i < 3; i++) draw.createGeometry();
    expect(buffers).toHaveLength(4);
    expect(index.destroy).not.toHaveBeenCalled();
    expect(vertices.destroy).not.toHaveBeenCalled();
    const long =
      'M0 0' +
      Array.from({ length: 300 }, (_, i) => `L${i + 1} ${i % 2}`).join('');
    changePath(shape, long);
    prepare(draw, shape);
    draw.createGeometry();
    expect(buffers).toHaveLength(6);
    expect(draw.indexBuffer).toBe(index);
    expect(draw.vertexBuffers[5]).toBe(vertices);
    expect(
      initial.filter((b) => b.destroy.mock.calls.length === 1),
    ).toHaveLength(2);
    changePath(shape, 'M0 0 L10 10');
    prepare(draw, shape);
    draw.createGeometry();
    expect(buffers).toHaveLength(8);
    draw.destroy();
    draw.destroy();
    expect(buffers.every((b) => b.destroy.mock.calls.length === 1)).toBe(true);
    draw.submit(null, null, {}, null);
    expect(buffers).toHaveLength(8);
  });
  it('rolls back partial dynamic allocation without destroying the old page, then retries cleanly', () => {
    const { device, buffers, allocate } = resources();
    const shape = makePath(),
      draw = makeDraw(device);
    prepare(draw, shape);
    draw.createGeometry();
    const original = [...draw.vertexBuffers];
    changePath(
      shape,
      'M0 0' +
        Array.from({ length: 300 }, (_, i) => `L${i + 1} ${i % 2}`).join(''),
    );
    prepare(draw, shape);
    device.createBuffer
      .mockImplementationOnce(allocate)
      .mockImplementationOnce(() => {
        throw new Error('allocation failure');
      });
    expect(() => draw.createGeometry()).toThrow('allocation failure');
    expect(draw.vertexBuffers).toEqual(original);
    expect(
      buffers.slice(0, 4).every((b) => b.destroy.mock.calls.length === 0),
    ).toBe(true);
    expect(buffers[4].destroy).toHaveBeenCalledTimes(1);
    draw.createGeometry();
    draw.destroy();
    expect(buffers.every((b) => b.destroy.mock.calls.length === 1)).toBe(true);
  });
}

export function strokePrecisionContextContract(Cache: new () => any) {
  it('shares curve levels while keeping camera/page hysteresis independent and invalidating every context after edits', () => {
    const d = 'M0 0 C30 -80 70 120 100 0';
    const pool = new Cache(),
      fine = pool.fork(),
      coarse = pool.fork();
    const refined = fine.get(d, 4, 4);
    const low = coarse.get(d, 1.5, 0);
    expect(low).toEqual(new Cache().get(d, 1.5, 0));
    expect(fine.get(d, 2, 2)).toBe(refined);
    expect(pool.fork().get(d, 4, 4)).toBe(refined);
    expect(pool.fork().get(d, 1.5, 0)).toBe(low);
    const changed = d + ' L140 20';
    const edited = fine.get(changed, 2, 2);
    expect(coarse.get(changed, 2, 2)).toBe(edited);
    expect(coarse.get(changed, 2, 2)).not.toBe(refined);
    expect(edited).toEqual(new Cache().get(changed, 2, 2));
  });
}


export function strokeSegmentCacheContract(Cache: new () => any) {
  it('reuses live point levels for one owner/style and preserves hits after a failed build', () => {
    const cache = new Cache(),
      owner = {},
      points = {},
      other = {};
    const build = jest.fn(() => ({}));
    const first = cache.get(owner, points, 'round', 'miter', build);
    expect(cache.get(owner, points, 'round', 'miter', build)).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
    expect(() =>
      cache.get(owner, other, 'butt', 'round', () => {
        throw new Error('build');
      }),
    ).toThrow('build');
    expect(cache.get(owner, points, 'round', 'miter', build)).toBe(first);
    expect(cache.get(owner, points, 'butt', 'round', build)).not.toBe(first);
    const restyled = cache.get(owner, points, 'round', 'miter', build);
    expect(restyled).not.toBe(first);
    const refined = cache.get(owner, other, 'round', 'miter', build);
    expect(refined).not.toBe(first);
    expect(cache.get(owner, points, 'round', 'miter', build)).toBe(restyled);
    expect(cache.get(other, points, 'round', 'miter', build)).not.toBe(first);
    expect(cache.get(owner, undefined, 'round', 'miter', build)).not.toBe(
      cache.get(owner, undefined, 'round', 'miter', build),
    );
    expect(cache.get(owner, points, 'round', 'miter', build)).not.toBe(
      restyled,
    );
    expect(build).toHaveBeenCalledTimes(8);
  });
  it('caches undefined values and clears every sampled level on a successful style change', () => {
    const cache = new Cache(),
      owner = {},
      a = {},
      b = {};
    const build = jest.fn(() => undefined);
    cache.get(owner, a, 'round', 'miter', build);
    cache.get(owner, b, 'round', 'miter', build);
    cache.get(owner, a, 'round', 'miter', build);
    expect(build).toHaveBeenCalledTimes(2);
    expect(() =>
      cache.get(owner, b, 'butt', 'bevel', () => {
        throw new Error('style');
      }),
    ).toThrow('style');
    cache.get(owner, a, 'round', 'miter', build);
    expect(build).toHaveBeenCalledTimes(2);
    cache.get(owner, b, 'butt', 'bevel', build);
    cache.get(owner, a, 'round', 'miter', build);
    cache.get(owner, b, 'round', 'miter', build);
    expect(build).toHaveBeenCalledTimes(5);
  });
}

export function strokeSegmentReuseContract(
  makePath: () => any,
  changePath: (shape: any, d: string) => void,
  changeStyle: (shape: any, cap: CanvasLineCap, join: CanvasLineJoin) => void,
  move: (shape: any) => void,
  makeDraw: (device: any, full?: boolean) => any,
) {
  const prepare = (draw: any, shape: any, zoom = 1) => {
    draw.shapes = [shape];
    draw.prepareGeometry({
      u_ProjectionMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      u_ViewMatrix: [zoom, 0, 0, 0, zoom, 0, 0, 0, 1],
      u_Viewport: [2, 2],
    });
    return draw.getStrokeBuffers(shape);
  };
  it('reuses local segments across page retirement and placement changes while full passes and devices stay independent', () => {
    const shape = makePath(),
      device = {},
      first = makeDraw(device);
    const buffers = prepare(first, shape);
    const saved = {
      pointsBuffer: [...buffers.pointsBuffer],
      travelBuffer: [...buffers.travelBuffer],
    };
    first.destroy();
    const next = makeDraw(device);
    expect(prepare(next, shape)).toBe(buffers);
    move(shape);
    expect(prepare(next, shape)).toBe(buffers);
    const full = makeDraw(device, true);
    expect(prepare(full, shape)).toEqual(buffers);
    expect(prepare(full, shape)).not.toBe(buffers);
    expect(prepare(makeDraw({}), shape)).not.toBe(buffers);
    expect(buffers).toEqual(saved);
  });
  it('refreshes every cap/join and path edit and reuses live precision without changing local bytes', () => {
    const shape = makePath(),
      draw = makeDraw({}),
      full = makeDraw({}, true);
    let previous: unknown;
    for (const d of [
      'M0 0 C10 -20 20 30 30 0',
      'M0 0L20 0L20 20Z M40 0L60 10',
      'M0 0L10 20',
    ]) {
      changePath(shape, d);
      for (const cap of ['butt', 'round', 'square'] as const)
        for (const join of ['miter', 'round', 'bevel'] as const) {
          changeStyle(shape, cap, join);
          const buffers = prepare(draw, shape);
          expect(buffers).not.toBe(previous);
          expect(buffers).toEqual(prepare(full, shape));
          expect(prepare(draw, shape)).toBe(buffers);
          previous = buffers;
        }
    }
    const low = prepare(draw, shape, 1);
    expect(prepare(draw, shape, 8)).not.toBe(low);
    // Reuse only point identities still owned by the shared curve pool.
    const coarse = prepare(draw, shape, 1);
    expect(coarse).toBe(low);
    expect(coarse).toEqual(low);
    expect(prepare(draw, shape, 1)).toBe(coarse);
    for (const zoom of [16, 32, 64, 128]) prepare(draw, shape, zoom);
    const rebuilt = prepare(draw, shape, 1);
    expect(rebuilt).not.toBe(low);
    expect(rebuilt).toEqual(low);
  });
}
