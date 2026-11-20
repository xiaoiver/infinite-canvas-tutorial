export function glyphAtlasPoolContract(
  makePool: () => {
    acquire(
      device: any,
      key: string,
      create: () => any,
      share?: boolean,
    ): { key: string; manager: any; release(): void };
  },
) {
  const manager = () => ({ destroy: jest.fn() });
  it('shares a snapshot on one device and retires it only after the last idempotent release', () => {
    const pool = makePool(),
      device = {},
      value = manager(),
      create = jest.fn(() => value);
    const a = pool.acquire(device, 'font/glyphs', create),
      b = pool.acquire(device, 'font/glyphs', create);
    expect(create).toHaveBeenCalledTimes(1);
    expect(a.manager).toBe(b.manager);
    a.release();
    a.release();
    expect(value.destroy).not.toHaveBeenCalled();
    b.release();
    b.release();
    expect(value.destroy).toHaveBeenCalledTimes(1);
  });
  it('isolates devices and distinct immutable snapshots', () => {
    const pool = makePool(),
      device = {},
      create = jest.fn(manager);
    const leases = [
      pool.acquire(device, 'A', create),
      pool.acquire(device, 'AB', create),
      pool.acquire({}, 'A', create),
    ];
    expect(create).toHaveBeenCalledTimes(3);
    expect(new Set(leases.map((l) => l.manager)).size).toBe(3);
    leases[0].release();
    expect(leases[1].manager.destroy).not.toHaveBeenCalled();
    expect(leases[2].manager.destroy).not.toHaveBeenCalled();
    leases.slice(1).forEach((l) => l.release());
    leases.forEach((l) => expect(l.manager.destroy).toHaveBeenCalledTimes(1));
  });
  it('failed acquisition publishes nothing and leaves old leases usable for retry', () => {
    const pool = makePool(),
      device = {},
      old = manager();
    const previous = pool.acquire(device, 'old', () => old);
    const fail = jest.fn(() => {
      throw new Error('allocate/upload');
    });
    expect(() => pool.acquire(device, 'new', fail)).toThrow('allocate/upload');
    expect(() => pool.acquire(device, 'new', fail)).toThrow('allocate/upload');
    expect(fail).toHaveBeenCalledTimes(2);
    expect(old.destroy).not.toHaveBeenCalled();
    const next = pool.acquire(device, 'new', manager);
    previous.release();
    expect(next.manager.destroy).not.toHaveBeenCalled();
    next.release();
    expect(old.destroy).toHaveBeenCalledTimes(1);
  });
  it('does not retain retired snapshots or let an old release retire their replacements', () => {
    const pool = makePool(),
      device = {},
      create = jest.fn(manager);
    const a = pool.acquire(device, 'same', create);
    a.release();
    const b = pool.acquire(device, 'same', create);
    expect(create).toHaveBeenCalledTimes(2);
    expect(a.manager).not.toBe(b.manager);
    a.release();
    expect(b.manager.destroy).not.toHaveBeenCalled();
    b.release();
    expect(b.manager.destroy).toHaveBeenCalledTimes(1);
  });
  it('keeps unobservable-font/private acquisitions independent even on the same device', () => {
    const pool = makePool(),
      device = {},
      create = jest.fn(manager);
    const a = pool.acquire(device, 'same', create, false);
    const b = pool.acquire(device, 'same', create, false);
    expect(a.manager).not.toBe(b.manager);
    a.release();
    expect(b.manager.destroy).not.toHaveBeenCalled();
    b.release();
    expect(create).toHaveBeenCalledTimes(2);
  });
}
