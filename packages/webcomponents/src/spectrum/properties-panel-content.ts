import { html, css, LitElement, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  SerializedNode,
  AppState,
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  migrateLegacyFillWireInPlace,
  migrateLegacyStrokeWireInPlace,
  resolveDesignVariableValue,
  type FlexboxLayoutAttributes,
  type IconFontSerializedNode,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { when } from 'lit/directives/when.js';
import { live } from 'lit/directives/live.js';
import { DEG_TO_RAD, RAD_TO_DEG } from '@pixi/math';
import { apiContext, appStateContext } from '../context';
import { ExtendedAPI } from '../API';
import { localized, msg, str } from '@lit/localize';
import '@spectrum-web-components/field-label/sp-field-label.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/overlay/overlay-trigger.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-padding-left.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-padding-top.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-padding-right.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-padding-bottom.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-margin-left.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-margin-top.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-margin-right.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-margin-bottom.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-link.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-unlink.js';
import '@spectrum-web-components/tooltip/sp-tooltip.js';
import '@spectrum-web-components/textfield/sp-textfield.js';
import '@spectrum-web-components/accordion/sp-accordion.js';
import '@spectrum-web-components/accordion/sp-accordion-item.js';
import type { DesignVariablePickDetail } from './design-variable-picker';
import './design-variable-picker.js';
import './export-panel';
import './icon-font-controls.js';
import type { IconFontControlsPatch } from './icon-font-controls';
import './fill-section.js';
import './layer-blend-mode-row.js';
import './stroke-section.js';
import './stroke-content.js';
import './text-content.js';

type FlexNode = SerializedNode & Partial<FlexboxLayoutAttributes>;
type TransformField = 'width' | 'height' | 'x' | 'y' | 'rotation';
type LayoutNumberField =
  | 'padding'
  | 'margin'
  | 'gap'
  | 'rowGap'
  | 'columnGap'
  | 'flexGrow'
  | 'flexShrink'
  | 'flexBasis'
  | 'minWidth'
  | 'maxWidth'
  | 'minHeight'
  | 'maxHeight';
type LayoutChoiceField =
  | 'flexDirection'
  | 'alignItems'
  | 'justifyContent'
  | 'flexWrap'
  | 'alignSelf';

/** Yoga：`number` / `[上下, 左右]` / `[上,右,下,左]`，用于 padding / margin */
function normalizeBoxSides(
  p: number | number[] | undefined,
): [number, number, number, number] {
  if (p == null) {
    return [0, 0, 0, 0];
  }
  if (typeof p === 'number' && Number.isFinite(p)) {
    return [p, p, p, p];
  }
  if (Array.isArray(p)) {
    if (p.length === 1) {
      return [p[0], p[0], p[0], p[0]];
    }
    if (p.length === 2) {
      return [p[0], p[1], p[0], p[1]];
    }
    if (p.length >= 4) {
      return [p[0], p[1], p[2], p[3]];
    }
  }
  return [0, 0, 0, 0];
}

function sidesToBoxValue(
  s: [number, number, number, number],
): number | number[] {
  const [t, r, b, l] = s;
  if (t === r && r === b && b === l) {
    return t;
  }
  return [t, r, b, l];
}

function boxSidesUniform(s: [number, number, number, number]): boolean {
  return s[0] === s[1] && s[1] === s[2] && s[2] === s[3];
}
@customElement('ic-spectrum-properties-panel-content')
@localized()
export class PropertiesPanelContent extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      min-height: 0;
      max-height: 400px;

      --system-accordion-size-s-item-header-font-size: 13px;
      --mod-accordion-item-header-font-size: 13px;
    }

    :host(.fills-panel) {
      height: 100%;
      max-height: none;
    }

    sp-popover {
      padding: 0;
    }

    sp-accordion {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: overlay;
      overflow: hidden auto;
      max-height: none;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
    }

    .style-group {
      .line {
        sp-field-label {
          width: 100px;
        }
      }

      .fill-opacity-controls {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        min-width: 0;
      }

      .dv-popover-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        box-sizing: border-box;
      }

      .dv-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      .dv-badge {
        font-size: var(--spectrum-font-size-75);
        color: var(--spectrum-purple-900);
        background: var(--spectrum-purple-100);
        border-radius: 4px;
        padding: 2px 6px;
      }
    }

    .line {
      display: flex;
      align-items: center;
      justify-content: space-between;

      sp-field-label {
        width: 30px;
      }

      sp-number-field {
        width: 70px;
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    }

    .lock {
      width: 20px;
      height: 20px;

      svg {
        height: 100%;
        width: 100%;
        vertical-align: top;
        color: inherit;
      }
    }

    .lock-button {
      position: absolute;
      left: 118px;
      top: 18px;
    }

    .layout-group {
      .line {
        gap: 4px;

        sp-field-label {
          width: 100px;
          flex-shrink: 0;
        }

        sp-picker {
          width: 70px;
        }
      }

      .layout-inset-inline {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1 1 auto;
        min-width: 0;
        justify-content: flex-end;
      }

      .layout-inset-sides-popover {
        padding: 10px;
        min-width: 200px;
      }

      .layout-inset-sides-popover .side-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        margin-bottom: 4px;
      }

      .layout-inset-sides-popover .side-row:last-child {
        margin-bottom: 0;
      }

    .layout-inset-sides-popover sp-field-label {
      width: 72px;
      flex-shrink: 0;
    }

    .layout-inset-sides-popover sp-number-field {
      width: 70px;
    }
  `;

  @consume({ context: appStateContext, subscribe: true })
  appState: AppState;

  @consume({ context: apiContext, subscribe: true })
  api: ExtendedAPI;

  @property()
  node: SerializedNode;

  /** 与 {@link SerializedNode.lockAspectRatio} 同步；未设置时视为未锁定。 */
  private get lockAspectRatio(): boolean {
    return this.node.lockAspectRatio === true;
  }

  private get propertiesPanelSectionsOpenResolved(): {
    fillSection: boolean;
    strokeSection: boolean;
    typographySection: boolean;
    shape: boolean;
    transform: boolean;
    layout: boolean;
    flexItem: boolean;
    effects: boolean;
    exportSection: boolean;
    iconFont: boolean;
  } {
    const s = (
      this.appState as AppState & {
        propertiesPanelSectionsOpen?: Partial<{
          fillSection: boolean;
          strokeSection: boolean;
          typographySection: boolean;
          shape: boolean;
          transform: boolean;
          layout: boolean;
          flexItem: boolean;
          effects: boolean;
          exportSection: boolean;
          iconFont: boolean;
        }>;
      }
    )?.propertiesPanelSectionsOpen;
    return {
      fillSection: s?.fillSection ?? true,
      strokeSection: s?.strokeSection ?? true,
      typographySection: s?.typographySection ?? true,
      shape: s?.shape ?? true,
      transform: s?.transform ?? true,
      layout: s?.layout ?? true,
      flexItem: s?.flexItem ?? true,
      effects: s?.effects ?? true,
      exportSection: s?.exportSection ?? true,
      iconFont: s?.iconFont ?? true,
    };
  }

  /** 父节点为 flex 容器时，当前节点可作为 flex 子项配置 align-self / flex-grow 等 */
  private isFlexChild(): boolean {
    const pid = this.node.parentId;
    if (!pid) {
      return false;
    }
    const parent = this.api.getNodeById(pid);
    return parent?.display === 'flex';
  }

  private async editPanelProperties(
    resolvePatch: (
      node: FlexNode,
      api: ExtendedAPI,
    ) => Partial<FlexNode> | undefined,
  ) {
    const api = this.api;
    const source = this.node;
    if (!api || !source) return;
    const { id, type } = source;
    const controller = new AbortController();
    const dispose = api.onDestroy(() => controller.abort());
    try {
      await api.edit(
        (editor) => {
          const current = editor.getNodeById(id);
          if (
            !current ||
            current.isDeleted ||
            current.type !== type ||
            !editor.getEntity(current)
          ) {
            controller.abort();
            return;
          }
          // Resolve compound values and variables in the owning write phase.
          const patch = resolvePatch(current, editor);
          if (
            !patch ||
            Object.entries(patch).every(([key, value]) => {
              const previous = current[key as keyof SerializedNode];
              return (
                previous === value ||
                (Array.isArray(previous) &&
                  Array.isArray(value) &&
                  previous.length === value.length &&
                  previous.every((item, i) => item === value[i]))
              );
            })
          ) {
            // Cancel before writing: an empty commit can capture unrelated changes.
            controller.abort();
            return;
          }
          editor.updateNode(current, patch);
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    } finally {
      dispose();
      this.requestUpdate();
    }
  }

  /** Spectrum reports a cleared native input as NaN; other invalid values are ignored. */
  private static readOptionalNumber(
    e: Event,
  ): { value: number | undefined } | undefined {
    const control = e.target as HTMLElement & {
      value?: number | string;
      inputElement?: HTMLInputElement;
    };
    const raw = control.value;
    if (
      raw == null ||
      (typeof raw === 'string' && raw.trim() === '') ||
      (Number.isNaN(raw) && control.inputElement?.value.trim() === '')
    ) {
      return { value: undefined };
    }
    const value = Number(raw);
    return Number.isFinite(value) ? { value } : undefined;
  }

  private handleCornerRadiusChanged(e: Event) {
    const parsed = PropertiesPanelContent.readOptionalNumber(e);
    if (parsed?.value === undefined) {
      this.requestUpdate();
      return;
    }
    const value = Math.max(0, parsed.value);
    return this.editPanelProperties((node) =>
      (node as RectSerializedNode).cornerRadius === value ||
      ((node as RectSerializedNode).cornerRadius == null && value === 0)
        ? undefined
        : { cornerRadius: value },
    );
  }

  private handleCornerRadiusVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    const key = e.detail?.key;
    if (typeof key !== 'string' || !key) return;
    return this.editPanelProperties((node, api) =>
      api.getAppState().variables?.[key]?.type === 'number'
        ? { cornerRadius: `$${key}` as unknown as number }
        : undefined,
    );
  }

  private handleCornerRadiusVariableUnbind() {
    return this.editPanelProperties((node, api) => {
      const raw = (node as RectSerializedNode).cornerRadius as
        | number
        | string
        | undefined;
      if (!isDesignVariableReference(raw)) return;
      const { variables, themeMode } = api.getAppState();
      const resolved = resolveDesignVariableValue(raw, variables, themeMode);
      if (typeof resolved === 'string' && resolved.trim() === '') return;
      const value = Number(resolved);
      if (Number.isFinite(value)) return { cornerRadius: Math.max(0, value) };
    });
  }

  private async editTransform(
    field: TransformField | 'lockAspectRatio',
    value?: number,
  ) {
    const api = this.api;
    const source = this.node;
    if (!api || !source) return;
    const { id, type } = source;
    const controller = new AbortController();
    const dispose = api.onDestroy(() => controller.abort());
    try {
      await api.edit(
        (editor) => {
          const current = editor.getNodeById(id);
          if (
            !current ||
            current.isDeleted ||
            current.type !== type ||
            !editor.getEntity(current)
          ) {
            controller.abort();
            return;
          }
          if (field === 'lockAspectRatio') {
            // Toggle the committed state so multiple queued clicks compose.
            editor.updateNode(current, {
              lockAspectRatio: current.lockAspectRatio !== true,
            });
            return;
          }
          const isSize = field === 'width' || field === 'height';
          const flex = current as FlexNode;
          const changesHug =
            isSize &&
            flex.display === 'flex' &&
            (field === 'width' ? flex.flexHugWidth : flex.flexHugHeight) !==
              false;
          const previous = isSize ? current[field] : current[field] ?? 0;
          if (previous === value && !changesHug) {
            // An empty commit could capture unrelated unrecorded changes.
            controller.abort();
            return;
          }
          if (isSize && current.lockAspectRatio === true) {
            const ratio = current.width / current.height;
            const otherSize = field === 'width' ? value / ratio : value * ratio;
            if (
              !Number.isFinite(ratio) ||
              ratio <= 0 ||
              !Number.isFinite(otherSize)
            ) {
              // A zero/unknown aspect ratio cannot produce a valid resize.
              // Cancel before writing; edit() does not roll back mutations.
              controller.abort();
              return;
            }
          }
          if (field === 'rotation') {
            editor.updateNode(current, { rotation: value });
          } else {
            editor.updateNodeOBB(
              current,
              { [field]: value },
              current.lockAspectRatio === true,
            );
          }
        },
        { signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    } finally {
      dispose();
      this.requestUpdate();
    }
  }

  private handleTransformChanged(field: TransformField, e: Event) {
    const raw = (e.target as HTMLElement & { value?: number | string }).value;
    if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
      this.requestUpdate();
      return;
    }
    const value = Number(raw);
    if (
      !Number.isFinite(value) ||
      ((field === 'width' || field === 'height') && value < 0)
    ) {
      this.requestUpdate();
      return;
    }
    return this.editTransform(
      field,
      field === 'rotation' ? value * DEG_TO_RAD : value,
    );
  }

  private handleWidthChanged(e: Event) {
    return this.handleTransformChanged('width', e);
  }

  private handleHeightChanged(e: Event) {
    return this.handleTransformChanged('height', e);
  }

  private handleXChanged(e: Event) {
    return this.handleTransformChanged('x', e);
  }

  private handleYChanged(e: Event) {
    return this.handleTransformChanged('y', e);
  }

  private handleAngleChanged(e: Event) {
    return this.handleTransformChanged('rotation', e);
  }

  private handleLockAspectRatioChanged() {
    return this.editTransform('lockAspectRatio');
  }

  private async handleIconFontControlsPatch(
    e: CustomEvent<IconFontControlsPatch>,
  ) {
    const api = this.api;
    const node = this.node;
    if (
      !api ||
      !node ||
      (node.type !== 'iconfont' && (node.type as string) !== 'icon_font')
    )
      return;
    const id = node.id;
    const controller = new AbortController();
    const dispose = api.onDestroy(() => controller.abort());
    try {
      // The panel and event detail can be reused before the queued edit runs.
      const patch = structuredClone(e.detail);
      await api.edit(
        (editor) => {
          const current = editor.getNodeById(id);
          if (
            !current ||
            current.isDeleted ||
            !editor.getEntity(current) ||
            (current.type !== 'iconfont' &&
              (current.type as string) !== 'icon_font')
          ) {
            controller.abort();
            return;
          }
          if (
            Object.entries(patch).every(
              ([key, value]) =>
                (current as IconFontSerializedNode)[
                  key as keyof IconFontControlsPatch
                ] === value,
            )
          ) {
            controller.abort();
            return;
          }
          editor.updateNode(current, patch);
        },
        { signal: controller.signal },
      );
      this.requestUpdate();
    } catch (error) {
      if (!controller.signal.aborted) console.error(error);
    } finally {
      dispose();
    }
  }

  private handleLayoutNumberChanged(field: LayoutNumberField, e: Event) {
    const parsed = PropertiesPanelContent.readOptionalNumber(e);
    if (!parsed || (parsed.value !== undefined && parsed.value < 0)) {
      this.requestUpdate();
      return;
    }
    const { value } = parsed;
    return this.editPanelProperties(() => ({ [field]: value }));
  }

  private handleBoxSideChanged(
    field: 'padding' | 'margin',
    index: 0 | 1 | 2 | 3,
    e: Event,
  ) {
    const parsed = PropertiesPanelContent.readOptionalNumber(e);
    if (!parsed || (parsed.value !== undefined && parsed.value < 0)) {
      this.requestUpdate();
      return;
    }
    const value = parsed.value ?? 0;
    return this.editPanelProperties((node) => {
      const sides = normalizeBoxSides(node[field]);
      if (sides[index] === value) return;
      sides[index] = value;
      return { [field]: sidesToBoxValue(sides) };
    });
  }

  private handleLayoutChoiceChanged(
    field: LayoutChoiceField,
    choices: readonly string[],
    e: Event,
  ) {
    const value = (e.target as HTMLElement & { value: string }).value;
    if (!choices.includes(value)) {
      this.requestUpdate();
      return;
    }
    return this.editPanelProperties(() => ({
      [field]: field === 'alignSelf' && value === 'auto' ? undefined : value,
    }));
  }

  private handlePaddingSideChanged(index: 0 | 1 | 2 | 3, e: Event) {
    return this.handleBoxSideChanged('padding', index, e);
  }

  private handleMarginSideChanged(index: 0 | 1 | 2 | 3, e: Event) {
    return this.handleBoxSideChanged('margin', index, e);
  }

  private handleLayoutPaddingChanged(e: Event) {
    return this.handleLayoutNumberChanged('padding', e);
  }

  private handleLayoutMarginChanged(e: Event) {
    return this.handleLayoutNumberChanged('margin', e);
  }

  private handleLayoutGapChanged(e: Event) {
    return this.handleLayoutNumberChanged('gap', e);
  }

  private handleLayoutRowGapChanged(e: Event) {
    return this.handleLayoutNumberChanged('rowGap', e);
  }

  private handleLayoutColumnGapChanged(e: Event) {
    return this.handleLayoutNumberChanged('columnGap', e);
  }

  private handleFlexGrowChanged(e: Event) {
    return this.handleLayoutNumberChanged('flexGrow', e);
  }

  private handleFlexShrinkChanged(e: Event) {
    return this.handleLayoutNumberChanged('flexShrink', e);
  }

  private handleFlexBasisChanged(e: Event) {
    return this.handleLayoutNumberChanged('flexBasis', e);
  }

  private handleMinWidthChanged(e: Event) {
    return this.handleLayoutNumberChanged('minWidth', e);
  }

  private handleMaxWidthChanged(e: Event) {
    return this.handleLayoutNumberChanged('maxWidth', e);
  }

  private handleMinHeightChanged(e: Event) {
    return this.handleLayoutNumberChanged('minHeight', e);
  }

  private handleMaxHeightChanged(e: Event) {
    return this.handleLayoutNumberChanged('maxHeight', e);
  }

  private handleFlexDirectionChanged(e: Event) {
    return this.handleLayoutChoiceChanged(
      'flexDirection',
      ['row', 'row-reverse', 'column', 'column-reverse'],
      e,
    );
  }

  private handleAlignItemsChanged(e: Event) {
    return this.handleLayoutChoiceChanged(
      'alignItems',
      ['center', 'flex-start', 'flex-end', 'stretch', 'baseline'],
      e,
    );
  }

  private handleJustifyContentChanged(e: Event) {
    return this.handleLayoutChoiceChanged(
      'justifyContent',
      [
        'center',
        'flex-start',
        'flex-end',
        'space-between',
        'space-around',
        'space-evenly',
      ],
      e,
    );
  }

  private handleFlexWrapChanged(e: Event) {
    return this.handleLayoutChoiceChanged(
      'flexWrap',
      ['nowrap', 'wrap', 'wrap-reverse'],
      e,
    );
  }

  private handleAlignSelfChanged(e: Event) {
    return this.handleLayoutChoiceChanged(
      'alignSelf',
      ['auto', 'center', 'flex-start', 'flex-end', 'stretch', 'baseline'],
      e,
    );
  }

  /** Flex 子项上的 padding / margin（与 Layout 相同交互，id 前缀避免与容器区块冲突） */
  private flexItemPaddingMarginMinMaxRows(safeId: string): TemplateResult {
    const n = this.node as FlexNode;
    const paddingSides = normalizeBoxSides(n.padding);
    const paddingUniform = boxSidesUniform(paddingSides);
    const padTriggerId = `fi-pad-${safeId}`;
    const marginSides = normalizeBoxSides(n.margin);
    const marginUniform = boxSidesUniform(marginSides);
    const marTriggerId = `fi-mar-${safeId}`;
    const minW = n.minWidth;
    const maxW = n.maxWidth;
    const minH = n.minHeight;
    const maxH = n.maxHeight;

    return html`
      <div class="line">
        <sp-field-label for=${`fi-pad-main-${safeId}`} side-aligned="start"
          >${msg(str`Padding`)}</sp-field-label
        >
        <div class="layout-inset-inline">
          <sp-action-button
            quiet
            size="s"
            id=${padTriggerId}
            label=${msg(str`Padding per side`)}
          >
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Padding per side`)}
            </sp-tooltip>
            <sp-icon-padding-left slot="icon"></sp-icon-padding-left>
          </sp-action-button>
          <sp-overlay
            trigger=${`${padTriggerId}@click`}
            placement="bottom"
            type="auto"
          >
            <sp-popover class="layout-inset-sides-popover">
              ${[0, 1, 2, 3].map(
      (i) => html`
                <div class="side-row">
                  <sp-field-label
                    for=${`fi-pad-${safeId}-${i}`}
                    side-aligned="start"
                    >${i === 0
          ? msg(str`Top`)
          : i === 1
            ? msg(str`Right`)
            : i === 2
              ? msg(str`Bottom`)
              : msg(str`Left`)}</sp-field-label
                  >
                  ${i === 0
          ? html`<sp-icon-padding-top slot="icon"></sp-icon-padding-top>`
          : i === 1
            ? html`<sp-icon-padding-right
                        slot="icon"
                      ></sp-icon-padding-right>`
            : i === 2
              ? html`<sp-icon-padding-bottom
                        slot="icon"
                      ></sp-icon-padding-bottom>`
              : html`<sp-icon-padding-left
                        slot="icon"
                      ></sp-icon-padding-left>`}
                  <sp-number-field
                    id=${`fi-pad-${safeId}-${i}`}
                    size="s"
                    .value=${live(paddingSides[i])}
                    @change=${(e: Event) =>
          this.handlePaddingSideChanged(i as 0 | 1 | 2 | 3, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
              `,
    )}
            </sp-popover>
          </sp-overlay>
          <sp-number-field
            id=${`fi-pad-main-${safeId}`}
            size="s"
            .value=${live(paddingUniform ? paddingSides[0] : '')}
            placeholder=${paddingUniform ? '' : '—'}
            ?readonly=${!paddingUniform}
            @change=${this.handleLayoutPaddingChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            format-options='{"style":"unit","unit":"px"}'
          ></sp-number-field>
        </div>
      </div>
      <div class="line">
        <sp-field-label for=${`fi-mar-main-${safeId}`} side-aligned="start"
          >${msg(str`Margin`)}</sp-field-label
        >
        <div class="layout-inset-inline">
          <sp-action-button
            quiet
            size="s"
            id=${marTriggerId}
            label=${msg(str`Margin per side`)}
          >
            <sp-tooltip self-managed placement="bottom">
              ${msg(str`Margin per side`)}
            </sp-tooltip>
            <sp-icon-margin-left slot="icon"></sp-icon-margin-left>
          </sp-action-button>
          <sp-overlay
            trigger=${`${marTriggerId}@click`}
            placement="bottom"
            type="auto"
          >
            <sp-popover class="layout-inset-sides-popover">
              ${[0, 1, 2, 3].map(
      (i) => html`
                <div class="side-row">
                  <sp-field-label
                    for=${`fi-mar-${safeId}-${i}`}
                    side-aligned="start"
                    >${i === 0
          ? msg(str`Top`)
          : i === 1
            ? msg(str`Right`)
            : i === 2
              ? msg(str`Bottom`)
              : msg(str`Left`)}</sp-field-label
                  >
                  ${i === 0
          ? html`<sp-icon-margin-top slot="icon"></sp-icon-margin-top>`
          : i === 1
            ? html`<sp-icon-margin-right
                        slot="icon"
                      ></sp-icon-margin-right>`
            : i === 2
              ? html`<sp-icon-margin-bottom
                        slot="icon"
                      ></sp-icon-margin-bottom>`
              : html`<sp-icon-margin-left
                        slot="icon"
                      ></sp-icon-margin-left>`}
                  <sp-number-field
                    id=${`fi-mar-${safeId}-${i}`}
                    size="s"
                    .value=${live(marginSides[i])}
                    @change=${(e: Event) =>
          this.handleMarginSideChanged(i as 0 | 1 | 2 | 3, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
              `,
    )}
            </sp-popover>
          </sp-overlay>
          <sp-number-field
            id=${`fi-mar-main-${safeId}`}
            size="s"
            .value=${live(marginUniform ? marginSides[0] : '')}
            placeholder=${marginUniform ? '' : '—'}
            ?readonly=${!marginUniform}
            @change=${this.handleLayoutMarginChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            format-options='{"style":"unit","unit":"px"}'
          ></sp-number-field>
        </div>
      </div>
      <div class="line">
        <sp-field-label for=${`fi-minw-${safeId}`} side-aligned="start"
          >${msg(str`Min width`)}</sp-field-label
        >
        <sp-number-field
          id=${`fi-minw-${safeId}`}
          size="s"
          .value=${live(minW !== undefined && Number.isFinite(minW) ? minW : undefined)}
          placeholder=${msg(str`Auto`)}
          @change=${this.handleMinWidthChanged}
          hide-stepper
          autocomplete="off"
          min="0"
          format-options='{"style":"unit","unit":"px"}'
        ></sp-number-field>
      </div>
      <div class="line">
        <sp-field-label for=${`fi-maxw-${safeId}`} side-aligned="start"
          >${msg(str`Max width`)}</sp-field-label
        >
        <sp-number-field
          id=${`fi-maxw-${safeId}`}
          size="s"
          .value=${live(maxW !== undefined && Number.isFinite(maxW) ? maxW : undefined)}
          placeholder=${msg(str`Auto`)}
          @change=${this.handleMaxWidthChanged}
          hide-stepper
          autocomplete="off"
          min="0"
          format-options='{"style":"unit","unit":"px"}'
        ></sp-number-field>
      </div>
      <div class="line">
        <sp-field-label for=${`fi-minh-${safeId}`} side-aligned="start"
          >${msg(str`Min height`)}</sp-field-label
        >
        <sp-number-field
          id=${`fi-minh-${safeId}`}
          size="s"
          .value=${live(minH !== undefined && Number.isFinite(minH) ? minH : undefined)}
          placeholder=${msg(str`Auto`)}
          @change=${this.handleMinHeightChanged}
          hide-stepper
          autocomplete="off"
          min="0"
          format-options='{"style":"unit","unit":"px"}'
        ></sp-number-field>
      </div>
      <div class="line">
        <sp-field-label for=${`fi-maxh-${safeId}`} side-aligned="start"
          >${msg(str`Max height`)}</sp-field-label
        >
        <sp-number-field
          id=${`fi-maxh-${safeId}`}
          size="s"
          .value=${live(maxH !== undefined && Number.isFinite(maxH) ? maxH : undefined)}
          placeholder=${msg(str`Auto`)}
          @change=${this.handleMaxHeightChanged}
          hide-stepper
          autocomplete="off"
          min="0"
          format-options='{"style":"unit","unit":"px"}'
        ></sp-number-field>
      </div>
    `;
  }

  private flexItemTemplate() {
    const n = this.node as FlexNode & { alignSelf?: string };
    const safeId = this.node.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const alignSelf = n.alignSelf ?? 'auto';
    const flexGrow = n.flexGrow ?? 0;
    const flexShrink = n.flexShrink ?? 1;
    const flexBasis = n.flexBasis;
    const flexBasisStr =
      flexBasis !== undefined && Number.isFinite(flexBasis) ? flexBasis : '';

    return html`<sp-accordion-item
      label=${msg(str`Flex item`)}
      ?open=${this.propertiesPanelSectionsOpenResolved.flexItem}
    >
      <div class="content layout-group style-group">
        <div class="line">
          <sp-field-label side-aligned="start"
            >${msg(str`Align self`)}</sp-field-label
          >
          <sp-picker
            size="s"
            .value=${live(alignSelf)}
            @change=${this.handleAlignSelfChanged}
          >
            <sp-menu-item value="auto">${msg(str`Auto`)}</sp-menu-item>
            <sp-menu-item value="flex-start"
              >${msg(str`Start`)}</sp-menu-item
            >
            <sp-menu-item value="center">${msg(str`Center`)}</sp-menu-item>
            <sp-menu-item value="flex-end">${msg(str`End`)}</sp-menu-item>
            <sp-menu-item value="stretch">${msg(str`Stretch`)}</sp-menu-item>
            <sp-menu-item value="baseline">${msg(str`Baseline`)}</sp-menu-item>
          </sp-picker>
        </div>
        <div class="line">
          <sp-field-label for="flex-grow" side-aligned="start"
            >${msg(str`Grow`)}</sp-field-label
          >
          <sp-number-field
            id="flex-grow"
            size="s"
            .value=${live(flexGrow)}
            @change=${this.handleFlexGrowChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            step="0.01"
            format-options='{"maximumFractionDigits":2}'
          ></sp-number-field>
        </div>
        <div class="line">
          <sp-field-label for="flex-shrink" side-aligned="start"
            >${msg(str`Shrink`)}</sp-field-label
          >
          <sp-number-field
            id="flex-shrink"
            size="s"
            .value=${live(flexShrink)}
            @change=${this.handleFlexShrinkChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            step="0.01"
            format-options='{"maximumFractionDigits":2}'
          ></sp-number-field>
        </div>
        <div class="line">
          <sp-field-label for="flex-basis" side-aligned="start"
            >${msg(str`Basis`)}</sp-field-label
          >
          <sp-number-field
            id="flex-basis"
            size="s"
            .value=${live(flexBasisStr === '' ? undefined : flexBasisStr)}
            placeholder=${msg(str`Auto`)}
            @change=${this.handleFlexBasisChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            format-options='{"style":"unit","unit":"px"}'
          ></sp-number-field>
        </div>
        ${this.flexItemPaddingMarginMinMaxRows(safeId)}
      </div>
    </sp-accordion-item>`;
  }

  private layoutTemplate() {
    const n = this.node as FlexNode;
    const paddingSides = normalizeBoxSides(n.padding);
    const paddingUniform = boxSidesUniform(paddingSides);
    const padTriggerId = `ic-pad-trg-${this.node.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const marginSides = normalizeBoxSides(n.margin);
    const marginUniform = boxSidesUniform(marginSides);
    const marTriggerId = `ic-mar-trg-${this.node.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const gap = n.gap ?? 0;
    const rowGap = n.rowGap ?? 0;
    const columnGap = n.columnGap ?? 0;
    const flexDirection = n.flexDirection ?? 'row';
    const alignItems = n.alignItems ?? 'stretch';
    const justifyContent = n.justifyContent ?? 'flex-start';
    const flexWrap = n.flexWrap ?? 'nowrap';

    return html`<sp-accordion-item
      label=${msg(str`Layout`)}
      ?open=${this.propertiesPanelSectionsOpenResolved.layout}
    >
      <div class="content layout-group style-group">
        <div class="line">
          <sp-field-label for="flex-pad" side-aligned="start"
            >${msg(str`Padding`)}</sp-field-label
          >
          <div class="layout-inset-inline">
            <sp-action-button
              quiet
              size="s"
              id=${padTriggerId}
              label=${msg(str`Padding per side`)}
            >
              <sp-tooltip self-managed placement="bottom">
                ${msg(str`Padding per side`)}
              </sp-tooltip>
              <sp-icon-padding-left slot="icon"></sp-icon-padding-left>
            </sp-action-button>
            <sp-overlay
              trigger=${`${padTriggerId}@click`}
              placement="bottom"
              type="auto"
            >
              <sp-popover class="layout-inset-sides-popover">
                <div class="side-row">
                  <sp-field-label for="pad-t" side-aligned="start"
                    >${msg(str`Top`)}</sp-field-label
                  >
                  <sp-icon-padding-top slot="icon"></sp-icon-padding-top>
                  <sp-number-field
                    id="pad-t"
                    size="s"
                    .value=${live(paddingSides[0])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handlePaddingSideChanged(0, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
                <div class="side-row">
                  <sp-field-label for="pad-r" side-aligned="start"
                    >${msg(str`Right`)}</sp-field-label
                  >
                  <sp-icon-padding-right slot="icon"></sp-icon-padding-right>
                  <sp-number-field
                    id="pad-r"
                    size="s"
                    .value=${live(paddingSides[1])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handlePaddingSideChanged(1, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
                <div class="side-row">
                  <sp-field-label for="pad-b" side-aligned="start"
                    >${msg(str`Bottom`)}</sp-field-label
                  >
                  <sp-icon-padding-bottom slot="icon"></sp-icon-padding-bottom>
                  <sp-number-field
                    id="pad-b"
                    size="s"
                    .value=${live(paddingSides[2])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handlePaddingSideChanged(2, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
                <div class="side-row">
                  <sp-field-label for="pad-l" side-aligned="start"
                    >${msg(str`Left`)}</sp-field-label
                  >
                  <sp-icon-padding-left slot="icon"></sp-icon-padding-left>
                  <sp-number-field
                    id="pad-l"
                    size="s"
                    .value=${live(paddingSides[3])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handlePaddingSideChanged(3, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
              </sp-popover>
            </sp-overlay>
            <sp-number-field
              id="flex-pad"
              size="s"
              .value=${live(paddingUniform ? paddingSides[0] : '')}
              placeholder=${paddingUniform ? '' : '—'}
              ?readonly=${!paddingUniform}
              @change=${this.handleLayoutPaddingChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              format-options='{"style":"unit","unit":"px"}'
            ></sp-number-field>
          </div>
        </div>
        <div class="line">
          <sp-field-label for="flex-margin" side-aligned="start"
            >${msg(str`Margin`)}</sp-field-label
          >
          <div class="layout-inset-inline">
            <sp-action-button
              quiet
              size="s"
              id=${marTriggerId}
              label=${msg(str`Margin per side`)}
            >
              <sp-tooltip self-managed placement="bottom">
                ${msg(str`Margin per side`)}
              </sp-tooltip>
              <sp-icon-margin-left slot="icon"></sp-icon-margin-left>
            </sp-action-button>
            <sp-overlay
              trigger=${`${marTriggerId}@click`}
              placement="bottom"
              type="auto"
            >
              <sp-popover class="layout-inset-sides-popover">
                <div class="side-row">
                  <sp-field-label for="mar-t" side-aligned="start"
                    >${msg(str`Top`)}</sp-field-label
                  >
                  <sp-icon-margin-top slot="icon"></sp-icon-margin-top>
                  <sp-number-field
                    id="mar-t"
                    size="s"
                    .value=${live(marginSides[0])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handleMarginSideChanged(0, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
                <div class="side-row">
                  <sp-field-label for="mar-r" side-aligned="start"
                    >${msg(str`Right`)}</sp-field-label
                  >
                  <sp-icon-margin-right slot="icon"></sp-icon-margin-right>
                  <sp-number-field
                    id="mar-r"
                    size="s"
                    .value=${live(marginSides[1])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handleMarginSideChanged(1, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
                <div class="side-row">
                  <sp-field-label for="mar-b" side-aligned="start"
                    >${msg(str`Bottom`)}</sp-field-label
                  >
                  <sp-icon-margin-bottom slot="icon"></sp-icon-margin-bottom>
                  <sp-number-field
                    id="mar-b"
                    size="s"
                    .value=${live(marginSides[2])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handleMarginSideChanged(2, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
                <div class="side-row">
                  <sp-field-label for="mar-l" side-aligned="start"
                    >${msg(str`Left`)}</sp-field-label
                  >
                  <sp-icon-margin-left slot="icon"></sp-icon-margin-left>
                  <sp-number-field
                    id="mar-l"
                    size="s"
                    .value=${live(marginSides[3])}
                    @change=${(e: Event & { target: HTMLInputElement }) =>
        this.handleMarginSideChanged(3, e)}
                    hide-stepper
                    autocomplete="off"
                    min="0"
                    format-options='{"style":"unit","unit":"px"}'
                  ></sp-number-field>
                </div>
              </sp-popover>
            </sp-overlay>
            <sp-number-field
              id="flex-margin"
              size="s"
              .value=${live(marginUniform ? marginSides[0] : '')}
              placeholder=${marginUniform ? '' : '—'}
              ?readonly=${!marginUniform}
              @change=${this.handleLayoutMarginChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              format-options='{"style":"unit","unit":"px"}'
            ></sp-number-field>
          </div>
        </div>
        <div class="line">
          <sp-field-label for="flex-gap" side-aligned="start"
            >${msg(str`Gap`)}</sp-field-label
          >
          <sp-number-field
            id="flex-gap"
            size="s"
            .value=${live(gap)}
            @change=${this.handleLayoutGapChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            format-options='{"style":"unit","unit":"px"}'
          ></sp-number-field>
        </div>
        <div class="line">
          <sp-field-label for="flex-rowgap" side-aligned="start"
            >${msg(str`Row gap`)}</sp-field-label
          >
          <sp-number-field
            id="flex-rowgap"
            size="s"
            .value=${live(rowGap)}
            @change=${this.handleLayoutRowGapChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            format-options='{"style":"unit","unit":"px"}'
          ></sp-number-field>
        </div>
        <div class="line">
          <sp-field-label for="flex-colgap" side-aligned="start"
            >${msg(str`Column gap`)}</sp-field-label
          >
          <sp-number-field
            id="flex-colgap"
            size="s"
            .value=${live(columnGap)}
            @change=${this.handleLayoutColumnGapChanged}
            hide-stepper
            autocomplete="off"
            min="0"
            format-options='{"style":"unit","unit":"px"}'
          ></sp-number-field>
        </div>
        <div class="line">
          <sp-field-label side-aligned="start"
            >${msg(str`Direction`)}</sp-field-label
          >
          <sp-picker
            size="s"
            .value=${live(flexDirection)}
            @change=${this.handleFlexDirectionChanged}
          >
            <sp-menu-item value="row">${msg(str`Row`)}</sp-menu-item>
            <sp-menu-item value="row-reverse"
              >${msg(str`Row reverse`)}</sp-menu-item
            >
            <sp-menu-item value="column">${msg(str`Column`)}</sp-menu-item>
            <sp-menu-item value="column-reverse"
              >${msg(str`Column reverse`)}</sp-menu-item
            >
          </sp-picker>
        </div>
        <div class="line">
          <sp-field-label side-aligned="start"
            >${msg(str`Align items`)}</sp-field-label
          >
          <sp-picker
            size="s"
            .value=${live(alignItems)}
            @change=${this.handleAlignItemsChanged}
          >
            <sp-menu-item value="flex-start"
              >${msg(str`Start`)}</sp-menu-item
            >
            <sp-menu-item value="center">${msg(str`Center`)}</sp-menu-item>
            <sp-menu-item value="flex-end">${msg(str`End`)}</sp-menu-item>
            <sp-menu-item value="stretch">${msg(str`Stretch`)}</sp-menu-item>
            <sp-menu-item value="baseline">${msg(str`Baseline`)}</sp-menu-item>
          </sp-picker>
        </div>
        <div class="line">
          <sp-field-label side-aligned="start"
            >${msg(str`Justify content`)}</sp-field-label
          >
          <sp-picker
            size="s"
            .value=${live(justifyContent)}
            @change=${this.handleJustifyContentChanged}
          >
            <sp-menu-item value="flex-start"
              >${msg(str`Start`)}</sp-menu-item
            >
            <sp-menu-item value="center">${msg(str`Center`)}</sp-menu-item>
            <sp-menu-item value="flex-end">${msg(str`End`)}</sp-menu-item>
            <sp-menu-item value="space-between"
              >${msg(str`Space between`)}</sp-menu-item
            >
            <sp-menu-item value="space-around"
              >${msg(str`Space around`)}</sp-menu-item
            >
            <sp-menu-item value="space-evenly"
              >${msg(str`Space evenly`)}</sp-menu-item
            >
          </sp-picker>
        </div>
        <div class="line">
          <sp-field-label side-aligned="start"
            >${msg(str`Wrap`)}</sp-field-label
          >
          <sp-picker size="s" .value=${live(flexWrap)} @change=${this.handleFlexWrapChanged}>
            <sp-menu-item value="nowrap">${msg(str`No wrap`)}</sp-menu-item>
            <sp-menu-item value="wrap">${msg(str`Wrap`)}</sp-menu-item>
            <sp-menu-item value="wrap-reverse"
              >${msg(str`Wrap reverse`)}</sp-menu-item
            >
          </sp-picker>
        </div>
      </div>
    </sp-accordion-item>`;
  }

  private transformTemplate() {
    const { width, height, x, y, rotation } = this.node;
    const angle = rotation ? rotation * RAD_TO_DEG : 0;

    return html`<sp-accordion-item
      label=${msg(str`Transform`)}
      ?open=${this.propertiesPanelSectionsOpenResolved.transform}
    >
      <div class="content">
        <div class="line">
          <div>
            <sp-field-label for="w" side-aligned="start">W</sp-field-label>
            <sp-number-field
              id="w"
              size="s"
              .value=${live(width)}
              @change=${this.handleWidthChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
            ></sp-number-field>
            <sp-icon class="lock">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 4.5">
                <defs>
                  <style>
                    .lock {
                      fill: none;
                      stroke: var(--spectrum-gray-500);
                      stroke-miterlimit: 10;
                    }
                  </style>
                </defs>
                <line class="lock" y1="0.5" x2="16.5" y2="0.5"></line>
                <line class="lock" x1="16.5" x2="16.5" y2="4.5"></line>
              </svg>
            </sp-icon>
          </div>

          <div>
            <sp-field-label for="x" side-aligned="end">X</sp-field-label>
            <sp-number-field
              id="x"
              size="s"
              .value=${live(x)}
              @change=${this.handleXChanged}
              hide-stepper
              autocomplete="off"
              format-options='{
                    "style": "unit",
                    "unit": "px"
                  }'
            ></sp-number-field>
          </div>
        </div>

        <div class="line">
          <div>
            <sp-field-label for="h" side-aligned="start">H</sp-field-label>
            <sp-number-field
              id="h"
              size="s"
              .value=${live(height)}
              @change=${this.handleHeightChanged}
              hide-stepper
              autocomplete="off"
              min="0"
              format-options='{
                    "style": "unit",
                    "unit": "px"
                  }'
            ></sp-number-field>
            <sp-icon class="lock">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19 7">
                <defs>
                  <style>
                    .lock {
                      fill: none;
                      stroke: var(--spectrum-gray-500);
                      stroke-miterlimit: 10;
                    }
                  </style>
                </defs>
                <line class="lock" y1="4.5" x2="17" y2="4.5"></line>
                <line class="lock" x1="16.5" x2="16.5" y2="4.5"></line>
              </svg>
            </sp-icon>
          </div>

          <div>
            <sp-field-label for="y" side-aligned="end">Y</sp-field-label>
            <sp-number-field
              id="y"
              size="s"
              .value=${live(y)}
              @change=${this.handleYChanged}
              hide-stepper
              autocomplete="off"
              format-options='{
                    "style": "unit",
                    "unit": "px"
                  }'
            ></sp-number-field>
          </div>
        </div>

        <sp-action-button
          quiet
          size="s"
          class="lock-button"
          @click=${this.handleLockAspectRatioChanged}
        >
          <sp-tooltip self-managed placement="bottom">
            ${when(
      this.lockAspectRatio,
      () => msg(str`Constrain aspect ratio`),
      () => msg(str`Do not constrain aspect ratio`),
    )}
          </sp-tooltip>
          ${when(
      this.lockAspectRatio,
      () => html`<sp-icon-lock-closed slot="icon"></sp-icon-lock-closed>`,
      () => html`<sp-icon-lock-open slot="icon"></sp-icon-lock-open>`,
    )}
        </sp-action-button>

        <div class="line">
          <div>
            <sp-field-label
              for="angle"
              side-aligned="start"
              format-options='{
                  "style": "unit",
                  "unit": "px"
                }'
              >Angle</sp-field-label
            >
            <sp-number-field
              id="angle"
              size="s"
              .value=${live(angle)}
              @change=${this.handleAngleChanged}
              hide-stepper
              autocomplete="off"
              format-options='{
                  "style": "unit",
                  "unit": "deg"
                }'
            ></sp-number-field>
          </div>
        </div>
      </div>
    </sp-accordion-item>`;
  }

  private iconFontTemplate() {
    const n = this.node as IconFontSerializedNode;
    return html`<sp-accordion-item
      label=${msg(str`Icon font`)}
      ?open=${this.propertiesPanelSectionsOpenResolved.iconFont}
    >
      <ic-spectrum-icon-font-controls
        .iconFontFamily=${n.iconFontFamily}
        .iconFontName=${n.iconFontName}
        .instanceId=${this.node.id}
        @ic-iconfont-controls-change=${this.handleIconFontControlsPatch}
      ></ic-spectrum-icon-font-controls>
    </sp-accordion-item>`;
  }

  render() {
    if (!this.node) {
      return;
    }

    const { type } = this.node;
    const isGroup = type === 'g';
    const isText = type === 'text';
    const isRect = type === 'rect';
    const isIconFont = type === 'iconfont' || (type as string) === 'icon_font';

    migrateLegacyFillWireInPlace(this.node as unknown as Record<string, unknown>);
    migrateLegacyStrokeWireInPlace(this.node as unknown as Record<string, unknown>);

    let cornerRadiusShow = 0;
    let cornerRadiusBound = false;
    let cornerRadiusRaw: number | string | undefined;
    if (isRect) {
      cornerRadiusRaw = (this.node as RectSerializedNode).cornerRadius;
      const crResolved = resolveDesignVariableValue(
        cornerRadiusRaw,
        this.appState.variables,
        this.appState.themeMode,
      );
      cornerRadiusShow = (() => {
        if (typeof crResolved === 'number') {
          return crResolved;
        }
        const n = parseFloat(String(crResolved ?? ''));
        return Number.isFinite(n) ? n : 0;
      })();
      cornerRadiusBound =
        typeof cornerRadiusRaw === 'string' &&
        isDesignVariableReference(cornerRadiusRaw);
    }

    // const { fontSize } = this.node as TextSerializedNode;

    return html`
      <sp-accordion allow-multiple size="s">
        ${!isGroup
        ? html`
              <sp-accordion-item
                label=${msg(str`Fill`)}
                ?open=${this.propertiesPanelSectionsOpenResolved.fillSection}
              >
                <div class="content style-group">
                  <ic-spectrum-layer-blend-mode-row
                    .node=${this.node}
                  ></ic-spectrum-layer-blend-mode-row>
                  <ic-spectrum-fill-section
                    .node=${this.node}
                  ></ic-spectrum-fill-section>
                </div>
              </sp-accordion-item>
              ${when(
          !isText,
          () => html`
              <sp-accordion-item
                label=${msg(str`Stroke`)}
                ?open=${this.propertiesPanelSectionsOpenResolved.strokeSection}
              >
                <div class="content style-group">
                  <ic-spectrum-stroke-section
                    .node=${this.node}
                  ></ic-spectrum-stroke-section>
                  <ic-spectrum-stroke-content
                    .node=${this.node}
                  ></ic-spectrum-stroke-content>
                </div>
              </sp-accordion-item>
            `,
        )}
              ${when(
          isText,
          () => html`
              <sp-accordion-item
                label=${msg(str`Typography`)}
                ?open=${this.propertiesPanelSectionsOpenResolved.typographySection}
              >
                <div class="content style-group">
                  <ic-spectrum-text-content
                    .node=${this.node}
                  ></ic-spectrum-text-content>
                </div>
              </sp-accordion-item>
            `,
        )}
              ${when(
          isRect,
          () => html`
              <sp-accordion-item
                label=${msg(str`Shape`)}
                ?open=${this.propertiesPanelSectionsOpenResolved.shape}
              >
                <div class="content style-group">
                  <div class="line">
                    <sp-field-label
                      for="corner-radius"
                      side-aligned="start"
                      >${msg(str`Corner radius`)}</sp-field-label
                    >
                    <div class="fill-opacity-controls">
                      <sp-action-button
                        quiet
                        size="s"
                        id="props-corner-radius-dv-trigger"
                      >
                        <sp-icon-link slot="icon"></sp-icon-link>
                        <sp-tooltip self-managed placement="bottom">
                          ${msg(str`Attach a variable`)}
                        </sp-tooltip>
                      </sp-action-button>
                      <sp-number-field
                        id="corner-radius"
                        size="s"
                        .value=${live(cornerRadiusShow)}
                        min="0"
                        step="1"
                        hide-stepper
                        autocomplete="off"
                        @change=${this.handleCornerRadiusChanged}
                        format-options='{
                              "style": "unit",
                              "unit": "px"
                            }'
                      ></sp-number-field>
                      <sp-overlay
                        trigger="props-corner-radius-dv-trigger@click"
                        placement="bottom"
                        type="auto"
                      >
                        <sp-popover dialog>
                          <div class="dv-popover-body">
                            ${when(
            cornerRadiusBound,
            () =>
              html`<div class="dv-row">
                                  <span
                                    class="dv-badge"
                                    title=${String(cornerRadiusRaw)}
                                    >${String(cornerRadiusRaw)}</span
                                  >
                                  <sp-action-button
                                    quiet
                                    size="s"
                                    @click=${this
                .handleCornerRadiusVariableUnbind}
                                  >
                                    <sp-icon-unlink
                                      slot="icon"
                                    ></sp-icon-unlink>
                                    <sp-tooltip
                                      self-managed
                                      placement="right"
                                    >
                                      ${msg(str`Detach variable`)}
                                    </sp-tooltip>
                                  </sp-action-button>
                                </div>`,
          )}
                            <ic-spectrum-design-variable-picker
                              match-type="number"
                              selected-key=${designVariableRefKeyFromWire(
            cornerRadiusRaw,
          )}
                              @ic-variable-pick=${this
              .handleCornerRadiusVariablePick}
                            ></ic-spectrum-design-variable-picker>
                          </div>
                        </sp-popover>
                      </sp-overlay>
                    </div>
                  </div>
                </div>
              </sp-accordion-item>
            `,
        )}
            `
        : ''}
        ${this.transformTemplate()}
        ${when(isIconFont, () => this.iconFontTemplate())}
        ${when(
          this.node.display === 'flex',
          () => this.layoutTemplate(),
        )}
        ${when(this.isFlexChild(), () => this.flexItemTemplate())}
        <sp-accordion-item
          label=${msg(str`Effects`)}
          ?open=${this.propertiesPanelSectionsOpenResolved.effects}
        >
          <div class="content">
            <ic-spectrum-effects-panel .node=${this.node}></ic-spectrum-effects-panel>
          </div>
        </sp-accordion-item>
        <sp-accordion-item
          label=${msg(str`Export`)}
          ?open=${this.propertiesPanelSectionsOpenResolved.exportSection}
        >
          <div class="content">
            <ic-spectrum-export-panel></ic-spectrum-export-panel>
          </div>
        </sp-accordion-item>
      </sp-accordion>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-properties-panel-content': PropertiesPanelContent;
  }
}
