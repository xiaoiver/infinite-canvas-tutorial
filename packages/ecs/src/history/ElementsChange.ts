/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L399
 */
import { ComponentType, Entity } from '@lastolivegames/becsy';
import { isString } from '@antv/util';
import { Change } from './Change';
import { Delta } from './Delta';
import { newElementWith } from './Snapshot';
import {
  isGradient,
  randomInteger,
  deserializePoints,
  isDataUrl,
  isUrl,
  loadImage,
  deserializeBrushPoints,
} from '../utils';
import {
  resolveDesignVariableValue,
  designVariableRefKeyFromWire,
} from '../utils/design-variables';
import type {
  GSerializedNode,
  IconFontSerializedNode,
  SerializedNode,
  SerializedNodeAttributes,
} from '../types/serialized-node';
import { API } from '../API';
import { refreshComputedRoughForEntity } from '../systems/ComputeRough';
import {
  Name,
  FillSolid,
  FillGradient,
  Stroke,
  Visibility,
  Ellipse,
  Rect,
  Text,
  Opacity,
  DropShadow,
  Polyline,
  Path,
  ZIndex,
  Transform,
  MaterialDirty,
  FillImage,
  FillPattern,
  StrokeAttenuation,
  SizeAttenuation,
  TextDecoration,
  Rough,
  Marker,
  InnerShadow,
  Line,
  LockAspectRatio,
  HTML,
  Embed,
  Editable,
  Filter,
  Brush,
  Children,
  Parent,
  Locked,
  ClipMode,
  GeometryDirty,
  Flex,
  FlexLayoutDirty,
  Group,
  IconFont,
} from '../components';
import { getDescendants } from '../systems';
import { syncEdgeBindingForEntity } from '../utils/binding/sync-edge-entity';
import {
  buildIconFontScalablePrimitives,
  mapSvgLineCap,
  mapSvgLineJoin,
  pickChildFill,
  pickStrokeColorForChild,
  resolveIconFontWireStyle,
  strokeWidthFromIconStyle,
} from '../utils/icon-font';
import { getComputedInheritGroupWireForId } from '../utils/inherit-group-wire';
import { buildGroupWirePresentation } from '../utils/group-presentation';

export type SceneElementsMap = Map<SerializedNode['id'], SerializedNode>;

export type ElementPartial = Partial<SerializedNode>;

export type ElementUpdate<TElement extends SerializedNode> = Omit<
  Partial<TElement>,
  'id' | 'version' | 'versionNonce' | 'updated'
>;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export const getUpdatedTimestamp = () => Date.now();

/** 与 serialized-node 中 FlexboxLayoutAttributes 字段一致，变更时需让 Yoga 重新计算布局（即使 ComputedBounds 未变） */
const FLEX_LAYOUT_MUTATION_KEYS: readonly string[] = [
  'display',
  'padding',
  'margin',
  'gap',
  'rowGap',
  'columnGap',
  'alignItems',
  'alignSelf',
  'justifyContent',
  'flexDirection',
  'flexWrap',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'flex',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
];

function flexLayoutKeysChanged(
  updates: object,
  skipOverrideKeys: readonly string[],
  previous: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  return keys.some(
    (k) =>
      k in updates &&
      !skipOverrideKeys.includes(k) &&
      (updates as Record<string, unknown>)[k] !== previous[k],
  );
}

/** 整表 `updateNode(node, undefined)` 时 updates 与 element 同引用，值与快照总相等，须按「键在」标脏，否则首帧/加载后不会 markFlexLayoutDirty。变量表刷新已改为窄 patch。 */
function shouldMarkFlexContainerForLayout(
  entity: Entity,
  updates: object,
  element: object,
  skipOverrideKeys: readonly string[],
  preFlexLayout: Record<string, unknown>,
): boolean {
  if (!entity.has(Flex)) {
    return false;
  }
  if (Object.is(updates, element)) {
    return FLEX_LAYOUT_MUTATION_KEYS.some(
      (k) => k in updates && !skipOverrideKeys.includes(k),
    );
  }
  return flexLayoutKeysChanged(
    updates,
    skipOverrideKeys,
    preFlexLayout,
    FLEX_LAYOUT_MUTATION_KEYS,
  );
}

/** 子项上影响 Yoga 的布局键：实体无 Flex 组件，需标记父级 flex 容器以触发 Yoga */
const FLEX_ITEM_PARENT_RELAYOUT_KEYS: readonly string[] = [
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'padding',
  'margin',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'content',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'width',
  'height',
];

/**
 * 见 {@link flexLayoutKeysChanged} 与 `previous` 比较。整表自同步（updates===element）不标父级，免变量表式全量 `updateNode` 误伤。
 */
function updatesAffectFlexItemInParentTree(
  updates: object,
  element: object,
  skipOverrideKeys: readonly string[],
  previous: Record<string, unknown>,
): boolean {
  if (Object.is(updates, element)) {
    return false;
  }
  return flexLayoutKeysChanged(
    updates,
    skipOverrideKeys,
    previous,
    FLEX_ITEM_PARENT_RELAYOUT_KEYS,
  );
}

/**
 * YogaSystem 用 `q.added.with(FlexLayoutDirty)` 驱动；`safeAddComponent` 在组件已存在时
 * 不会再次 `add`，已脏的节点上连续改 padding 等会无法二次触发。先移除再添加以保证每帧可侦测到 added。
 */
function markFlexLayoutDirty(entity: Entity) {
  safeRemoveComponent(entity, FlexLayoutDirty);
  safeAddComponent(entity, FlexLayoutDirty);
}

export function safeAddComponent<T>(
  entity: Entity,
  componentCtor: ComponentType<T>,
  component?: Partial<T>,
) {
  if (!entity.has(componentCtor)) {
    entity.add(componentCtor);
  }
  if (component) {
    Object.assign(entity.write(componentCtor), component);
  }
}

export function safeRemoveComponent<T>(
  entity: Entity,
  componentCtor: ComponentType<T>,
) {
  if (entity.has(componentCtor)) {
    entity.remove(componentCtor);
  }
}

/**
 * `iconfont` 的矢量与颜色在子 path 实体上；根节点 width/height 等变更时需重算 primitive 并写回子几何。
 */
function syncIconFontChildrenFromUpdatedNode(
  rootEntity: Entity,
  node: IconFontSerializedNode,
  api: API,
) {
  if (!rootEntity.has(Parent)) {
    return;
  }
  const designVariables = api.getAppState().variables;
  const themeMode = api.getAppState().themeMode;
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  const scenePatched = api
    .getNodes()
    .map((n) => (n.id === node.id ? node : n));
  const nodeInherit = {
    ...node,
    ...getComputedInheritGroupWireForId(node.id, scenePatched),
  } as IconFontSerializedNode;
  const groupPres = buildGroupWirePresentation(
    nodeInherit,
    designVariables,
    themeMode,
  );
  const { userColorStroke, userColorFill, rSw } = resolveIconFontWireStyle(
    nodeInherit,
    designVariables,
    themeMode,
    groupPres,
  );
  const rName = resolveDesignVariableValue(
    node.iconFontName ?? '',
    designVariables,
    themeMode,
  );
  const rFamily = resolveDesignVariableValue(
    node.iconFontFamily ?? 'lucide',
    designVariables,
    themeMode,
  );
  const prims = buildIconFontScalablePrimitives(
    String(rName ?? node.iconFontName ?? ''),
    String(rFamily ?? node.iconFontFamily ?? 'lucide'),
    w,
    h,
  );
  if (!prims || prims.length === 0) {
    return;
  }
  const children = rootEntity.read(Parent).children;
  const n = Math.min(children.length, prims.length);
  for (let i = 0; i < n; i++) {
    const child = children[i]!;
    const prim = prims[i]!;
    if (prim.kind === 'path' && child.has(Path)) {
      child.write(Path).d = prim.d;
      safeAddComponent(child, GeometryDirty);
    } else if (prim.kind === 'ellipse' && child.has(Ellipse)) {
      child.write(Ellipse).cx = prim.cx;
      child.write(Ellipse).cy = prim.cy;
      child.write(Ellipse).rx = prim.rx;
      child.write(Ellipse).ry = prim.ry;
      safeAddComponent(child, GeometryDirty);
    } else if (prim.kind === 'line' && child.has(Line)) {
      child.write(Line).x1 = prim.x1;
      child.write(Line).y1 = prim.y1;
      child.write(Line).x2 = prim.x2;
      child.write(Line).y2 = prim.y2;
      safeAddComponent(child, GeometryDirty);
    }
    safeAddComponent(child, Stroke, {
      color: pickStrokeColorForChild(
        prim.style,
        userColorStroke,
        userColorFill,
      ),
      width: strokeWidthFromIconStyle(prim.style, rSw, {
        primKind: prim.kind,
      }),
      linecap: mapSvgLineCap(prim.style.strokeLinecap),
      linejoin: mapSvgLineJoin(prim.style.strokeLinejoin),
    });
    const fillPart = pickChildFill(
      prim.style,
      userColorFill,
      userColorStroke,
    );
    if (fillPart && fillPart !== 'none') {
      safeAddComponent(child, FillSolid, {
        value: fillPart,
        fillVariableRef: '',
      });
    } else {
      safeRemoveComponent(child, FillSolid);
    }
    safeAddComponent(child, MaterialDirty);
  }
  if (rootEntity.has(IconFont) && w > 0 && h > 0) {
    const iw = rootEntity.write(IconFont);
    iw.layoutWidth = w;
    iw.layoutHeight = h;
  }
  safeAddComponent(rootEntity, Group, groupPres);
  safeRemoveComponent(rootEntity, FillSolid);
  safeRemoveComponent(rootEntity, FillGradient);
  safeRemoveComponent(rootEntity, FillImage);
  safeRemoveComponent(rootEntity, FillPattern);
  safeRemoveComponent(rootEntity, Stroke);
  safeAddComponent(rootEntity, MaterialDirty);
}

export class ElementsChange implements Change<SceneElementsMap> {
  static empty() {
    return ElementsChange.create(new Map(), new Map(), new Map(), undefined);
  }

  private static stripIrrelevantProps(
    partial: Partial<SerializedNode>,
  ): ElementPartial {
    const { id, updated, version, versionNonce, ...strippedPartial } = partial;

    return strippedPartial;
  }

  /**
   * Calculates the `Delta`s between the previous and next set of elements.
   *
   * @param prevElements - Map representing the previous state of elements.
   * @param nextElements - Map representing the next state of elements.
   *
   * @returns `ElementsChange` instance representing the `Delta` changes between the two sets of elements.
   */
  public static calculate<T extends SerializedNode>(
    prevElements: Map<string, T>,
    nextElements: Map<string, T>,
    api: API,
  ): ElementsChange {
    if (prevElements === nextElements) {
      return ElementsChange.empty();
    }

    const added = new Map<string, Delta<ElementPartial>>();
    const removed = new Map<string, Delta<ElementPartial>>();
    const updated = new Map<string, Delta<ElementPartial>>();

    // this might be needed only in same edge cases, like during collab, when `isDeleted` elements get removed or when we (un)intentionally remove the elements
    for (const prevElement of prevElements.values()) {
      const nextElement = nextElements.get(prevElement.id);

      if (!nextElement) {
        const deleted = { ...prevElement, isDeleted: false } as ElementPartial;
        const inserted = { isDeleted: true } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsChange.stripIrrelevantProps,
        );

        removed.set(prevElement.id, delta);
      }
    }

    for (const nextElement of nextElements.values()) {
      const prevElement = prevElements.get(nextElement.id);

      if (!prevElement) {
        const deleted = { isDeleted: true } as ElementPartial;
        const inserted = {
          ...nextElement,
          isDeleted: false,
        } as ElementPartial;

        const delta = Delta.create(
          deleted,
          inserted,
          ElementsChange.stripIrrelevantProps,
        );

        added.set(nextElement.id, delta);

        continue;
      }

      if (prevElement.versionNonce !== nextElement.versionNonce) {
        const delta = Delta.calculate<ElementPartial>(
          prevElement,
          nextElement,
          ElementsChange.stripIrrelevantProps,
          // ElementsChange.postProcess,
        );

        if (
          // making sure we don't get here some non-boolean values (i.e. undefined, null, etc.)
          typeof prevElement.isDeleted === 'boolean' &&
          typeof nextElement.isDeleted === 'boolean' &&
          prevElement.isDeleted !== nextElement.isDeleted
        ) {
          // notice that other props could have been updated as well
          if (prevElement.isDeleted && !nextElement.isDeleted) {
            added.set(nextElement.id, delta);
          } else {
            removed.set(nextElement.id, delta);
          }

          continue;
        }

        // making sure there are at least some changes
        if (!Delta.isEmpty(delta)) {
          updated.set(nextElement.id, delta);
        }
      }
    }

    return ElementsChange.create(added, removed, updated, api);
  }

  private static satisfiesAddition = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) =>
    // dissallowing added as "deleted", which could cause issues when resolving conflicts
    deleted.isDeleted === true && !inserted.isDeleted;

  private static satisfiesRemoval = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) =>
    !deleted.isDeleted && inserted.isDeleted === true;

  private static satisfiesUpdate = ({
    deleted,
    inserted,
  }: Delta<ElementPartial>) => !!deleted.isDeleted === !!inserted.isDeleted;

  private static createGetter =
    (
      elements: SceneElementsMap,
      snapshot: Map<string, SerializedNode>,
      flags: {
        containsVisibleDifference: boolean;
        containsZindexDifference: boolean;
      },
    ) =>
      (id: string, partial: ElementPartial) => {
        let element = elements.get(id);

        if (!element) {
          // always fallback to the local snapshot, in cases when we cannot find the element in the elements array
          element = snapshot.get(id);

          if (element) {
            // as the element was brought from the snapshot, it automatically results in a possible zindex difference
            flags.containsZindexDifference = true;

            // as the element was force deleted, we need to check if adding it back results in a visible change
            if (
              partial.isDeleted === false ||
              (partial.isDeleted !== true && element.isDeleted === false)
            ) {
              flags.containsVisibleDifference = true;
            }
          }
        }

        return element;
      };

  private static createApplier = (
    nextElements: SceneElementsMap,
    snapshot: Map<string, SerializedNode>,
    flags: {
      containsVisibleDifference: boolean;
      containsZindexDifference: boolean;
    },
  ) => {
    const getElement = ElementsChange.createGetter(
      nextElements,
      snapshot,
      flags,
    );

    return (deltas: Map<string, Delta<ElementPartial>>) =>
      Array.from(deltas.entries()).reduce((acc, [id, delta]) => {
        const element = getElement(id, delta.inserted);

        if (element) {
          const newElement = ElementsChange.applyDelta(element, delta, flags);
          nextElements.set(newElement.id, newElement);
          acc.set(newElement.id, newElement);
        }

        return acc;
      }, new Map<string, SerializedNode>());
  };

  /**
   * Check for visible changes regardless of whether they were removed, added or updated.
   */
  private static checkForVisibleDifference(
    element: SerializedNode,
    partial: ElementPartial,
  ) {
    if (element.isDeleted && partial.isDeleted !== false) {
      // when it's deleted and partial is not false, it cannot end up with a visible change
      return false;
    }

    if (element.isDeleted && partial.isDeleted === false) {
      // when we add an element, it results in a visible change
      return true;
    }

    if (element.isDeleted === false && partial.isDeleted) {
      // when we remove an element, it results in a visible change
      return true;
    }

    // check for any difference on a visible element
    return Delta.isRightDifferent(element, partial);
  }

  private static applyDelta(
    element: SerializedNode,
    delta: Delta<ElementPartial>,
    flags: {
      containsVisibleDifference: boolean;
      containsZindexDifference: boolean;
    } = {
        // by default we don't care about about the flags
        containsVisibleDifference: true,
        containsZindexDifference: true,
      },
  ) {
    const { ...directlyApplicablePartial } = delta.inserted;

    // if (
    //   delta.deleted.boundElements?.length ||
    //   delta.inserted.boundElements?.length
    // ) {
    //   const mergedBoundElements = Delta.mergeArrays(
    //     element.boundElements,
    //     delta.inserted.boundElements,
    //     delta.deleted.boundElements,
    //     (x) => x.id,
    //   );

    //   Object.assign(directlyApplicablePartial, {
    //     boundElements: mergedBoundElements,
    //   });
    // }

    if (!flags.containsVisibleDifference) {
      // strip away fractional as even if it would be different, it doesn't have to result in visible change
      const { fractionalIndex, ...rest } = directlyApplicablePartial;
      const containsVisibleDifference =
        ElementsChange.checkForVisibleDifference(element, rest);

      flags.containsVisibleDifference = containsVisibleDifference;
    }

    if (!flags.containsZindexDifference) {
      flags.containsZindexDifference =
        delta.deleted.fractionalIndex !== delta.inserted.fractionalIndex;
    }

    return newElementWith(element, directlyApplicablePartial);
  }

  public static create(
    added: Map<string, Delta<ElementPartial>>,
    removed: Map<string, Delta<ElementPartial>>,
    updated: Map<string, Delta<ElementPartial>>,
    api: API,
    options = { shouldRedistribute: false },
  ) {
    let change: ElementsChange;

    if (options.shouldRedistribute) {
      const nextAdded = new Map<string, Delta<ElementPartial>>();
      const nextRemoved = new Map<string, Delta<ElementPartial>>();
      const nextUpdated = new Map<string, Delta<ElementPartial>>();

      const deltas = [...added, ...removed, ...updated];

      for (const [id, delta] of deltas) {
        if (this.satisfiesAddition(delta)) {
          nextAdded.set(id, delta);
        } else if (this.satisfiesRemoval(delta)) {
          nextRemoved.set(id, delta);
        } else {
          nextUpdated.set(id, delta);
        }
      }

      change = new ElementsChange(nextAdded, nextRemoved, nextUpdated, api);
    } else {
      change = new ElementsChange(added, removed, updated, api);
    }

    return change;
  }

  private constructor(
    private readonly added: Map<string, Delta<ElementPartial>>,
    private readonly removed: Map<string, Delta<ElementPartial>>,
    private readonly updated: Map<string, Delta<ElementPartial>>,
    private readonly api: API,
  ) { }

  inverse(): ElementsChange {
    const inverseInternal = (deltas: Map<string, Delta<ElementPartial>>) => {
      const inversedDeltas = new Map<string, Delta<ElementPartial>>();

      for (const [id, delta] of deltas.entries()) {
        inversedDeltas.set(id, Delta.create(delta.inserted, delta.deleted));
      }

      return inversedDeltas;
    };

    const added = inverseInternal(this.added);
    const removed = inverseInternal(this.removed);
    const updated = inverseInternal(this.updated);

    // notice we inverse removed with added not to break the invariants
    return ElementsChange.create(removed, added, updated, this.api);
  }

  /**
   * Update delta/s based on the existing elements.
   *
   * @param elements current elements
   * @param modifierOptions defines which of the delta (`deleted` or `inserted`) will be updated
   * @returns new instance with modified delta/s
   */
  public applyLatestChanges(elements: SceneElementsMap): ElementsChange {
    const modifier = (element: SerializedNode) => (partial: ElementPartial) => {
      // (element: OrderedSerializedNode) => (partial: ElementPartial) => {
      const latestPartial: { [key: string]: unknown } = {};

      for (const key of Object.keys(partial) as Array<keyof typeof partial>) {
        // do not update following props:
        // - `boundElements`, as it is a reference value which is postprocessed to contain only deleted/inserted keys
        switch (key) {
          // case 'boundElements':
          //   latestPartial[key] = partial[key];
          //   break;
          default:
            latestPartial[key] = element[key];
        }
      }

      return latestPartial;
    };

    const applyLatestChangesInternal = (
      deltas: Map<string, Delta<ElementPartial>>,
    ) => {
      const modifiedDeltas = new Map<string, Delta<ElementPartial>>();

      for (const [id, delta] of deltas.entries()) {
        const existingElement = elements.get(id);

        if (existingElement) {
          const modifiedDelta = Delta.create(
            delta.deleted,
            delta.inserted,
            modifier(existingElement),
            'inserted',
          );

          modifiedDeltas.set(id, modifiedDelta);
        } else {
          modifiedDeltas.set(id, delta);
        }
      }

      return modifiedDeltas;
    };

    const added = applyLatestChangesInternal(this.added);
    const removed = applyLatestChangesInternal(this.removed);
    const updated = applyLatestChangesInternal(this.updated);

    return ElementsChange.create(added, removed, updated, this.api, {
      shouldRedistribute: true, // redistribute the deltas as `isDeleted` could have been updated
    });
  }

  applyTo(
    elements: SceneElementsMap,
    snapshot: Map<string, SerializedNode>,
  ): [SceneElementsMap, boolean] {
    const nextElements = new Map(elements);

    const flags = {
      containsVisibleDifference: false,
      containsZindexDifference: false,
    };

    const applyDeltas = ElementsChange.createApplier(
      nextElements,
      snapshot,
      flags,
    );

    const addedElements = applyDeltas(this.added);
    const removedElements = applyDeltas(this.removed);
    const updatedElements = applyDeltas(this.updated);

    const changedElements = new Map([
      ...addedElements,
      ...removedElements,
      ...updatedElements,
    ]);

    if (this.api) {
      const touchedIds = new Set<string>();
      const pendingAdded = Array.from(this.added.entries());
      const processedAddedIds = new Set<string>();

      // parent-first apply for batched add deltas
      while (pendingAdded.length > 0) {
        let progressed = false;

        for (let i = 0; i < pendingAdded.length;) {
          const [id, delta] = pendingAdded[i];
          const parentId = delta.inserted.parentId as string | undefined;
          const parentReady =
            !parentId ||
            !!this.api.getNodeById(parentId) ||
            processedAddedIds.has(parentId);

          if (!parentReady) {
            i++;
            continue;
          }

          const { inserted, deleted } = delta;
          const element = addedElements.get(id);
          if (element) {
            Object.keys(deleted).forEach((key) => {
              delete element[key];
            });
            Object.assign(element, inserted);
            this.api.updateNode(element, delta.inserted);
            touchedIds.add(id);
          }
          processedAddedIds.add(id);
          pendingAdded.splice(i, 1);
          progressed = true;
        }

        if (!progressed) {
          const [id, delta] = pendingAdded.shift()!;
          const { inserted, deleted } = delta;
          const element = addedElements.get(id);
          if (element) {
            Object.keys(deleted).forEach((key) => {
              delete element[key];
            });
            Object.assign(element, inserted);
            this.api.updateNode(element, delta.inserted);
            touchedIds.add(id);
          }
          processedAddedIds.add(id);
        }
      }

      this.removed.forEach((delta, id) => {
        const element = nextElements.get(id);
        if (element) {
          this.api.deleteNodesById([id]);
        }
      });

      this.updated.forEach((delta, id) => {
        const { inserted, deleted } = delta;
        const element = nextElements.get(id);
        if (element) {
          Object.keys(deleted).forEach((key) => {
            delete element[key];
          });
          Object.assign(element, inserted);
          this.api.updateNode(element, delta.inserted);
          touchedIds.add(id);
        }
      });

      // Reconcile serialized parentId with ECS relation after batch apply.
      touchedIds.forEach((id) => {
        const node = nextElements.get(id);
        if (!node) {
          return;
        }

        const entity = this.api.getEntity(node);
        safeAddComponent(entity, Children);

        if (node.parentId) {
          const parentNode = this.api.getNodeById(node.parentId);
          if (parentNode) {
            const parentEntity = this.api.getEntity(parentNode);
            safeAddComponent(parentEntity, Parent);
            entity.write(Children).parent = parentEntity;
            return;
          }
        }

        entity.write(Children).parent = this.api.getCamera();
      });
    }

    return [nextElements, flags.containsVisibleDifference];
  }

  isEmpty(): boolean {
    return (
      this.added.size === 0 &&
      this.removed.size === 0 &&
      this.updated.size === 0
    );
  }
}

// This function tracks updates of text elements for the purposes for collaboration.
// The version is used to compare updates when more than one user is working in
// the same drawing. Note: this will trigger the component to update. Make sure you
// are calling it either from a React event handler or within unstable_batchedUpdates().
export const mutateElement = <TElement extends Mutable<SerializedNode>>(
  entity: Entity,
  element: TElement,
  updates: ElementUpdate<TElement>,
  skipOverrideKeys: string[] = [],
  api: API,
): TElement => {
  let didChange = false;

  const el = element as Record<string, unknown>;
  const preFlexLayout: Record<string, unknown> = {};
  for (const k of FLEX_LAYOUT_MUTATION_KEYS) {
    if (k in updates && !skipOverrideKeys.includes(k)) {
      preFlexLayout[k] = el[k];
    }
  }
  const preFlexItemParent: Record<string, unknown> = {};
  for (const k of FLEX_ITEM_PARENT_RELAYOUT_KEYS) {
    if (k in updates && !skipOverrideKeys.includes(k)) {
      preFlexItemParent[k] = el[k];
    }
  }

  for (const key in updates) {
    const value = (updates as any)[key];
    // if (typeof value !== 'undefined') {
    if (!skipOverrideKeys.includes(key)) {
      (element as any)[key] = value;
    }
    didChange = true;
    // }
  }

  if (!didChange) {
    return element;
  }

  const designVariables = api.getAppState().variables;
  const themeMode = api.getAppState().themeMode;
  const elNode = element as SerializedNode;
  const scenePatched = api
    .getNodes()
    .map((n) => (n.id === elNode.id ? elNode : n));
  const withInheritPaint = {
    ...elNode,
    ...getComputedInheritGroupWireForId(elNode.id, scenePatched),
  };

  const { name, visibility } = updates;
  const {
    parentId,
    zIndex,
    fill,
    stroke,
    strokeWidth,
    strokeLinecap,
    strokeLinejoin,
    strokeAlignment,
    opacity,
    fillOpacity,
    strokeOpacity,
    innerShadowColor,
    innerShadowBlurRadius,
    innerShadowOffsetX,
    innerShadowOffsetY,
    dropShadowColor,
    dropShadowBlurRadius,
    dropShadowOffsetX,
    dropShadowOffsetY,
    fontSize,
    x,
    y,
    width,
    height,
    cornerRadius,
    rotation,
    scaleX,
    scaleY,
    points,
    d,
    anchorX,
    anchorY,
    fontWeight,
    fontStyle,
    fontKerning,
    letterSpacing,
    lineHeight,
    textAlign,
    textBaseline,
    content,
    sizeAttenuation,
    strokeAttenuation,
    decorationColor,
    decorationLine,
    decorationThickness,
    decorationStyle,
    roughRoughness,
    roughBowing,
    roughFillStyle,
    roughFillWeight,
    roughHachureAngle,
    roughHachureGap,
    roughCurveStepCount,
    roughCurveFitting,
    roughDisableMultiStroke,
    roughDisableMultiStrokeFill,
    roughSimplification,
    roughDashOffset,
    roughDashGap,
    roughZigzagOffset,
    roughPreserveVertices,
    roughFillLineDash,
    roughFillLineDashOffset,
    roughSeed,
    markerStart,
    markerEnd,
    markerFactor,
    x1,
    y1,
    x2,
    y2,
    lockAspectRatio,
    editable,
    isEditing,
    locked,
    filter,
    brushStamp,
    clipMode,
  } = updates as unknown as SerializedNodeAttributes;

  /** 矢量/颜色在子 path 上；若对根写 Fill/Stroke 会与 `syncIconFontChildren` 子实体冲突或渲染异常。 */
  const t = (element as SerializedNode).type;
  const isIconFontWireNode = t === 'iconfont' || (t as string) === 'icon_font';

  if ('parentId' in updates) {
    if (parentId) {
      const parentNode = api.getNodeById(parentId);
      if (parentNode) {
        const newParentEntity = api.getEntity(parentNode);
        safeAddComponent(entity, Children);
        // const oldParentEntity = entity.read(Children).parent;
        safeAddComponent(newParentEntity, Parent);
        entity.write(Children).parent = newParentEntity;
      }
    } else {
      // Remove the entity from the parent's children
      safeAddComponent(entity, Children);
      entity.write(Children).parent = api.getCamera();
    }
  }

  if ('name' in updates) {
    entity.write(Name).value = name;
  }
  if ('lockAspectRatio' in updates) {
    if (lockAspectRatio) {
      safeAddComponent(entity, LockAspectRatio);
    } else {
      safeRemoveComponent(entity, LockAspectRatio);
    }
  }
  if ('zIndex' in updates) {
    entity.write(ZIndex).value = zIndex ?? 0;
  }
  if ('visibility' in updates) {
    entity.write(Visibility).value = visibility;
  }
  if ('fill' in updates && !isIconFontWireNode) {
    const resolvedFill = resolveDesignVariableValue(
      fill,
      designVariables,
      themeMode,
    );
    if (isGradient(resolvedFill)) {
      safeRemoveComponent(entity, FillSolid);
      safeRemoveComponent(entity, FillImage);
      safeRemoveComponent(entity, FillPattern);

      safeAddComponent(entity, MaterialDirty);
      safeAddComponent(entity, FillGradient, { value: resolvedFill });
    } else if (isDataUrl(resolvedFill) || isUrl(resolvedFill)) {
      safeRemoveComponent(entity, FillSolid);
      safeRemoveComponent(entity, FillGradient);
      safeRemoveComponent(entity, FillPattern);

      safeAddComponent(entity, MaterialDirty);
      loadImage(resolvedFill, entity);
    } else {
      if (entity.has(FillGradient)) {
        safeAddComponent(entity, MaterialDirty);
      }

      safeRemoveComponent(entity, FillGradient);
      safeAddComponent(entity, FillSolid, {
        value: resolvedFill as string,
        fillVariableRef: designVariableRefKeyFromWire(
          typeof fill === 'string' ? fill : undefined,
        ),
      });
    }
  }
  if ('brushStamp' in updates) {
    if (isDataUrl(brushStamp) || isUrl(brushStamp)) {
      loadImage(brushStamp, entity);
    }
  }
  if ('clipMode' in updates) {
    safeAddComponent(entity, ClipMode, { value: clipMode });
    safeAddComponent(entity, MaterialDirty);
    // Should mark children cascade as dirty
    getDescendants(entity).forEach((child) => {
      safeAddComponent(child, MaterialDirty);
    });
  }
  if ('stroke' in updates && !isIconFontWireNode) {
    safeAddComponent(entity, Stroke, {
      color: resolveDesignVariableValue(stroke, designVariables, themeMode),
      colorVariableRef: designVariableRefKeyFromWire(
        typeof stroke === 'string' ? stroke : undefined,
      ),
    });
  }
  if ('strokeWidth' in updates && !isIconFontWireNode) {
    const w = resolveDesignVariableValue(
      strokeWidth,
      designVariables,
      themeMode,
    );
    safeAddComponent(entity, Stroke, {
      ...(w !== undefined && w !== null
        ? { width: typeof w === 'number' ? w : Number(w) }
        : {}),
      widthVariableRef: designVariableRefKeyFromWire(strokeWidth),
    });
  }
  if ('strokeLinecap' in updates && !isIconFontWireNode) {
    safeAddComponent(entity, Stroke, { linecap: strokeLinecap });
  }
  if ('strokeLinejoin' in updates && !isIconFontWireNode) {
    safeAddComponent(entity, Stroke, { linejoin: strokeLinejoin });
  }
  if ('strokeAlignment' in updates && !isIconFontWireNode) {
    safeAddComponent(entity, Stroke, { alignment: strokeAlignment });
  }
  if ('opacity' in updates) {
    safeAddComponent(entity, Opacity, { opacity });
  }
  if ('fillOpacity' in updates) {
    const fo = resolveDesignVariableValue(
      fillOpacity,
      designVariables,
      themeMode,
    );
    const n =
      fo !== undefined && fo !== null
        ? typeof fo === 'number'
          ? fo
          : parseFloat(String(fo))
        : NaN;
    const v = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
    safeAddComponent(entity, Opacity, { fillOpacity: v });
  }
  if ('strokeOpacity' in updates) {
    const so = resolveDesignVariableValue(
      strokeOpacity,
      designVariables,
      themeMode,
    );
    const n =
      so !== undefined && so !== null
        ? typeof so === 'number'
          ? so
          : parseFloat(String(so))
        : NaN;
    const v = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
    safeAddComponent(entity, Opacity, { strokeOpacity: v });
  }
  if ('dropShadowColor' in updates) {
    safeAddComponent(entity, DropShadow, {
      color: resolveDesignVariableValue(
        dropShadowColor,
        designVariables,
        themeMode,
      ),
    });
  }
  if ('dropShadowBlurRadius' in updates) {
    safeAddComponent(entity, DropShadow, { blurRadius: dropShadowBlurRadius });
  }
  if ('dropShadowOffsetX' in updates) {
    safeAddComponent(entity, DropShadow, { offsetX: dropShadowOffsetX });
  }
  if ('dropShadowOffsetY' in updates) {
    safeAddComponent(entity, DropShadow, { offsetY: dropShadowOffsetY });
  }
  if ('innerShadowColor' in updates) {
    safeAddComponent(entity, InnerShadow, {
      color: resolveDesignVariableValue(
        innerShadowColor,
        designVariables,
        themeMode,
      ),
    });
  }
  if ('innerShadowBlurRadius' in updates) {
    safeAddComponent(entity, InnerShadow, {
      blurRadius: innerShadowBlurRadius,
    });
  }
  if ('innerShadowOffsetX' in updates) {
    safeAddComponent(entity, InnerShadow, { offsetX: innerShadowOffsetX });
  }
  if ('innerShadowOffsetY' in updates) {
    safeAddComponent(entity, InnerShadow, { offsetY: innerShadowOffsetY });
  }
  if ('sizeAttenuation' in updates) {
    if (sizeAttenuation) {
      safeAddComponent(entity, SizeAttenuation);
    } else {
      safeRemoveComponent(entity, SizeAttenuation);
    }
  }
  if ('strokeAttenuation' in updates) {
    if (strokeAttenuation) {
      safeAddComponent(entity, StrokeAttenuation);
    } else {
      safeRemoveComponent(entity, StrokeAttenuation);
    }
  }
  if ('decorationColor' in updates) {
    safeAddComponent(entity, TextDecoration, {
      color: resolveDesignVariableValue(
        decorationColor,
        designVariables,
        themeMode,
      ),
    });
  }
  if ('decorationLine' in updates) {
    safeAddComponent(entity, TextDecoration, { line: decorationLine });
  }
  if ('decorationStyle' in updates) {
    safeAddComponent(entity, TextDecoration, { style: decorationStyle });
  }
  if ('decorationThickness' in updates) {
    safeAddComponent(entity, TextDecoration, {
      thickness: decorationThickness,
    });
  }
  if ('roughRoughness' in updates) {
    safeAddComponent(entity, Rough, { roughness: roughRoughness });
  }
  if ('roughBowing' in updates) {
    safeAddComponent(entity, Rough, { bowing: roughBowing });
  }
  if ('roughFillStyle' in updates) {
    safeAddComponent(entity, Rough, { fillStyle: roughFillStyle });
    safeAddComponent(entity, MaterialDirty);
  }
  if ('roughFillWeight' in updates) {
    safeAddComponent(entity, Rough, { fillWeight: roughFillWeight });
  }
  if ('roughHachureAngle' in updates) {
    safeAddComponent(entity, Rough, { hachureAngle: roughHachureAngle });
  }
  if ('roughHachureGap' in updates) {
    safeAddComponent(entity, Rough, { hachureGap: roughHachureGap });
  }
  if ('roughCurveStepCount' in updates) {
    safeAddComponent(entity, Rough, { curveStepCount: roughCurveStepCount });
  }
  if ('roughCurveFitting' in updates) {
    safeAddComponent(entity, Rough, { curveFitting: roughCurveFitting });
  }
  if ('roughDisableMultiStroke' in updates) {
    safeAddComponent(entity, Rough, {
      disableMultiStroke: roughDisableMultiStroke,
    });
  }
  if ('roughDisableMultiStrokeFill' in updates) {
    safeAddComponent(entity, Rough, {
      disableMultiStrokeFill: roughDisableMultiStrokeFill,
    });
  }
  if ('roughSimplification' in updates) {
    safeAddComponent(entity, Rough, { simplification: roughSimplification });
  }
  if ('roughDashOffset' in updates) {
    safeAddComponent(entity, Rough, { dashOffset: roughDashOffset });
  }
  if ('roughDashGap' in updates) {
    safeAddComponent(entity, Rough, { dashGap: roughDashGap });
  }
  if ('roughZigzagOffset' in updates) {
    safeAddComponent(entity, Rough, { zigzagOffset: roughZigzagOffset });
  }
  if ('roughPreserveVertices' in updates) {
    safeAddComponent(entity, Rough, {
      preserveVertices: roughPreserveVertices,
    });
  }
  if ('roughFillLineDash' in updates) {
    safeAddComponent(entity, Rough, { fillLineDash: roughFillLineDash });
  }
  if ('roughFillLineDashOffset' in updates) {
    safeAddComponent(entity, Rough, {
      fillLineDashOffset: roughFillLineDashOffset,
    });
  }
  if ('roughSeed' in updates) {
    safeAddComponent(entity, Rough, { seed: roughSeed });
  }

  if ('markerStart' in updates) {
    safeAddComponent(entity, Marker, { start: markerStart });
  }
  if ('markerEnd' in updates) {
    safeAddComponent(entity, Marker, { end: markerEnd });
  }
  if ('markerFactor' in updates) {
    safeAddComponent(entity, Marker, { factor: markerFactor });
  }

  if ('anchorX' in updates) {
    entity.write(Text).anchorX = anchorX;
  }
  if ('anchorY' in updates) {
    entity.write(Text).anchorY = anchorY;
  }
  if ('fontSize' in updates) {
    const fs = resolveDesignVariableValue(
      fontSize,
      designVariables,
      themeMode,
    );
    entity.write(Text).fontSize =
      typeof fs === 'number' ? fs : Number(fs);
    entity.write(Text).fontSizeVariableRef =
      designVariableRefKeyFromWire(fontSize);
  }
  if ('wordWrapWidth' in updates) {
    const w = (updates as { wordWrapWidth?: number }).wordWrapWidth;
    if (w !== undefined) {
      entity.write(Text).wordWrapWidth = w;
    }
  }
  if ('fontFamily' in updates) {
    const raw = (updates as { fontFamily?: string }).fontFamily;
    const resolved = resolveDesignVariableValue(
      raw,
      designVariables,
      themeMode,
    );
    const s =
      resolved != null && String(resolved).trim() !== ''
        ? String(resolved)
        : 'sans-serif';
    entity.write(Text).fontFamily = s;
  }
  if ('fontWeight' in updates) {
    entity.write(Text).fontWeight = fontWeight;
  }
  if ('fontStyle' in updates) {
    entity.write(Text).fontStyle = fontStyle;
  }
  if ('fontVariant' in updates) {
    const raw = (updates as { fontVariant?: string }).fontVariant;
    const resolved = resolveDesignVariableValue(
      raw,
      designVariables,
      themeMode,
    );
    if (resolved != null) {
      entity.write(Text).fontVariant = String(resolved);
    }
  }
  if ('fontKerning' in updates) {
    entity.write(Text).fontKerning = fontKerning;
  }
  if ('letterSpacing' in updates) {
    const raw = (updates as { letterSpacing?: number | string }).letterSpacing;
    const resolved = resolveDesignVariableValue(
      raw,
      designVariables,
      themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      entity.write(Text).letterSpacing = n;
    }
  }
  if ('lineHeight' in updates) {
    const raw = (updates as { lineHeight?: number | string }).lineHeight;
    const resolved = resolveDesignVariableValue(
      raw,
      designVariables,
      themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n) && n >= 0) {
      entity.write(Text).lineHeight = n;
    }
  }
  if ('textAlign' in updates) {
    entity.write(Text).textAlign = textAlign;
  }
  if ('textBaseline' in updates) {
    entity.write(Text).textBaseline = textBaseline;
  }
  if ('content' in updates) {
    entity.write(Text).content = content;
  }

  if ('x' in updates) {
    if (x !== undefined && !isString(x)) {
      entity.write(Transform).translation.x = x;
    }
  }
  if ('y' in updates) {
    if (y !== undefined && !isString(y)) {
      entity.write(Transform).translation.y = y;
    }
  }
  if ('rotation' in updates) {
    if (rotation !== undefined) {
      entity.write(Transform).rotation = rotation;
    }
  }
  if ('scaleX' in updates) {
    if (scaleX !== undefined) {
      entity.write(Transform).scale.x = scaleX;
    }
  }
  if ('scaleY' in updates) {
    if (scaleY !== undefined) {
      entity.write(Transform).scale.y = scaleY;
    }
  }
  if ('width' in updates) {
    if (width !== undefined && !isString(width)) {
      if (entity.has(Rect)) {
        entity.write(Rect).width = width;
      } else if (entity.has(Ellipse)) {
        Object.assign(entity.write(Ellipse), {
          rx: width / 2,
          cx: width / 2,
        });
      } else if (entity.has(HTML)) {
        entity.write(HTML).width = width;
      } else if (entity.has(Embed)) {
        entity.write(Embed).width = width;
      }
    }
  }
  if ('height' in updates) {
    if (height !== undefined && !isString(height)) {
      if (entity.has(Rect)) {
        entity.write(Rect).height = height;
      } else if (entity.has(Ellipse)) {
        Object.assign(entity.write(Ellipse), {
          ry: height / 2,
          cy: height / 2,
        });
      } else if (entity.has(HTML)) {
        entity.write(HTML).height = height;
      } else if (entity.has(Embed)) {
        entity.write(Embed).height = height;
      }
    }
  }
  if ('cornerRadius' in updates && cornerRadius !== undefined && entity.has(Rect)) {
    const resolved = resolveDesignVariableValue(
      cornerRadius,
      designVariables,
      themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      entity.write(Rect).cornerRadius = Math.max(0, n);
    }
  }
  if ('points' in updates) {
    if (entity.has(Polyline)) {
      entity.write(Polyline).points = deserializePoints(points);
    } else if (entity.has(Brush)) {
      entity.write(Brush).points = deserializeBrushPoints(points);
    }
  }
  if ('d' in updates) {
    if (entity.has(Path)) {
      entity.write(Path).d = d;
    }
  }
  if ('x1' in updates) {
    entity.write(Line).x1 = x1;
  }
  if ('y1' in updates) {
    entity.write(Line).y1 = y1;
  }
  if ('x2' in updates) {
    entity.write(Line).x2 = x2;
  }
  if ('y2' in updates) {
    entity.write(Line).y2 = y2;
  }
  if (
    ('x1' in updates || 'y1' in updates || 'x2' in updates || 'y2' in updates)
  ) {
    if (entity.has(Line)) {
      safeAddComponent(entity, GeometryDirty);
      if (entity.has(Rough)) {
        refreshComputedRoughForEntity(entity);
      }
    }
  }

  if ('hitStrokeWidth' in updates) {
    const v = (updates as { hitStrokeWidth?: number }).hitStrokeWidth;
    const next =
      v != null && Number.isFinite(v) && v >= 0 ? v : -1;
    if (entity.has(Line)) {
      entity.write(Line).hitStrokeWidth = next;
    } else if (entity.has(Polyline)) {
      entity.write(Polyline).hitStrokeWidth = next;
    } else if (entity.has(Path)) {
      entity.write(Path).hitStrokeWidth = next;
    }
  }

  if ('editable' in updates) {
    if (editable) {
      safeAddComponent(entity, Editable);
    } else {
      safeRemoveComponent(entity, Editable);
    }
  }
  if ('isEditing' in updates) {
    safeAddComponent(entity, Editable);
    entity.write(Editable).isEditing = !!isEditing;
  }

  if ('locked' in updates) {
    if (locked) {
      safeAddComponent(entity, Locked);
      const node = api.getNodeByEntity(entity);
      api.deselectNodes([node]);
      api.unhighlightNodes([node]);
    } else {
      safeRemoveComponent(entity, Locked);
    }
  }

  if ('filter' in updates) {
    safeAddComponent(entity, Filter, { value: filter });
    safeAddComponent(entity, MaterialDirty);
  }

  if ('display' in updates) {
    const d = (updates as { display?: string }).display;
    if (d === 'flex') {
      safeAddComponent(entity, Flex);
    } else {
      safeRemoveComponent(entity, Flex);
      safeRemoveComponent(entity, FlexLayoutDirty);
    }
  }

  if (
    shouldMarkFlexContainerForLayout(
      entity,
      updates,
      element,
      skipOverrideKeys,
      preFlexLayout,
    )
  ) {
    markFlexLayoutDirty(entity);
  }

  if (
    updatesAffectFlexItemInParentTree(
      updates,
      element,
      skipOverrideKeys,
      preFlexItemParent,
    )
  ) {
    const pid = element.parentId;
    if (pid) {
      const parentNode = api.getNodeById(pid);
      if (parentNode && (parentNode as { display?: string }).display === 'flex') {
        const parentEntity = api.getEntity(parentNode);
        if (parentEntity?.has(Flex)) {
          markFlexLayoutDirty(parentEntity);
        }
      }
    }
  }

  if ('version' in updates) {
    element.version = 0;
  }

  if (
    ('fromId' in updates ||
      'toId' in updates ||
      'sourcePoint' in updates ||
      'targetPoint' in updates ||
      'exitX' in updates ||
      'exitY' in updates ||
      'exitPerimeter' in updates ||
      'exitDx' in updates ||
      'exitDy' in updates ||
      'entryX' in updates ||
      'entryY' in updates ||
      'entryPerimeter' in updates ||
      'entryDx' in updates ||
      'entryDy' in updates) &&
    (entity.has(Polyline) || entity.has(Line) || entity.has(Path))
  ) {
    syncEdgeBindingForEntity(api, entity, element);
  }

  {
    const nodeType = (element as SerializedNode).type;
    const isIconFontNode =
      nodeType === 'iconfont' ||
      (nodeType as string) === 'icon_font';
    if (
      isIconFontNode &&
      (('fill' in updates) ||
        ('stroke' in updates) ||
        ('strokeWidth' in updates) ||
        ('strokeLinecap' in updates) ||
        ('strokeLinejoin' in updates) ||
        ('strokeAlignment' in updates) ||
        ('width' in updates) ||
        ('height' in updates) ||
        ('iconFontName' in updates) ||
        ('iconFontFamily' in updates))
    ) {
      syncIconFontChildrenFromUpdatedNode(
        entity,
        element as IconFontSerializedNode,
        api,
      );
    }
  }

  {
    const gType = (element as SerializedNode).type;
    if (
      gType === 'g' &&
      (('fill' in updates) ||
        ('stroke' in updates) ||
        ('strokeWidth' in updates) ||
        ('fillRule' in updates) ||
        ('opacity' in updates) ||
        ('fillOpacity' in updates) ||
        ('strokeOpacity' in updates) ||
        ('strokeLinecap' in updates) ||
        ('strokeLinejoin' in updates))
    ) {
      safeAddComponent(
        entity,
        Group,
        buildGroupWirePresentation(
          withInheritPaint as GSerializedNode,
          designVariables,
          themeMode,
        ),
      );
    }
  }

  // Object.assign(element, updates);

  element.version++;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();

  // Remove undefined keys
  Object.keys(element).forEach((key) => {
    if (element[key] === undefined) {
      delete element[key];
    }
  });

  return element;
};
