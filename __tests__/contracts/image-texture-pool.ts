type Resource = { destroy(): void };
type Pool = {
  acquire(
    device: object,
    source: object,
    key: string,
    create: () => Resource,
  ): { texture: Resource; release(): void };
};
export function imageTexturePoolContract(make: () => Pool) {
  it('shares an uploaded snapshot and destroys it only after the final peer releases', () => {
    const pool = make(),
      device = {},
      source = {},
      texture = { destroy: jest.fn() },
      create = jest.fn(() => texture);
    const a = pool.acquire(device, source, '64:48', create),
      b = pool.acquire(device, source, '64:48', create);
    expect(a.texture).toBe(b.texture);
    expect(create).toHaveBeenCalledTimes(1);
    a.release();
    a.release();
    expect(texture.destroy).not.toHaveBeenCalled();
    b.release();
    expect(texture.destroy).toHaveBeenCalledTimes(1);
    const c = pool.acquire(device, source, '64:48', create);
    expect(create).toHaveBeenCalledTimes(2);
    c.release();
  });
  it('isolates GPU devices, immutable source versions and raster parameters', () => {
    const pool = make(),
      device = {},
      source = {};
    const textures: Resource[] = [];
    const create = () => {
      const t = { destroy: jest.fn() };
      textures.push(t);
      return t;
    };
    const leases = [
      pool.acquire(device, source, 'fit:fill:64:48', create),
      pool.acquire({}, source, 'fit:fill:64:48', create),
      pool.acquire(device, {}, 'fit:fill:64:48', create),
      pool.acquire(device, source, 'fit:cover:64:48', create),
      pool.acquire(device, source, 'fit:fill:128:96', create),
    ];
    expect(new Set(leases.map((x) => x.texture)).size).toBe(5);
    leases.forEach((x) => x.release());
    textures.forEach((x) => expect(x.destroy).toHaveBeenCalledTimes(1));
  });
  it('does not poison a source after upload failure', () => {
    const pool = make(),
      device = {},
      source = {},
      texture = { destroy: jest.fn() };
    expect(() =>
      pool.acquire(device, source, 'a', () => {
        throw new Error('upload failed');
      }),
    ).toThrow('upload failed');
    const a = pool.acquire(device, source, 'a', () => texture);
    expect(a.texture).toBe(texture);
    a.release();
    expect(texture.destroy).toHaveBeenCalledTimes(1);
  });
  it('keeps a peer alive across repeated acquire/release and source replacement', () => {
    const pool = make(),
      device = {},
      source = {},
      texture = { destroy: jest.fn() },
      other = { destroy: jest.fn() };
    const original = pool.acquire(device, source, 'x', () => texture);
    for (let i = 0; i < 50; i++)
      pool
        .acquire(device, source, 'x', () => {
          throw new Error('duplicate upload');
        })
        .release();
    const replacement = pool.acquire(device, {}, 'x', () => other);
    original.release();
    expect(texture.destroy).toHaveBeenCalledTimes(1);
    expect(other.destroy).not.toHaveBeenCalled();
    replacement.release();
  });
}
