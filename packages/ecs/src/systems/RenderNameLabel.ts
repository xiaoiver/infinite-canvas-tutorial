import { Entity, System } from '@lastolivegames/becsy';
import {
  Brush,
  Camera,
  Camera3D,
  Canvas,
  Canvas3DScope,
  Children,
  ComputedBounds,
  ComputedCamera,
  Culled,
  Group,
  Highlighted,
  Line,
  Mesh3DNode,
  Name,
  Parent,
  Path,
  Polyline,
  Selected,
  Selected3D,
  Extrude3D,
  Transform3D,
  UI,
  Visibility,
} from '../components';
import { getSceneRoot } from './Transform';
import { hideLabel, initLabel, showNameLabel } from './DrawRect';
import { DOMAdapter } from '../environment';
import { isBrowser } from '../utils';
import { TRANSFORMER_ANCHOR_STROKE_COLOR } from '..';
import { findCamera3DForCanvas } from '../utils/canvas3d-scope';
import { isNavigableCamera3D } from '../utils/isometric-navigation';
import { buildPickSceneForViewport } from '../utils/pick3d-probe';
import { projectGizmoPoint } from '../utils/gizmo-frame';
import { isEntityAlive } from './Transform';
import type { API } from '../API';

function showProjectedNameLabel(
  label: HTMLDivElement,
  api: API,
  x: number,
  y: number,
  name: string,
) {
  if (!api.getAppState().penbarNameLabelVisible) {
    hideLabel(label);
    return;
  }
  label.style.visibility = 'visible';
  label.style.pointerEvents = 'none';
  label.innerText = name;
  label.style.left = `${x}px`;
  label.style.top = `${y - 105}px`;
  label.style.transform = 'translate(4px, 4px)';
}

function obbForNameAnchor(entity: Entity) {
  const { selectionOBB, transformOBB } = entity.read(ComputedBounds);
  return entity.has(Polyline) ||
    entity.has(Path) ||
    entity.has(Line) ||
    entity.has(Brush)
    ? transformOBB
    : selectionOBB;
}

/**
 * Show selected/hovered names in screen space. A selected companion mesh in a
 * free orthographic view uses its 3D projection instead of the 2D source OBB.
 */
export class RenderNameLabel extends System {
  #labels = new Map<number, HTMLDivElement>();

  private readonly named = this.query(
    (q) => q.current.with(Name, ComputedBounds).read,
  );

  private readonly removed = this.query((q) => q.removed.with(Name));
  private readonly canvases = this.query((q) => q.current.with(Canvas).read);
  private readonly cameras3D = this.query((q) => q.current.with(Camera3D).read);

  constructor() {
    super();
    this.query(
      (q) =>
        q.using(
          ComputedCamera,
          ComputedBounds,
          Name,
          Camera,
          Camera3D,
          Canvas,
          Canvas3DScope,
          Mesh3DNode,
          Extrude3D,
          Transform3D,
          UI,
          Visibility,
          Culled,
          Children,
          Parent,
          Polyline,
          Path,
          Line,
          Brush,
          Group,
          Selected,
          Selected3D,
          Highlighted,
        ).read,
    );
  }

  execute() {
    if (!isBrowser) {
      return;
    }

    this.removed.removed.forEach((entity) => {
      const el = this.#labels.get(entity.__id);
      if (el) {
        el.remove();
        this.#labels.delete(entity.__id);
      }
    });

    this.named.current.forEach((entity) => {
      if (entity.has(UI)) {
        return;
      }
      const { value: name } = entity.read(Name);
      if (!name?.trim()) {
        const el = this.#labels.get(entity.__id);
        if (el) {
          hideLabel(el);
        }
        return;
      }
      if (
        entity.has(Visibility) &&
        entity.read(Visibility).value === 'hidden'
      ) {
        const el = this.#labels.get(entity.__id);
        if (el) {
          hideLabel(el);
        }
        return;
      }
      const mesh = this.companionMesh(entity);
      const selectedMesh = !!mesh && mesh.has(Selected3D);
      if (!entity.has(Selected) && !entity.has(Highlighted) && !selectedMesh) {
        const el = this.#labels.get(entity.__id);
        if (el) {
          hideLabel(el);
        }
        return;
      }
      const camera = getSceneRoot(entity);
      const { canvas: canvasEnt } = camera.read(Camera);
      if (!canvasEnt) return;
      const projected3D = mesh
        ? this.projectCompanionAnchor(mesh, canvasEnt)
        : undefined;
      // A selected 3D mesh without an axonometric projection has no 2D name anchor.
      if (
        selectedMesh &&
        projected3D === undefined &&
        !entity.has(Selected) &&
        !entity.has(Highlighted)
      ) {
        const el = this.#labels.get(entity.__id);
        if (el) hideLabel(el);
        return;
      }
      if (projected3D === null) {
        const el = this.#labels.get(entity.__id);
        if (el) hideLabel(el);
        return;
      }
      if (!projected3D && entity.has(Culled)) {
        const el = this.#labels.get(entity.__id);
        if (el) {
          hideLabel(el);
        }
        return;
      }
      const { api } = canvasEnt.read(Canvas);
      const $svg = api.getSvgLayer();
      if (!$svg) {
        return;
      }

      const { x, y } = obbForNameAnchor(entity);

      let el = this.#labels.get(entity.__id);
      if (!el) {
        el = DOMAdapter.get()
          .getDocument()
          .createElement('div') as HTMLDivElement;
        initLabel(el, {
          display: 'block',
          maxWidth: '100px',
          boxSizing: 'border-box',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          backgroundColor: 'transparent',
          color: TRANSFORMER_ANCHOR_STROKE_COLOR,
          padding: '0',
        });
        el.style.zIndex = '1';
        $svg.appendChild(el);
        this.#labels.set(entity.__id, el);
      }

      if (projected3D) {
        showProjectedNameLabel(el, api, projected3D[0], projected3D[1], name);
      } else {
        showNameLabel(el, api, { x, y, text: name, viewportYOffset: -24 });
      }
    });
  }

  private companionMesh(source: Entity): Entity | undefined {
    const mesh = source.has(Mesh3DNode)
      ? source.read(Mesh3DNode).meshEntity
      : source.has(Extrude3D)
      ? source.read(Extrude3D).meshEntity
      : undefined;
    return isEntityAlive(mesh) && mesh.has(Transform3D) ? mesh : undefined;
  }

  private projectCompanionAnchor(
    mesh: Entity,
    canvas: Entity,
  ): [number, number] | null | undefined {
    const cameraEntity = findCamera3DForCanvas(
      this.cameras3D.current,
      canvas,
      this.canvases.current.length || 1,
    );
    if (!cameraEntity) return;
    const camera = cameraEntity.read(Camera3D);
    if (!isNavigableCamera3D(camera)) return;
    const { width, height } = canvas.read(Canvas);
    if (width <= 0 || height <= 0) return null;
    const scene = buildPickSceneForViewport(
      camera,
      width,
      height,
      width,
      height,
    );
    if (!scene) return null;
    const anchor = mesh.read(Transform3D).translation;
    const projected = projectGizmoPoint(
      { scene, anchor, width, height, scale: 1 },
      anchor,
    );
    if (
      !projected ||
      projected[0] < 0 ||
      projected[0] > width ||
      projected[1] < 0 ||
      projected[1] > height
    )
      return null;
    return projected;
  }

  finalize(): void {
    for (const label of this.#labels.values()) label.remove();
    this.#labels.clear();
  }
}
