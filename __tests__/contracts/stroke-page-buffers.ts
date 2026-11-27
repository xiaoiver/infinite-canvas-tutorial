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

/** Retained data storage must remain owned, current, bounded and retryable. */
export function strokePageCapacityContract(
  makePath: () => any,
  move: (shape: any) => void,
  makeDraw: (device: any) => any,
) {
  const setup = () => {
    const buffers: any[] = [];
    const allocate = (descriptor: any) => {
      const value = descriptor.viewOrSize;
      const bytes = new Uint8Array(
        typeof value === 'number' ? value : value.byteLength,
      );
      if (typeof value !== 'number')
        bytes.set(
          new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
        );
      const buffer = {
        descriptor,
        bytes,
        destroy: jest.fn(),
        setSubData: jest.fn((offset: number, data: Uint8Array) =>
          bytes.set(data, offset),
        ),
      };
      buffers.push(buffer);
      return buffer;
    };
    const device = { createBuffer: jest.fn(allocate) };
    const draw = makeDraw(device);
    const build = (nodes: any[]) => {
      draw.shapes = nodes;
      draw.prepareGeometry({});
      draw.createGeometry();
    };
    const current = () => {
      for (const [index, data] of [
        [0, draw.pointsBuffer],
        [6, draw.travelBuffer],
      ] as const) {
        expect(
          draw.vertexBuffers[index].bytes.subarray(0, data.byteLength),
        ).toEqual(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
        );
      }
      expect(draw.instanceCount * 15).toBe(draw.pointsBuffer.length);
    };
    const close = () => {
      draw.destroy();
      draw.destroy();
      buffers.forEach((b) => expect(b.destroy).toHaveBeenCalledTimes(1));
    };
    return { buffers, allocate, device, draw, build, current, close };
  };
  it('retains dynamic handles while uploading current placement bytes', () => {
    const h = setup(),
      p = makePath();
    try {
      h.build([p]);
      const segment = h.draw.vertexBuffers[0],
        travel = h.draw.vertexBuffers[6],
        count = h.buffers.length;
      for (let i = 0; i < 4; i++) {
        move(p);
        h.build([p]);
        h.current();
        expect(h.draw.vertexBuffers[0]).toBe(segment);
        expect(h.draw.vertexBuffers[6]).toBe(travel);
      }
      expect(h.buffers).toHaveLength(count);
      expect(segment.setSubData).toHaveBeenCalledTimes(5);
      expect(travel.setSubData).toHaveBeenCalledTimes(5);
    } finally {
      h.close();
    }
  });
  it('grows and shrinks storage without changing the active instance count', () => {
    const h = setup(),
      nodes = Array.from({ length: 96 }, makePath);
    try {
      h.build(nodes.slice(0, 1));
      const small = h.draw.vertexBuffers[0],
        constant = h.draw.indexBuffer;
      h.build(nodes);
      const large = h.draw.vertexBuffers[0];
      expect(large).not.toBe(small);
      expect(small.destroy).toHaveBeenCalledTimes(1);
      h.current();
      const before = h.buffers.length;
      h.build(nodes.slice(0, 80));
      expect(h.draw.vertexBuffers[0]).toBe(large);
      expect(h.buffers).toHaveLength(before);
      h.current();
      h.build(nodes.slice(0, 1));
      expect(h.draw.vertexBuffers[0]).not.toBe(large);
      expect(large.destroy).toHaveBeenCalledTimes(1);
      expect(h.draw.indexBuffer).toBe(constant);
      expect(constant.destroy).not.toHaveBeenCalled();
      h.current();
      const capacity = h.draw.vertexBuffers[0].descriptor.viewOrSize / 60;
      expect(capacity).toBeGreaterThanOrEqual(h.draw.instanceCount);
      expect(capacity).toBeLessThanOrEqual(
        Math.max(16, h.draw.instanceCount + 15),
      );
    } finally {
      h.close();
    }
  });
  it.each([false, true])(
    'owns retained storage after a partial upload failure, retry=%s',
    (retry) => {
      const h = setup(),
        p = makePath();
      try {
        h.build([p]);
        const segment = h.draw.vertexBuffers[0],
          travel = h.draw.vertexBuffers[6],
          count = h.buffers.length;
        segment.setSubData.mockImplementationOnce(
          (offset: number, bytes: Uint8Array) => {
            segment.bytes.set(
              bytes.subarray(0, Math.min(60, bytes.length)),
              offset,
            );
            throw new Error('partial retained upload');
          },
        );
        move(p);
        expect(() => h.build([p])).toThrow('partial retained upload');
        expect(h.draw.vertexBuffers[0]).toBe(segment);
        expect(h.draw.vertexBuffers[6]).toBe(travel);
        expect(h.buffers).toHaveLength(count);
        expect(segment.destroy).not.toHaveBeenCalled();
        expect(travel.destroy).not.toHaveBeenCalled();
        if (retry) {
          h.build([p]);
          h.current();
          expect(h.buffers).toHaveLength(count);
        }
      } finally {
        h.close();
      }
    },
  );
  it.each([false, true])(
    'keeps old storage after failed growth, retry=%s',
    (retry) => {
      const h = setup(),
        nodes = Array.from({ length: 96 }, makePath);
      try {
        h.build(nodes.slice(0, 1));
        const segment = h.draw.vertexBuffers[0],
          travel = h.draw.vertexBuffers[6];
        h.device.createBuffer
          .mockImplementationOnce(h.allocate)
          .mockImplementationOnce(() => {
            throw new Error('growth allocation');
          });
        expect(() => h.build(nodes)).toThrow('growth allocation');
        expect(h.draw.vertexBuffers[0]).toBe(segment);
        expect(h.draw.vertexBuffers[6]).toBe(travel);
        expect(segment.destroy).not.toHaveBeenCalled();
        expect(travel.destroy).not.toHaveBeenCalled();
        if (retry) {
          h.build(nodes);
          expect(h.draw.vertexBuffers[0]).not.toBe(segment);
          h.current();
        }
      } finally {
        h.close();
      }
    },
  );
}
