import { Entity } from 'koota';
import { Transform as PixiTransform } from '@pixi/math';
import { Transform } from '../components';
import { Commands } from '../Commands';
import { ChildOf } from '../Command';

export const IDENTITY_TRANSFORM = new PixiTransform();

const updateHierarchy = (
  commands: Commands,
  parent: Entity,
  transform = IDENTITY_TRANSFORM,
) => {
  parent.get(Transform)?.updateTransform(transform);
  console.log(`Entity ${parent} changed`);

  commands.world.query(ChildOf(parent)).updateEach((_, child) => {
    updateHierarchy(commands, child, parent.get(Transform));
  });
};

export const TransformSystem = ({ commands }: { commands: Commands }) => {
  commands.world.onAdd([Transform], (entity) => {
    entity.get(Transform)?.updateTransform(IDENTITY_TRANSFORM);
    console.log(`Entity ${entity} added`);
  });

  commands.world.onChange(Transform, (parent) => {
    updateHierarchy(commands, parent);
  });

  commands.world.onRemove([Transform], (entity) => {
    console.log(`Entity ${entity} removed`);
  });
};
