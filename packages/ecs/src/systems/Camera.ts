import { Entity, system, System } from '@lastolivegames/becsy';
import { Children, GlobalTransform, Parent, Transform } from '../components';
import { Mat3 } from '../components/math/Mat3';

/**
 * Update {@link Camera} component.
 */
export class SyncCamera extends System {}
