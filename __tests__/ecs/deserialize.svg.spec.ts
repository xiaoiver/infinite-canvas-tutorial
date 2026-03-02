import {
  kebabToCamelCase,
  svgSvgElementToComputedCamera,
} from '../../packages/ecs/src/utils/deserialize/svg';

describe('kebabToCamelCase', () => {
  it('should convert stroke-width to strokeWidth', () => {
    expect(kebabToCamelCase('stroke-width')).toBe('strokeWidth');
  });

  it('should convert fill-opacity to fillOpacity', () => {
    expect(kebabToCamelCase('fill-opacity')).toBe('fillOpacity');
  });

  it('should convert text-anchor to textAnchor', () => {
    expect(kebabToCamelCase('text-anchor')).toBe('textAnchor');
  });

  it('should handle single word without dash', () => {
    expect(kebabToCamelCase('fill')).toBe('fill');
  });

  it('should handle multiple dashes', () => {
    expect(kebabToCamelCase('stroke-dash-array')).toBe('strokeDashArray');
  });

  it('should handle empty string', () => {
    expect(kebabToCamelCase('')).toBe('');
  });

  it('should handle leading dash', () => {
    expect(kebabToCamelCase('-webkit-transform')).toBe('WebkitTransform');
  });
});

describe('svgSvgElementToComputedCamera', () => {
  it('should calculate camera from viewBox and dimensions', () => {
    const mockSvgElement = {
      viewBox: {
        baseVal: { x: 0, y: 0, width: 100, height: 100 },
      },
      width: { baseVal: { unitType: 1, value: 200 } },
      height: { baseVal: { unitType: 1, value: 200 } },
    } as unknown as SVGSVGElement;

    const result = svgSvgElementToComputedCamera(mockSvgElement);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.zoom).toBe(2);
  });

  it('should handle different aspect ratios', () => {
    const mockSvgElement = {
      viewBox: {
        baseVal: { x: 0, y: 0, width: 100, height: 50 },
      },
      width: { baseVal: { unitType: 1, value: 200 } },
      height: { baseVal: { unitType: 1, value: 100 } },
      // aspect ratio preserved by min dimension
    } as unknown as SVGSVGElement;

    const result = svgSvgElementToComputedCamera(mockSvgElement);
    expect(result.zoom).toBe(2);
  });

  it('should return zoom 1 for zero viewBox dimensions', () => {
    const mockSvgElement = {
      viewBox: {
        baseVal: { x: 0, y: 0, width: 0, height: 100 },
      },
      width: { baseVal: { unitType: 1, value: 200 } },
      height: { baseVal: { unitType: 1, value: 200 } },
    } as unknown as SVGSVGElement;

    const result = svgSvgElementToComputedCamera(mockSvgElement);
    expect(result.zoom).toBe(1);
  });

  it('should handle percentage unit type', () => {
    const mockSvgElement = {
      viewBox: {
        baseVal: { x: 0, y: 0, width: 100, height: 100 },
      },
      width: { baseVal: { unitType: 2, value: 100 } },
      height: { baseVal: { unitType: 1, value: 200 } },
    } as unknown as SVGSVGElement;

    const result = svgSvgElementToComputedCamera(mockSvgElement);
    expect(result.zoom).toBe(1);
  });

  it('should preserve viewBox x and y offset', () => {
    const mockSvgElement = {
      viewBox: {
        baseVal: { x: 50, y: 100, width: 200, height: 200 },
      },
      width: { baseVal: { unitType: 1, value: 200 } },
      height: { baseVal: { unitType: 1, value: 200 } },
    } as unknown as SVGSVGElement;

    const result = svgSvgElementToComputedCamera(mockSvgElement);
    expect(result.x).toBe(50);
    expect(result.y).toBe(100);
  });
});
