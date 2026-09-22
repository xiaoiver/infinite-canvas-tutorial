import { field } from '@lastolivegames/becsy';

/**
 * The active gizmo manipulation mode.
 */
/** `transform` = combined translate + rotate gizmo (default). */
export type GizmoMode = 'transform' | 'translate' | 'rotate' | 'scale';

export type GizmoPartKind = 'translate' | 'rotate';

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
   * Whether the active handle is a translate or rotate part (combined gizmo).
   */
  @field.object declare activePartKind: GizmoPartKind | null;

  /**
   * Whether the user is currently dragging a gizmo handle.
   */
  @field.boolean declare dragging: boolean;

  /**
   * Ray–constraint-plane hit at pointer down (translate drag reference).
   */
  @field.object declare dragHitStart: [number, number, number] | null;

  /**
   * Angle on the rotation plane at pointer down (rotate drag reference).
   */
  @field.float32 declare dragAngleStart: number | null;

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
    this.mode ??= 'transform';
    this.activeAxis ??= 'none';
    this.activePartKind ??= null;
    this.dragging ??= false;
    this.dragHitStart ??= null;
    this.dragAngleStart ??= null;
    this.initialTranslation ??= null;
    this.initialRotation ??= null;
    this.initialScale ??= null;
  }
}
