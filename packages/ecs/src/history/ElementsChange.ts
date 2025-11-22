/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L399
 */
import { ComponentType, Entity } from '@lastolivegames/becsy';
import { isNil } from '@antv/util';
import { Change } from './Change';
import { Delta } from './Delta';
import { newElementWith } from './Snapshot';
import {
  isGradient,
  randomInteger,
  SerializedNode,
  deserializePoints,
  SerializedNodeAttributes,
  isDataUrl,
  isUrl,
  loadImage,
} from '../utils';
import { API } from '../API';
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
} from '../components';

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

    // if (isImageElement(element)) {
    //   const _delta = delta as Delta<ElementPartial<ExcalidrawImageElement>>;
    //   // we want to override `crop` only if modified so that we don't reset
    //   // when undoing/redoing unrelated change
    //   if (_delta.deleted.crop || _delta.inserted.crop) {
    //     Object.assign(directlyApplicablePartial, {
    //       // apply change verbatim
    //       crop: _delta.inserted.crop ?? null,
    //     });
    //   }
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
  ) {}

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

    if (this.api) {
      this.added.forEach((delta, id) => {
        const { inserted, deleted } = delta;
        const element = addedElements.get(id);
        if (element) {
          Object.keys(deleted).forEach((key) => {
            delete element[key];
          });
          Object.assign(element, inserted);
          this.api.updateNode(element, delta.inserted);
        }
      });

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
        }
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
): TElement => {
  let didChange = false;

  for (const key in updates) {
    const value = (updates as any)[key];
    if (typeof value !== 'undefined') {
      (element as any)[key] = value;
      didChange = true;
    }
  }

  if (!didChange) {
    return element;
  }

  const { name, visibility } = updates;
  const {
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
    rotation,
    scaleX,
    scaleY,
    points,
    d,
    fontWeight,
    fontStyle,
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
  } = updates as unknown as SerializedNodeAttributes;

  if (!isNil(name)) {
    entity.write(Name).value = name;
  }
  if (!isNil(lockAspectRatio)) {
    if (lockAspectRatio) {
      safeAddComponent(entity, LockAspectRatio);
    } else {
      safeRemoveComponent(entity, LockAspectRatio);
    }
  }
  if (!isNil(zIndex)) {
    entity.write(ZIndex).value = zIndex;
  }
  if (!isNil(visibility)) {
    entity.write(Visibility).value = visibility;
  }
  if (!isNil(fill)) {
    if (isGradient(fill)) {
      safeRemoveComponent(entity, FillSolid);
      safeRemoveComponent(entity, FillImage);
      safeRemoveComponent(entity, FillPattern);

      safeAddComponent(entity, MaterialDirty);
      safeAddComponent(entity, FillGradient, { value: fill });
    } else if (isDataUrl(fill) || isUrl(fill)) {
      safeRemoveComponent(entity, FillSolid);
      safeRemoveComponent(entity, FillGradient);
      safeRemoveComponent(entity, FillPattern);

      safeAddComponent(entity, MaterialDirty);
      loadImage(fill, entity);
    } else {
      if (entity.has(FillGradient)) {
        safeAddComponent(entity, MaterialDirty);
      }

      safeRemoveComponent(entity, FillGradient);
      safeAddComponent(entity, FillSolid, { value: fill });
    }
  }
  if (!isNil(stroke)) {
    safeAddComponent(entity, Stroke, { color: stroke });
  }
  if (!isNil(strokeWidth)) {
    safeAddComponent(entity, Stroke, { width: strokeWidth });
  }
  if (!isNil(strokeLinecap)) {
    safeAddComponent(entity, Stroke, { linecap: strokeLinecap });
  }
  if (!isNil(strokeLinejoin)) {
    safeAddComponent(entity, Stroke, { linejoin: strokeLinejoin });
  }
  if (!isNil(strokeAlignment)) {
    safeAddComponent(entity, Stroke, { alignment: strokeAlignment });
  }
  if (!isNil(opacity)) {
    safeAddComponent(entity, Opacity, { opacity });
  }
  if (!isNil(fillOpacity)) {
    safeAddComponent(entity, Opacity, { fillOpacity });
  }
  if (!isNil(strokeOpacity)) {
    safeAddComponent(entity, Opacity, { strokeOpacity });
  }
  if (!isNil(dropShadowColor)) {
    safeAddComponent(entity, DropShadow, { color: dropShadowColor });
  }
  if (!isNil(dropShadowBlurRadius)) {
    safeAddComponent(entity, DropShadow, { blurRadius: dropShadowBlurRadius });
  }
  if (!isNil(dropShadowOffsetX)) {
    safeAddComponent(entity, DropShadow, { offsetX: dropShadowOffsetX });
  }
  if (!isNil(dropShadowOffsetY)) {
    safeAddComponent(entity, DropShadow, { offsetY: dropShadowOffsetY });
  }
  if (!isNil(innerShadowColor)) {
    safeAddComponent(entity, InnerShadow, { color: innerShadowColor });
  }
  if (!isNil(innerShadowBlurRadius)) {
    safeAddComponent(entity, InnerShadow, {
      blurRadius: innerShadowBlurRadius,
    });
  }
  if (!isNil(innerShadowOffsetX)) {
    safeAddComponent(entity, InnerShadow, { offsetX: innerShadowOffsetX });
  }
  if (!isNil(innerShadowOffsetY)) {
    safeAddComponent(entity, InnerShadow, { offsetY: innerShadowOffsetY });
  }
  if (!isNil(sizeAttenuation)) {
    if (sizeAttenuation) {
      safeAddComponent(entity, SizeAttenuation);
    } else {
      safeRemoveComponent(entity, SizeAttenuation);
    }
  }
  if (!isNil(strokeAttenuation)) {
    if (strokeAttenuation) {
      safeAddComponent(entity, StrokeAttenuation);
    } else {
      safeRemoveComponent(entity, StrokeAttenuation);
    }
  }
  if (!isNil(decorationColor)) {
    safeAddComponent(entity, TextDecoration, { color: decorationColor });
  }
  if (!isNil(decorationLine)) {
    safeAddComponent(entity, TextDecoration, { line: decorationLine });
  }
  if (!isNil(decorationStyle)) {
    safeAddComponent(entity, TextDecoration, { style: decorationStyle });
  }
  if (!isNil(decorationThickness)) {
    safeAddComponent(entity, TextDecoration, {
      thickness: decorationThickness,
    });
  }
  if (!isNil(roughRoughness)) {
    safeAddComponent(entity, Rough, { roughness: roughRoughness });
  }
  if (!isNil(roughBowing)) {
    safeAddComponent(entity, Rough, { bowing: roughBowing });
  }
  if (!isNil(roughFillStyle)) {
    safeAddComponent(entity, Rough, { fillStyle: roughFillStyle });
  }
  if (!isNil(roughFillWeight)) {
    safeAddComponent(entity, Rough, { fillWeight: roughFillWeight });
  }
  if (!isNil(roughHachureAngle)) {
    safeAddComponent(entity, Rough, { hachureAngle: roughHachureAngle });
  }
  if (!isNil(roughHachureGap)) {
    safeAddComponent(entity, Rough, { hachureGap: roughHachureGap });
  }
  if (!isNil(roughCurveStepCount)) {
    safeAddComponent(entity, Rough, { curveStepCount: roughCurveStepCount });
  }
  if (!isNil(roughCurveFitting)) {
    safeAddComponent(entity, Rough, { curveFitting: roughCurveFitting });
  }
  if (!isNil(roughDisableMultiStroke)) {
    safeAddComponent(entity, Rough, {
      disableMultiStroke: roughDisableMultiStroke,
    });
  }
  if (!isNil(roughDisableMultiStrokeFill)) {
    safeAddComponent(entity, Rough, {
      disableMultiStrokeFill: roughDisableMultiStrokeFill,
    });
  }
  if (!isNil(roughSimplification)) {
    safeAddComponent(entity, Rough, { simplification: roughSimplification });
  }
  if (!isNil(roughDashOffset)) {
    safeAddComponent(entity, Rough, { dashOffset: roughDashOffset });
  }
  if (!isNil(roughDashGap)) {
    safeAddComponent(entity, Rough, { dashGap: roughDashGap });
  }
  if (!isNil(roughZigzagOffset)) {
    safeAddComponent(entity, Rough, { zigzagOffset: roughZigzagOffset });
  }
  if (!isNil(roughPreserveVertices)) {
    safeAddComponent(entity, Rough, {
      preserveVertices: roughPreserveVertices,
    });
  }
  if (!isNil(roughFillLineDash)) {
    safeAddComponent(entity, Rough, { fillLineDash: roughFillLineDash });
  }
  if (!isNil(roughFillLineDashOffset)) {
    safeAddComponent(entity, Rough, {
      fillLineDashOffset: roughFillLineDashOffset,
    });
  }
  if (!isNil(roughSeed)) {
    safeAddComponent(entity, Rough, { seed: roughSeed });
  }

  if (!isNil(markerStart)) {
    safeAddComponent(entity, Marker, { start: markerStart });
  }
  if (!isNil(markerEnd)) {
    safeAddComponent(entity, Marker, { end: markerEnd });
  }
  if (!isNil(markerFactor)) {
    safeAddComponent(entity, Marker, { factor: markerFactor });
  }

  if (!isNil(fontSize)) {
    entity.write(Text).fontSize = fontSize;
  }
  if (!isNil(fontWeight)) {
    entity.write(Text).fontWeight = fontWeight;
  }
  if (!isNil(fontStyle)) {
    entity.write(Text).fontStyle = fontStyle;
  }
  if (!isNil(textAlign)) {
    entity.write(Text).textAlign = textAlign;
  }
  if (!isNil(textBaseline)) {
    entity.write(Text).textBaseline = textBaseline;
  }
  if (!isNil(content)) {
    entity.write(Text).content = content;
  }
  // TODO: Other text properties e.g. fontFamily

  if (!isNil(x)) {
    entity.write(Transform).translation.x = x;
  }
  if (!isNil(y)) {
    entity.write(Transform).translation.y = y;
  }
  if (!isNil(rotation)) {
    entity.write(Transform).rotation = rotation;
  }
  if (!isNil(scaleX)) {
    entity.write(Transform).scale.x = scaleX;
  }
  if (!isNil(scaleY)) {
    entity.write(Transform).scale.y = scaleY;
  }
  if (!isNil(width)) {
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
  if (!isNil(height)) {
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
  if (!isNil(points)) {
    if (entity.has(Polyline)) {
      entity.write(Polyline).points = deserializePoints(points);
    }
  }
  if (!isNil(d)) {
    if (entity.has(Path)) {
      entity.write(Path).d = d;
    }
  }
  if (!isNil(x1)) {
    entity.write(Line).x1 = x1;
  }
  if (!isNil(y1)) {
    entity.write(Line).y1 = y1;
  }
  if (!isNil(x2)) {
    entity.write(Line).x2 = x2;
  }
  if (!isNil(y2)) {
    entity.write(Line).y2 = y2;
  }

  if (!isNil(editable)) {
    if (editable) {
      safeAddComponent(entity, Editable);
    } else {
      safeRemoveComponent(entity, Editable);
    }
  }
  if (!isNil(isEditing)) {
    safeAddComponent(entity, Editable);
    entity.write(Editable).isEditing = !!isEditing;
  }

  if (isNil(element.version)) {
    element.version = 0;
  }

  Object.assign(element, updates);

  element.version++;
  element.versionNonce = randomInteger();
  element.updated = getUpdatedTimestamp();

  return element;
};
