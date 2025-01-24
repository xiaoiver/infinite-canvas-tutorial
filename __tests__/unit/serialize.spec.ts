import {
  serializeNode,
  Circle,
  Polyline,
  Path,
  parseTransform,
  Text,
  fromSVGElement,
} from '../../packages/core/src';
import { JSDOM } from 'jsdom';

describe('Serialize', () => {
  it('should serialize circle correctly.', () => {
    const circle = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: '#F67676',
    });
    const serialized = serializeNode(circle);
    expect(serialized).toEqual({
      type: 'circle',
      children: [],
      uid: 0,
      attributes: {
        batchable: true,
        cullable: true,
        cx: 50,
        cy: 50,
        fill: '#F67676',
        fillOpacity: 1,
        innerShadowBlurRadius: 0,
        innerShadowColor: 'black',
        innerShadowOffsetX: 0,
        innerShadowOffsetY: 0,
        opacity: 1,
        r: 50,
        renderable: true,
        stroke: 'none',
        strokeAlignment: 'center',
        strokeDasharray: '',
        strokeDashoffset: 0,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeMiterlimit: 4,
        strokeOpacity: 1,
        strokeWidth: 1,
        transform: {
          matrix: {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            tx: 0,
            ty: 0,
          },
          pivot: {
            x: 0,
            y: 0,
          },
          position: {
            x: 0,
            y: 0,
          },
          rotation: 0,
          scale: {
            x: 1,
            y: 1,
          },
          skew: {
            x: 0,
            y: 0,
          },
        },
        visible: true,
      },
    });
  });

  it('should serialize strokeAlignment correctly.', () => {
    const circle = new Circle({
      cx: 50,
      cy: 50,
      r: 50,
      fill: '#F67676',
      stroke: 'black',
      strokeWidth: 20,
      strokeOpacity: 0.5,
      strokeAlignment: 'inner',
    });
    let serialized = serializeNode(circle);
    expect(serialized).toEqual({
      type: 'circle',
      children: [],
      uid: 1,
      attributes: {
        batchable: true,
        cullable: true,
        cx: 50,
        cy: 50,
        fill: '#F67676',
        fillOpacity: 1,
        innerShadowBlurRadius: 0,
        innerShadowColor: 'black',
        innerShadowOffsetX: 0,
        innerShadowOffsetY: 0,
        opacity: 1,
        r: 50,
        renderable: true,
        stroke: 'black',
        strokeAlignment: 'inner',
        strokeDasharray: '',
        strokeDashoffset: 0,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeMiterlimit: 4,
        strokeOpacity: 0.5,
        strokeWidth: 20,
        transform: {
          matrix: {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            tx: 0,
            ty: 0,
          },
          pivot: {
            x: 0,
            y: 0,
          },
          position: {
            x: 0,
            y: 0,
          },
          rotation: 0,
          scale: {
            x: 1,
            y: 1,
          },
          skew: {
            x: 0,
            y: 0,
          },
        },
        visible: true,
      },
    });
  });

  it('should serialize points correctly.', () => {
    const polyline = new Polyline({
      points: [
        [50, 50],
        [50, 150],
        [150, 50],
      ],
      stroke: 'black',
      strokeWidth: 20,
      fill: 'none',
    });
    let serialized = serializeNode(polyline);
    expect(serialized).toEqual({
      type: 'polyline',
      children: [],
      uid: 2,
      attributes: {
        batchable: false,
        cullable: true,
        fill: 'none',
        fillOpacity: 1,
        innerShadowBlurRadius: 0,
        innerShadowColor: 'black',
        innerShadowOffsetX: 0,
        innerShadowOffsetY: 0,
        opacity: 1,
        points: '50,50 50,150 150,50',
        renderable: true,
        stroke: 'black',
        strokeAlignment: 'center',
        strokeDasharray: '',
        strokeDashoffset: 0,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeMiterlimit: 4,
        strokeOpacity: 1,
        strokeWidth: 20,
        transform: {
          matrix: {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            tx: 0,
            ty: 0,
          },
          pivot: {
            x: 0,
            y: 0,
          },
          position: {
            x: 0,
            y: 0,
          },
          rotation: 0,
          scale: {
            x: 1,
            y: 1,
          },
          skew: {
            x: 0,
            y: 0,
          },
        },
        visible: true,
      },
    });
  });

  it('should serialize d correctly.', () => {
    const path = new Path({
      d: 'M 50 50 L 50 150 L 150 50 Z',
      stroke: 'black',
      strokeWidth: 20,
      fill: 'none',
    });
    let serialized = serializeNode(path);
    expect(serialized).toEqual({
      type: 'path',
      children: [],
      uid: 3,
      attributes: {
        batchable: false,
        cullable: true,
        fill: 'none',
        fillOpacity: 1,
        fillRule: 'nonzero',
        innerShadowBlurRadius: 0,
        innerShadowColor: 'black',
        innerShadowOffsetX: 0,
        innerShadowOffsetY: 0,
        opacity: 1,
        d: 'M 50 50 L 50 150 L 150 50 Z',
        renderable: true,
        stroke: 'black',
        strokeAlignment: 'center',
        strokeDasharray: '',
        strokeDashoffset: 0,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeMiterlimit: 4,
        strokeOpacity: 1,
        strokeWidth: 20,
        transform: {
          matrix: {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            tx: 0,
            ty: 0,
          },
          pivot: {
            x: 0,
            y: 0,
          },
          position: {
            x: 0,
            y: 0,
          },
          rotation: 0,
          scale: {
            x: 1,
            y: 1,
          },
          skew: {
            x: 0,
            y: 0,
          },
        },
        visible: true,
      },
    });
  });

  it('should serialize content correctly.', () => {
    const text = new Text({
      content: 'Hello, World!',
      fontFamily: 'sans-serif',
      fontSize: 30,
      fill: '#F67676',
    });
    let serialized = serializeNode(text);
    expect(serialized).toEqual({
      type: 'text',
      children: [],
      uid: 4,
      attributes: {
        batchable: false,
        cullable: true,
        fill: '#F67676',
        fillOpacity: 1,
        innerShadowBlurRadius: 0,
        innerShadowColor: 'black',
        innerShadowOffsetX: 0,
        innerShadowOffsetY: 0,
        letterSpacing: 0,
        lineHeight: 0,
        opacity: 1,
        content: 'Hello, World!',
        fontSize: 30,
        fontFamily: 'sans-serif',
        fontStyle: 'normal',
        fontVariant: 'normal',
        fontWeight: 400,
        renderable: true,
        stroke: 'none',
        strokeAlignment: 'center',
        strokeDasharray: '',
        strokeDashoffset: 0,
        strokeLinecap: 'butt',
        strokeLinejoin: 'miter',
        strokeMiterlimit: 4,
        strokeOpacity: 1,
        strokeWidth: 1,
        transform: {
          matrix: {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            tx: 0,
            ty: 0,
          },
          pivot: {
            x: 0,
            y: 0,
          },
          position: {
            x: 0,
            y: 0,
          },
          rotation: 0,
          scale: {
            x: 1,
            y: 1,
          },
          skew: {
            x: 0,
            y: 0,
          },
        },
        visible: true,
        whiteSpace: 'normal',
        wordWrap: false,
        wordWrapWidth: 0,
        x: 0,
        y: 0,
      },
    });
  });

  it('should parse transform correctly.', () => {
    const parsed = parseTransform('translate(10, 20)');
    expect(parsed.position).toEqual({ x: 10, y: 20 });

    const parsed2 = parseTransform('translate(10, 20) scale(2, 2)');
    expect(parsed2.position).toEqual({ x: 10, y: 20 });
    expect(parsed2.scale).toEqual({ x: 2, y: 2 });

    const parsed3 = parseTransform('translate(10, 20) rotate(90)');
    expect(parsed3.position).toEqual({ x: 10, y: 20 });
    expect(parsed3.rotation).toEqual(90);

    const parsed4 = parseTransform('translate(10, 20) skew(10, 20)');
    expect(parsed4.position).toEqual({ x: 10, y: 20 });
    expect(parsed4.skew).toEqual({ x: 10, y: 20 });

    const parsed5 = parseTransform('translate(10, 20) scale(2, 2) rotate(90)');
    expect(parsed5.position).toEqual({ x: 10, y: 20 });
    expect(parsed5.scale).toEqual({ x: 2, y: 2 });
    expect(parsed5.rotation).toEqual(90);

    const parsed6 = parseTransform('scale(0.75)');
    expect(parsed6.scale).toEqual({ x: 0.75, y: 0.75 });

    const parsed7 = parseTransform('scaleX(0.75)');
    expect(parsed7.scale).toEqual({ x: 0.75, y: 1 });

    const parsed8 = parseTransform('scaleY(0.75)');
    expect(parsed8.scale).toEqual({ x: 1, y: 0.75 });

    const parsed9 = parseTransform('skew(10, 20)');
    expect(parsed9.skew).toEqual({ x: 10, y: 20 });

    const parsed10 = parseTransform('skewX(10)');
    expect(parsed10.skew).toEqual({ x: 10, y: 0 });

    const parsed11 = parseTransform('skewY(20)');
    expect(parsed11.skew).toEqual({ x: 0, y: 20 });

    const parsed12 = parseTransform('matrix(1, 2, 3, 4, 5, 6)');
    expect(parsed12.matrix).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      tx: 5,
      ty: 6,
    });

    // translateX
    const parsed13 = parseTransform('translateX(10)');
    expect(parsed13.position).toEqual({ x: 10, y: 0 });

    // translateY
    const parsed14 = parseTransform('translateY(20)');
    expect(parsed14.position).toEqual({ x: 0, y: 20 });
  });

  it('should parse SVGSVGElement correctly.', () => {
    const dom = new JSDOM(
      `<svg width="100" height="100"><circle cx="50" cy="50" r="50" fill="red" /></svg>`,
    );

    const serialized = fromSVGElement(
      (dom.window.document.firstChild as Element)?.querySelector(
        'svg',
      ) as SVGElement,
    );
    expect(serialized).toEqual({
      type: 'g',
      attributes: {
        height: 100,
        width: 100,
      },
      children: [
        {
          type: 'circle',
          children: [],
          uid: 0,
          attributes: {
            cx: 50,
            cy: 50,
            r: 50,
            fill: 'red',
          },
        },
      ],
      uid: 1,
    });
  });

  it('should parse SVGDefsElement & SVGUseElement correctly.', () => {
    const dom = new JSDOM(`
<svg width="100" height="100">
  <defs>
    <circle id="circle" cx="50" cy="50" r="50" fill="red" />
  </defs>
  <use xlink:href="#circle" />
</svg>`);

    const serialized = fromSVGElement(
      (dom.window.document.firstChild as Element)?.querySelector(
        'svg',
      ) as SVGElement,
    );
    expect(serialized).toEqual({
      type: 'g',
      attributes: {
        height: 100,
        width: 100,
      },
      children: [
        {
          type: 'circle',
          children: [],
          uid: 1,
          attributes: {
            cx: 50,
            cy: 50,
            r: 50,
            fill: 'red',
            id: 'circle',
          },
        },
      ],
      uid: 2,
    });
  });
});
