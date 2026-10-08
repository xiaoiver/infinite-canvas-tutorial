import { API, Pen, type SerializedNode } from '@infinite-canvas-tutorial/ecs';

type Target = {
  id: string;
  type: SerializedNode['type'];
  entity: ReturnType<API['getEntity']>;
};

export type CropCommand =
  | { kind: 'scale'; value: unknown }
  | { kind: 'aspect'; value: unknown }
  | { kind: 'apply' }
  | { kind: 'cancel' };

function number(value: unknown, fallback?: number) {
  if (value == null) return fallback ?? NaN;
  return typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
    ? Number(value)
    : NaN;
}

function rectangle(node: SerializedNode) {
  if (node.type !== 'rect') return;
  const x = number(node.x, 0);
  const y = number(node.y, 0);
  const width = number(node.width);
  const height = number(node.height);
  const angle = number(node.rotation, 0);
  const sx = number(node.scaleX, 1);
  const sy = number(node.scaleY, 1);
  if (
    ![x, y, width, height, angle, sx, sy].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    sx === 0 ||
    sy === 0
  )
    return;
  return {
    x,
    y,
    width,
    height,
    a: Math.cos(angle) * sx,
    b: Math.sin(angle) * sx,
    c: -Math.sin(angle) * sy,
    d: Math.cos(angle) * sy,
  };
}

/** Own queued panel commands until crop exit, rebinding, history, or teardown. */
export class CropSession {
  readonly controller = new AbortController();
  private disposers: (() => void)[] = [];
  private clip?: Target;
  private children: Target[] = [];
  private baseline?: { width: number; height: number };

  constructor(readonly api: API) {
    this.disposers.push(api.onDestroy(() => this.dispose()));
    if (this.controller.signal.aborted) return;
    const ids = api.getAppState().layersCropping;
    const node = ids.length === 1 && api.getNodeById(ids[0]);
    if (!node || node.isDeleted || !node.clipMode || !api.getEntity(node)) {
      this.dispose();
      return;
    }
    const target = (n: SerializedNode): Target => ({
      id: n.id,
      type: n.type,
      entity: api.getEntity(n),
    });
    this.clip = target(node);
    this.children = this.liveChildren().map(target);
    const child =
      this.children.length === 1 && api.getNodeById(this.children[0].id);
    const geometry = child && rectangle(child);
    if (geometry)
      this.baseline = { width: geometry.width, height: geometry.height };
    this.disposers.push(api.onBeforeHistoryChange(() => this.dispose()));
  }

  dispose() {
    this.controller.abort();
    this.disposers.splice(0).forEach((dispose) => dispose());
  }

  private liveChildren() {
    return this.api
      .getNodes()
      .filter((n) => !n.isDeleted && n.parentId === this.clip?.id);
  }

  resolve() {
    if (this.controller.signal.aborted || !this.clip) return;
    const { layersCropping, penbarSelected } = this.api.getAppState();
    if (
      penbarSelected !== Pen.SELECT ||
      layersCropping.length !== 1 ||
      layersCropping[0] !== this.clip.id
    )
      return;
    // A multi-child crop must not scan the entire document once per child.
    const nodes = new Map(this.api.getNodes().map((node) => [node.id, node]));
    const resolve = (target: Target) => {
      const node = nodes.get(target.id);
      return node &&
        !node.isDeleted &&
        node.type === target.type &&
        !!target.entity &&
        this.api.getEntity(node) === target.entity
        ? node
        : undefined;
    };
    const clip = resolve(this.clip);
    const children = this.children.map(resolve);
    const live = this.liveChildren();
    if (
      !clip?.clipMode ||
      children.some((n) => !n) ||
      live.length !== children.length ||
      children.some((n) => n!.parentId !== clip.id)
    )
      return;
    return { clip, children: children as SerializedNode[] };
  }

  get geometry() {
    const nodes = this.resolve();
    if (!nodes || nodes.children.length !== 1 || !this.baseline)
      return undefined;
    const frame = rectangle(nodes.clip);
    const image = rectangle(nodes.children[0]);
    return frame && image ? { ...nodes, frame, image } : undefined;
  }

  get ratio() {
    const geometry = this.geometry;
    return geometry ? geometry.image.width / this.baseline!.width : 1;
  }

  async edit(command: CropCommand) {
    if (!this.resolve()) return false;
    const controller = new AbortController();
    let writing = false;
    const cancel = () => {
      if (!writing) controller.abort();
    };
    this.controller.signal.addEventListener('abort', cancel, { once: true });
    try {
      return await this.api.edit(
        (api) => {
          const apply = this.prepare(command);
          if (!apply) {
            controller.abort();
            return;
          }
          // Ending the session synchronously invalidates queued commands, but the
          // command already writing must still finish its one history commit.
          writing = true;
          apply(api);
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted)
        console.error('Failed to edit crop', error);
      return false;
    } finally {
      this.controller.signal.removeEventListener('abort', cancel);
    }
  }

  private prepare(command: CropCommand): ((api: API) => void) | undefined {
    if (!this.resolve()) return;
    if (command.kind === 'apply' || command.kind === 'cancel') {
      return (api) =>
        command.kind === 'apply' ? api.applyCrop() : api.cancelCrop();
    }
    const geometry = this.geometry;
    if (!geometry) return;
    const {
      clip,
      children: [child],
      frame,
      image,
    } = geometry;
    let clipPatch: Partial<SerializedNode> | undefined;
    let childPatch: Partial<SerializedNode>;
    if (command.kind === 'scale') {
      const ratio = number(command.value);
      if (!Number.isFinite(ratio) || ratio < 1 || ratio > 4) return;
      const width = this.baseline!.width * ratio;
      const height = this.baseline!.height * ratio;
      const dx = (image.width - width) / 2;
      const dy = (image.height - height) / 2;
      childPatch = {
        x: image.x + image.a * dx + image.c * dy,
        y: image.y + image.b * dx + image.d * dy,
        width,
        height,
      };
    } else {
      const value = command.value;
      let ratio: number;
      if (value === 'original') ratio = 0;
      else if (value === 'square') ratio = 1;
      else if (
        typeof value === 'string' &&
        /^(16:9|4:3|3:2|9:16|3:4|2:3)$/.test(value)
      ) {
        const [w, h] = value.split(':').map(Number);
        ratio = w / h;
      } else return;
      // Bounds in clip coordinates also handle a rotated or flipped image.
      const left =
        image.x +
        Math.min(0, image.a * image.width) +
        Math.min(0, image.c * image.height);
      const top =
        image.y +
        Math.min(0, image.b * image.width) +
        Math.min(0, image.d * image.height);
      const imageWidth =
        Math.abs(image.a) * image.width + Math.abs(image.c) * image.height;
      const imageHeight =
        Math.abs(image.b) * image.width + Math.abs(image.d) * image.height;
      const width = ratio
        ? Math.min(imageWidth, ratio * imageHeight)
        : imageWidth;
      const height = ratio ? width / ratio : imageHeight;
      const dx = left + (imageWidth - width) / 2;
      const dy = top + (imageHeight - height) / 2;
      clipPatch = {
        x: frame.x + frame.a * dx + frame.c * dy,
        y: frame.y + frame.b * dx + frame.d * dy,
        width,
        height,
      };
      childPatch = { x: image.x - dx, y: image.y - dy };
    }
    const changed = (node: SerializedNode, patch: Partial<SerializedNode>) =>
      Object.entries(patch).some(
        ([key, value]) => Math.abs(number(node[key], 0) - number(value)) > 1e-9,
      );
    if (
      Object.values(childPatch).some((value) => !Number.isFinite(value)) ||
      (clipPatch &&
        Object.values(clipPatch).some((value) => !Number.isFinite(value)))
    )
      return;
    if (
      !changed(child, childPatch) &&
      (!clipPatch || !changed(clip, clipPatch))
    )
      return;
    return (api) => {
      if (clipPatch) api.updateNode(clip, clipPatch);
      api.updateNode(child, childPatch);
    };
  }
}
