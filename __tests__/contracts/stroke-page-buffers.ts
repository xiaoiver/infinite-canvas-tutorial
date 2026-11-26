/** Shared immutable GPU handles; dynamic page data stays independently owned. */
export function strokePageBuffersContract(
  makePath: () => any,
  makeDraw: (device: any, full?: boolean) => any,
) {
  const setup = () => {
    const buffers: any[] = [];
    const allocate = (descriptor: any) => {
      const b = { descriptor, destroy: jest.fn(), setSubData: jest.fn() };
      buffers.push(b);
      return b;
    };
    return { buffers, allocate, device: { createBuffer: jest.fn(allocate) } };
  };
  const build = (draw: any, shape: any) => {
    draw.shapes = [shape];
    draw.prepareGeometry({});
    draw.createGeometry();
    return draw;
  };
  it('shares constants across live pages while keeping dynamic buffers and snapshots independent', () => {
    const { buffers, device } = setup(),
      a = build(makeDraw(device), makePath()),
      b = build(makeDraw(device), makePath());
    expect(buffers).toHaveLength(6);
    expect(a.indexBuffer.descriptor.viewOrSize).toEqual(a.indexBufferData);
    expect(a.vertexBuffers[5].descriptor.viewOrSize).toEqual(
      a.vertexBufferDatas[5],
    );
    expect(a.indexBuffer).toBe(b.indexBuffer);
    expect(a.vertexBuffers[5]).toBe(b.vertexBuffers[5]);
    expect(a.vertexBuffers[0]).not.toBe(b.vertexBuffers[0]);
    expect(a.vertexBuffers[6]).not.toBe(b.vertexBuffers[6]);
    expect(a.pointsBuffer.buffer).not.toBe(b.pointsBuffer.buffer);
    const index = b.indexBuffer,
      vertices = b.vertexBuffers[5],
      old = b.pointsBuffer.slice();
    a.destroy();
    expect(index.destroy).not.toHaveBeenCalled();
    expect(vertices.destroy).not.toHaveBeenCalled();
    b.createGeometry();
    expect(b.indexBuffer).toBe(index);
    expect(b.vertexBuffers[5]).toBe(vertices);
    expect(b.pointsBuffer).toEqual(old);
    const c = build(makeDraw(device), makePath());
    expect(c.indexBuffer).toBe(index);
    b.destroy();
    expect(index.destroy).not.toHaveBeenCalled();
    c.destroy();
    expect(index.destroy).toHaveBeenCalledTimes(1);
    expect(vertices.destroy).toHaveBeenCalledTimes(1);
    for (const buffer of buffers)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
    const next = build(makeDraw(device), makePath());
    expect(next.indexBuffer).not.toBe(index);
    a.destroy();
    expect(next.indexBuffer.destroy).not.toHaveBeenCalled();
    next.destroy();
  });
  it('separates devices and full passes', () => {
    const one = setup(),
      two = setup(),
      a = build(makeDraw(one.device), makePath()),
      b = build(makeDraw(two.device), makePath()),
      full = build(makeDraw(one.device, true), makePath());
    expect(a.indexBuffer).not.toBe(b.indexBuffer);
    expect(a.indexBuffer).not.toBe(full.indexBuffer);
    expect(a.vertexBuffers[5]).not.toBe(full.vertexBuffers[5]);
    a.destroy();
    b.destroy();
    full.destroy();
  });
  it('rolls back failed constant creation and retries without publishing a dead pool', () => {
    const { buffers, allocate, device } = setup(),
      a = makeDraw(device);
    a.shapes = [makePath()];
    a.prepareGeometry({});
    device.createBuffer
      .mockImplementationOnce(allocate)
      .mockImplementationOnce(allocate)
      .mockImplementationOnce(allocate)
      .mockImplementationOnce(() => {
        throw new Error('constant allocation');
      });
    expect(() => a.createGeometry()).toThrow('constant allocation');
    for (const b of buffers) expect(b.destroy).toHaveBeenCalledTimes(1);
    a.createGeometry();
    const index = a.indexBuffer;
    const peer = build(makeDraw(device), makePath());
    expect(peer.indexBuffer).toBe(index);
    a.destroy();
    expect(index.destroy).not.toHaveBeenCalled();
    peer.destroy();
    expect(index.destroy).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])(
    'owns dynamic buffers after upload failure, with peer=%s',
    (withPeer) => {
      const { buffers, allocate, device } = setup(),
        draw = makeDraw(device);
      draw.shapes = [makePath()];
      draw.prepareGeometry({});
      const peer = withPeer ? build(makeDraw(device), makePath()) : undefined;
      device.createBuffer.mockImplementationOnce((d: any) => {
        const b = allocate(d);
        b.setSubData.mockImplementationOnce(() => {
          throw new Error('upload failure');
        });
        return b;
      });
      expect(() => draw.createGeometry()).toThrow('upload failure');
      draw.destroy();
      draw.destroy();
      if (peer) {
        expect(peer.indexBuffer.destroy).not.toHaveBeenCalled();
        peer.destroy();
      }
      for (const b of buffers) expect(b.destroy).toHaveBeenCalledTimes(1);
    },
  );
}
