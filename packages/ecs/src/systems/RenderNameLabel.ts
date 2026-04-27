import { Entity, System } from '@lastolivegames/becsy';
import {
  Brush,
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Culled,
  Group,
  Highlighted,
  Line,
  Name,
  Parent,
  Path,
  Polyline,
  Selected,
  UI,
  Visibility,
} from '../components';
import { getSceneRoot } from './Transform';
import { hideLabel, initLabel, showNameLabel } from './DrawRect';
import { DOMAdapter } from '../environment';
import { isBrowser } from '../utils';
import { TRANSFORMER_ANCHOR_STROKE_COLOR } from '..';

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
 * 在画布上展示 Name 文本，锚定在 `ComputedBounds` 对应 OBB 的 (x, y)；仅当节点 **选中**（`Selected`）或 **悬停高亮**（`Highlighted`）时显示，且需 `AppState.penbarNameLabelVisible`。
 */
export class RenderNameLabel extends System {
  #labels = new Map<number, HTMLDivElement>();

  private readonly named = this.query(
    (q) => q.current.with(Name, ComputedBounds).read,
  );

  private readonly removed = this.query((q) => q.removed.with(Name));

  constructor() {
    super();
    this.query(
      (q) =>
        q.using(
          ComputedCamera,
          ComputedBounds,
          Name,
          Camera,
          Canvas,
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
      if (entity.has(Culled)) {
        const el = this.#labels.get(entity.__id);
        if (el) {
          hideLabel(el);
        }
        return;
      }
      if (!entity.has(Selected) && !entity.has(Highlighted)) {
        const el = this.#labels.get(entity.__id);
        if (el) {
          hideLabel(el);
        }
        return;
      }

      const camera = getSceneRoot(entity);
      const { canvas: canvasEnt } = camera.read(Camera);
      if (!canvasEnt) {
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

      showNameLabel(el, api, { x, y, text: name, viewportYOffset: -24 });
    });
  }
}
