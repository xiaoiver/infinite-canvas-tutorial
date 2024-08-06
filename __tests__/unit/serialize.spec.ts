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
        stroke: 'black',
        strokeAlignment: 'center',
        strokeOpacity: 1,
        strokeWidth: 0,
        transform: {
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
        strokeOpacity: 0.5,
        strokeWidth: 20,
        transform: {
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

    // const dir = `${__dirname}/snapshots`;
    // expect(
    //   toSVGElement(serialized, new JSDOM().window._document),
    // ).toMatchSVGSnapshot(dir, 'circle-stroke-alignment-inner');

    // circle.strokeAlignment = 'outer';
    // serialized = serializeNode(circle);
    // expect(
    //   toSVGElement(serialized, new JSDOM().window._document),
    // ).toMatchSVGSnapshot(dir, 'circle-stroke-alignment-outer');
  });
});
