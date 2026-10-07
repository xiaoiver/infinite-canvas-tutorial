import { mat3, vec2 } from 'gl-matrix';
import {
  API,
  Commands,
  DefaultStateManagement,
  DOMAdapter,
  Text,
  TextSerializedNode,
  measureText,
} from '../../packages/ecs/src';
import { decompose } from '../../packages/ecs/src/utils/math';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('API text resize geometry', () => {
  it.each([
    { scale: [1.8, 1.3], origin: { x: 1, y: 1 }, wrapped: false },
    { scale: [-1.8, 1.3], origin: { x: 0.5, y: 1 }, wrapped: false },
    { scale: [1.8, -1.3], origin: { x: 1, y: 0.5 }, wrapped: true },
    { scale: [-1.8, -1.3], origin: { x: 0.5, y: 0.5 }, wrapped: true },
  ])(
    'normalizes the measured box and preserves $origin at $scale',
    ({ scale, origin, wrapped }) => {
      const api = new API(new DefaultStateManagement(), {} as Commands);
      // Isolate the geometry conversion; browser tests exercise the actual ECS,
      // transformer, rasterization and history together.
      const update = jest.spyOn(api, 'updateNode').mockImplementation(() => {});
      const node: TextSerializedNode = {
        id: 'text',
        type: 'text',
        zIndex: 0,
        content: 'one two three four five',
        fontFamily: 'sans-serif',
        fontSize: 24,
        textAlign: 'right',
        textBaseline: 'ideographic',
        wordWrap: wrapped,
        wordWrapWidth: 120,
        lineHeight: 32,
        letterSpacing: 1,
        x: 80,
        y: 50,
      };
      const oldBounds = Text.getGeometryBounds(node, measureText(node));
      node.width = oldBounds.maxX - oldBounds.minX;
      node.height = oldBounds.maxY - oldBounds.minY;
      node.anchorX = -oldBounds.minX;
      node.anchorY = -oldBounds.minY;
      const original = Object.freeze({ ...node });
      const transform = mat3.fromTranslation(mat3.create(), [80, 50]);
      mat3.rotate(transform, transform, 0.6);
      mat3.scale(transform, transform, scale as [number, number]);
      const decomposed = decompose(transform);
      const expectedFixed = vec2.transformMat3(
        vec2.create(),
        [node.width * origin.x, node.height * origin.y],
        transform,
      );
      api.updateNodeOBB(
        node,
        {
          x: 80,
          y: 50,
          width: node.width * Math.abs(scale[0]),
          height: node.height * Math.abs(scale[1]),
          rotation: decomposed.rotation,
          scaleX: Math.sign(decomposed.scale[0]),
          scaleY: Math.sign(decomposed.scale[1]),
        },
        false,
        transform,
        original,
        origin,
      );
      expect(update).toHaveBeenCalledTimes(1);
      const result = {
        ...node,
        ...update.mock.calls[0][1],
      } as TextSerializedNode;
      const bounds = Text.getGeometryBounds(result, measureText(result));
      expect(bounds.minX).toBeCloseTo(0, 4);
      expect(bounds.minY).toBeCloseTo(0, 4);
      expect(result.width).toBeCloseTo(bounds.maxX, 4);
      expect(result.height).toBeCloseTo(bounds.maxY, 4);
      const actualFixed = vec2.transformMat3(
        vec2.create(),
        [bounds.maxX * origin.x, bounds.maxY * origin.y],
        api.getTransform(result),
      );
      expect(actualFixed[0]).toBeCloseTo(expectedFixed[0], 3);
      expect(actualFixed[1]).toBeCloseTo(expectedFixed[1], 3);
      expect(node).toEqual(original);
      api.destroy();
    },
  );
});
