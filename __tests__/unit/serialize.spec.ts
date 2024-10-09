import { serializeNode, Circle } from '../../packages/core/src';

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
        strokeDasharray: [],
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
        strokeDasharray: [],
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
});
