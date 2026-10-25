import type { Entity } from '@lastolivegames/becsy';
import { Material3D } from '../../packages/ecs/src/components/geometry3d/Material3D';
import { syncMaterial3D } from '../../packages/ecs/src/utils/sync3d';

function fixture() {
  const material = new Material3D();
  const write = jest.fn(() => material);
  const entity = {
    read: jest.fn(() => material),
    write,
  } as unknown as Entity;
  return { entity, material, write };
}

it('writes a texture transform only when offset, scale, or rotation changes', () => {
  const { entity, material, write } = fixture();
  syncMaterial3D(entity, {
    mapTextureTransform: {
      offset: [0.25, 0.5],
      scale: [2, 1],
      rotation: 0.3,
    },
  });
  expect(write).toHaveBeenCalledTimes(1);
  expect(material.mapTextureTransform?.offset).toEqual([0.25, 0.5]);

  syncMaterial3D(entity, {
    mapTextureTransform: {
      offset: [0.25, 0.5],
      scale: [2, 1],
      rotation: 0.3,
    },
  });
  expect(write).toHaveBeenCalledTimes(1);

  for (const transform of [
    {
      offset: [0.5, 0.5] as [number, number],
      scale: [2, 1] as [number, number],
      rotation: 0.3,
    },
    {
      offset: [0.5, 0.5] as [number, number],
      scale: [0.5, 1] as [number, number],
      rotation: 0.3,
    },
    {
      offset: [0.5, 0.5] as [number, number],
      scale: [0.5, 1] as [number, number],
      rotation: 0.6,
    },
  ]) {
    syncMaterial3D(entity, { mapTextureTransform: transform });
  }
  expect(write).toHaveBeenCalledTimes(4);
  syncMaterial3D(entity, { mapTextureTransform: null });
  expect(material.mapTextureTransform).toBeNull();
  expect(write).toHaveBeenCalledTimes(5);
  syncMaterial3D(entity, { mapTextureTransform: null });
  expect(write).toHaveBeenCalledTimes(5);
});

it('treats omitted transform parameters as glTF identity defaults', () => {
  const { entity, material, write } = fixture();
  syncMaterial3D(entity, { metallicRoughnessTextureTransform: {} });
  expect(write).toHaveBeenCalledTimes(1);
  syncMaterial3D(entity, {
    metallicRoughnessTextureTransform: {
      offset: [0, 0],
      scale: [1, 1],
      rotation: 0,
    },
  });
  expect(write).toHaveBeenCalledTimes(1);
  syncMaterial3D(entity, {
    metallicRoughnessTextureTransform: { scale: [0.5, 1] },
  });
  expect(material.metallicRoughnessTextureTransform?.scale).toEqual([0.5, 1]);
  expect(write).toHaveBeenCalledTimes(2);
  syncMaterial3D(entity, {
    metallicRoughnessTextureTransform: {
      scale: [0.5, 1],
      rotation: 0.5,
    },
  });
  syncMaterial3D(entity, {
    metallicRoughnessTextureTransform: { scale: [0.5, 1] },
  });
  syncMaterial3D(entity, { metallicRoughnessTextureTransform: {} });
  expect(write).toHaveBeenCalledTimes(5);
  syncMaterial3D(entity, { metallicRoughnessTextureTransform: null });
  expect(write).toHaveBeenCalledTimes(6);
});

it('compares emissive color by value while preserving an explicit black override', () => {
  const { entity, material, write } = fixture();
  syncMaterial3D(entity, { emissiveFactor: [0, 0, 0] });
  expect(write).not.toHaveBeenCalled();
  syncMaterial3D(entity, { emissiveFactor: [0.2, 0.4, 0.6] });
  expect(material.emissiveFactor).toEqual([0.2, 0.4, 0.6]);
  expect(write).toHaveBeenCalledTimes(1);
  syncMaterial3D(entity, { emissiveFactor: [0.2, 0.4, 0.6] });
  expect(write).toHaveBeenCalledTimes(1);
  syncMaterial3D(entity, { emissiveFactor: [0, 0, 0] });
  expect(write).toHaveBeenCalledTimes(2);
});

it('compares rim light color by value across companion updates', () => {
  const { entity, material, write } = fixture();
  syncMaterial3D(entity, { rimLightColor: [0.55, 0.8, 1, 1] });
  expect(write).not.toHaveBeenCalled();
  syncMaterial3D(entity, { rimLightColor: [1, 0.5, 0.25, 1] });
  expect(material.rimLightColor).toEqual([1, 0.5, 0.25, 1]);
  expect(write).toHaveBeenCalledTimes(1);
  syncMaterial3D(entity, { rimLightColor: [1, 0.5, 0.25, 1] });
  expect(write).toHaveBeenCalledTimes(1);
});
