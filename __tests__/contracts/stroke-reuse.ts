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
  function resources() {
    const buffers: any[] = [];
    const allocate = () => {
      const buffer = { destroy: jest.fn(), setSubData: jest.fn() };
      buffers.push(buffer);
      return buffer;
    };
    return { buffers, allocate, device: { createBuffer: jest.fn(allocate) } };
  }
  it('keeps fixed buffers through edits, replaces only dynamic pairs, and releases once', () => {
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
    expect(buffers).toHaveLength(10);
    expect(index.destroy).not.toHaveBeenCalled();
    expect(vertices.destroy).not.toHaveBeenCalled();
    const long =
      'M0 0' +
      Array.from({ length: 300 }, (_, i) => `L${i + 1} ${i % 2}`).join('');
    changePath(shape, long);
    prepare(draw, shape);
    draw.createGeometry();
    expect(buffers).toHaveLength(12);
    expect(draw.indexBuffer).toBe(index);
    expect(draw.vertexBuffers[5]).toBe(vertices);
    expect(
      initial.filter((b) => b.destroy.mock.calls.length === 1),
    ).toHaveLength(2);
    changePath(shape, 'M0 0 L10 10');
    prepare(draw, shape);
    draw.createGeometry();
    expect(buffers).toHaveLength(14);
    draw.destroy();
    draw.destroy();
    expect(buffers.every((b) => b.destroy.mock.calls.length === 1)).toBe(true);
    draw.submit(null, null, {}, null);
    expect(buffers).toHaveLength(14);
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
