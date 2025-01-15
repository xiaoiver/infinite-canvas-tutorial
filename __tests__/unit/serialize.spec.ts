import {
  serializeNode,
  Circle,
  Polyline,
  Path,
  parseTransform,
  Text,
} from '../../packages/core/src';

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
  });
});
