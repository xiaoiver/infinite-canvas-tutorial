import { field } from '@lastolivegames/becsy';

/**
 * The active gizmo manipulation mode.
 */
export type GizmoMode = 'translate' | 'rotate' | 'scale';

/**
 * Which axis or plane is currently being interacted with.
 */
export type GizmoAxis = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'none';

/**
 * Component attached to a 3D entity when it is selected in 3D space.
 * Controls gizmo rendering and interaction state.
 */
export class Selected3D {
  /**
   * Current gizmo mode (translate / rotate / scale).
   */
  @field.object declare mode: GizmoMode;

  /**
   * The axis or plane currently hovered or being dragged.
   */
  @field.object declare activeAxis: GizmoAxis;

  /**
   * Whether the user is currently dragging a gizmo handle.
   */
  @field.boolean declare dragging: boolean;

  /**
   * Drag start point in world space (set on pointer down).
   */
  @field.object declare dragStart: [number, number, number] | null;

  /**
   * Initial transform values when drag started (for delta computation).
   */
  @field.object declare initialTranslation: [number, number, number] | null;
  @field.object declare initialRotation: [number, number, number] | null;
  @field.object declare initialScale: [number, number, number] | null;

  constructor(opts?: Partial<Selected3D>) {
    if (opts) {
      Object.assign(this, opts);
    }
    this.mode ??= 'translate';
    this.activeAxis ??= 'none';
    this.dragging ??= false;
    this.dragStart ??= null;
    this.initialTranslation ??= null;
    this.initialRotation ??= null;
    this.initialScale ??= null;
  }
}
