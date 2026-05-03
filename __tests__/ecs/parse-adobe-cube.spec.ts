import { parseAdobeCube } from '../../packages/ecs/src/utils/parse-adobe-cube';

describe('parseAdobeCube', () => {
  it('parses minimal 2³ cube in file / volume order', () => {
    const body = `LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;
    const p = parseAdobeCube(body);
    expect(p.title).toBeNull();
    expect(p.size).toBe(2);
    const rgb = (idx: number) =>
      [
        p.volumeRgba[idx * 4]!,
        p.volumeRgba[idx * 4 + 1]!,
        p.volumeRgba[idx * 4 + 2]!,
      ] as const;
    expect(rgb(0)).toEqual([0, 0, 0]);
    expect(rgb(1)).toEqual([255, 0, 0]);
    expect(rgb(4)).toEqual([0, 0, 255]);
    expect(rgb(7)).toEqual([255, 255, 255]);
  });

  it('reads DOMAIN_MIN / DOMAIN_MAX', () => {
    const body = `LUT_3D_SIZE 2
DOMAIN_MIN 0.1 0.2 0.3
DOMAIN_MAX 0.9 0.8 0.7
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;
    const p = parseAdobeCube(body);
    expect(p.domainMin).toEqual([0.1, 0.2, 0.3]);
    expect(p.domainMax).toEqual([0.9, 0.8, 0.7]);
  });

  it('extracts TITLE like three.js LUTCubeLoader', () => {
    const body = `TITLE "My Grade"
LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;
    expect(parseAdobeCube(body).title).toBe('My Grade');
  });

  it('accepts scientific notation on data rows (three.js data regex)', () => {
    const body = `LUT_3D_SIZE 2
0 0 0
1e0 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;
    const p = parseAdobeCube(body);
    expect(p.size).toBe(2);
    expect([p.volumeRgba[4]!, p.volumeRgba[5]!, p.volumeRgba[6]!]).toEqual([
      255, 0, 0,
    ]);
  });

  it('throws on invalid domain like three.js', () => {
    const body = `LUT_3D_SIZE 2
DOMAIN_MIN 0.9 0 0
DOMAIN_MAX 0.1 1 1
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`;
    expect(() => parseAdobeCube(body)).toThrow(/Invalid input domain/);
  });
});
