export function glyphFontStateContract(
  state: (fonts?: any) => string | undefined,
) {
  it('invalidates a snapshot for load status, descriptors, replacement and already-loaded additions', () => {
    const face = {
      family: 'Demo',
      style: 'normal',
      weight: '400',
      status: 'unloaded',
    };
    let faces = [face];
    const set = {
      forEach: (callback: (face: any) => void) => faces.forEach(callback),
    };
    const before = state(set);
    expect(state(set)).toBe(before);
    face.status = 'loaded';
    const loaded = state(set);
    expect(loaded).not.toBe(before);
    face.weight = '700';
    const bold = state(set);
    expect(bold).not.toBe(loaded);
    faces = [{ ...face }];
    const replacement = state(set);
    expect(replacement).not.toBe(bold);
    faces.push({ ...face });
    expect(state(set)).not.toBe(replacement);
    faces = [];
    expect(state(set)).toBe('[]');
  });
}
