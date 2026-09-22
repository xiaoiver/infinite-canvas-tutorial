import {
  buildIconFontScalablePrimitives,
  registerIconifyIconSet,
  unregisterIconifyIconSet,
} from '../../packages/ecs/src/utils/icon-font';

describe('Iconify 单 icon 的 width/height 覆盖集合 viewBox', () => {
  afterEach(() => {
    unregisterIconifyIconSet('vb-override');
    unregisterIconifyIconSet('vb-override-2');
  });

  it('per-icon width+height 优先于 JSON 根上的视口，用于等比映射', () => {
    registerIconifyIconSet('vb-override', {
      width: 32,
      height: 32,
      icons: {
        per16: {
          body: '<path d="M0 0H16V16H0Z" fill="red"/>',
          width: 16,
          height: 16,
        },
        set32: { body: '<path d="M0 0H16V16H0Z" fill="red"/>' },
      },
    });
    const per16 = buildIconFontScalablePrimitives('per16', 'vb-override', 32, 32);
    const set32 = buildIconFontScalablePrimitives('set32', 'vb-override', 32, 32);
    expect(per16).not.toBeNull();
    expect(set32).not.toBeNull();
    // 16×16 视口时 s=2，矩形铺满目标 32
    expect(per16![0]!.d).toContain('32');
    // 无 per-icon 时用根上 32×32，s=1，边长仍为 16
    expect(set32![0]!.d).toContain('16');
    expect(set32![0]!.d).not.toMatch(/\b32\b/);
  });

  it('根无视口时，per-icon 仍启用 (0,0)–(w,h) 视口，而非按内容 AABB（与 8px 方格在 16 视口内等比到 32 一致）', () => {
    registerIconifyIconSet('vb-override-2', {
      icons: {
        'aabb-compare': {
          body: '<path d="M0 0H8V8H0Z" fill="red"/>',
          width: 16,
          height: 16,
        },
      },
    });
    const pr = buildIconFontScalablePrimitives(
      'aabb-compare',
      'vb-override-2',
      32,
      32,
    );
    expect(pr).not.toBeNull();
    // 视口 16×16 → s=2，8→16；若误走 AABB（0–8）会 s=4 得到 32
    expect(pr![0]!.d).toBe('M0 0H16V16H0Z');
  });
});
