import { html, css, LitElement, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { consume } from '@lit/context';
import {
  SerializedNode,
  AppState,
  FillAttributes,
  designVariableRefKeyFromWire,
  isDesignVariableReference,
  resolveDesignVariableValue,
  type FlexboxLayoutAttributes,
  type IconFontSerializedNode,
  type RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { when } from 'lit/directives/when.js';
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

type FlexNode = SerializedNode & Partial<FlexboxLayoutAttributes>;

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

      --system-accordion-size-s-item-header-font-size: 14px;
      --mod-accordion-item-header-font-size: 14px;
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

  @state()
  lockAspectRatio: boolean = true;

  private get propertiesPanelSectionsOpenResolved(): {
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

  private handleFillOpacityChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNode(this.node, {
      fillOpacity: parseFloat(e.target.value),
    });
    this.api.record();
  }

  private handleFillOpacityVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      fillOpacity: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleFillOpacityVariableUnbind() {
    const raw = (this.node as FillAttributes).fillOpacity;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.api.updateNode(this.node, {
        fillOpacity: Math.max(0, Math.min(1, n)),
      });
      this.api.record();
    }
  }

  private handleCornerRadiusChanged(e: Event & { target: HTMLInputElement }) {
    const v = parseFloat(e.target.value);
    if (!Number.isFinite(v)) {
      return;
    }
    this.api.updateNode(this.node, {
      cornerRadius: Math.max(0, v),
    });
    this.api.record();
  }

  private handleCornerRadiusVariablePick(
    e: CustomEvent<DesignVariablePickDetail>,
  ) {
    this.api.updateNode(this.node, {
      cornerRadius: `$${e.detail.key}` as unknown as number,
    });
    this.api.record();
  }

  private handleCornerRadiusVariableUnbind() {
    const raw = (this.node as RectSerializedNode).cornerRadius;
    const resolved = resolveDesignVariableValue(
      raw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const n =
      typeof resolved === 'number'
        ? resolved
        : parseFloat(String(resolved ?? ''));
    if (Number.isFinite(n)) {
      this.api.updateNode(this.node, {
        cornerRadius: Math.max(0, n),
      });
      this.api.record();
    }
  }

  private handleWidthChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        width: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleHeightChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        height: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleXChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        x: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleYChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNodeOBB(
      this.node,
      {
        y: parseInt(e.target.value),
      },
      this.lockAspectRatio,
    );
    this.api.record();
  }

  private handleAngleChanged(e: Event & { target: HTMLInputElement }) {
    this.api.updateNode(this.node, {
      rotation: parseFloat(e.target.value) * DEG_TO_RAD,
    });
    this.api.record();
  }

  private handleLockAspectRatioChanged() {
    this.lockAspectRatio = !this.lockAspectRatio;
  }

  private handleIconFontControlsPatch(
    e: CustomEvent<IconFontControlsPatch>,
  ) {
    if (
      this.node.type !== 'iconfont' &&
      (this.node.type as string) !== 'icon_font'
    ) {
      return;
    }
    this.api.updateNode(this.node, e.detail as Partial<IconFontSerializedNode>);
    this.api.record();
    this.requestUpdate();
  }

  private handleLayoutPaddingChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, {
      padding: v,
    } as Partial<SerializedNode>);
    this.api.record();
  }

  private handlePaddingSideChanged(
    index: 0 | 1 | 2 | 3,
    e: Event,
  ) {
    const raw = PropertiesPanelContent.parseNumberFieldValue(e);
    const next = raw !== undefined && Number.isFinite(raw) ? raw : 0;
    const sides = normalizeBoxSides(
      (this.node as FlexNode).padding,
    ) as [number, number, number, number];
    sides[index] = next;
    this.api.updateNode(this.node, {
      padding: sidesToBoxValue(sides),
    } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleLayoutMarginChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, {
      margin: v,
    } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleMarginSideChanged(
    index: 0 | 1 | 2 | 3,
    e: Event,
  ) {
    const raw = PropertiesPanelContent.parseNumberFieldValue(e);
    const next = raw !== undefined && Number.isFinite(raw) ? raw : 0;
    const sides = normalizeBoxSides(
      (this.node as FlexNode).margin,
    ) as [number, number, number, number];
    sides[index] = next;
    this.api.updateNode(this.node, {
      margin: sidesToBoxValue(sides),
    } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleLayoutGapChanged(e: Event & { target: HTMLInputElement }) {
    const v = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      gap: Number.isFinite(v) ? v : undefined,
    });
    this.api.record();
  }

  private handleLayoutRowGapChanged(e: Event & { target: HTMLInputElement }) {
    const v = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      rowGap: Number.isFinite(v) ? v : undefined,
    });
    this.api.record();
  }

  private handleLayoutColumnGapChanged(e: Event & { target: HTMLInputElement }) {
    const v = parseFloat(e.target.value);
    this.api.updateNode(this.node, {
      columnGap: Number.isFinite(v) ? v : undefined,
    });
    this.api.record();
  }

  private handleFlexDirectionChanged(e: Event & { target: HTMLInputElement }) {
    const v = e.target.value as FlexboxLayoutAttributes['flexDirection'];
    this.api.updateNode(this.node, { flexDirection: v });
    this.api.record();
  }

  private handleAlignItemsChanged(e: Event & { target: HTMLInputElement }) {
    const v = e.target.value as FlexboxLayoutAttributes['alignItems'];
    this.api.updateNode(this.node, { alignItems: v });
    this.api.record();
  }

  private handleJustifyContentChanged(e: Event & { target: HTMLInputElement }) {
    const v = e.target.value as FlexboxLayoutAttributes['justifyContent'];
    this.api.updateNode(this.node, { justifyContent: v });
    this.api.record();
  }

  private handleFlexWrapChanged(e: Event & { target: HTMLInputElement }) {
    const v = e.target.value as FlexboxLayoutAttributes['flexWrap'];
    this.api.updateNode(this.node, { flexWrap: v });
    this.api.record();
  }

  private handleAlignSelfChanged(e: Event & { target: HTMLInputElement }) {
    const v = e.target.value;
    if (v === 'auto') {
      this.api.updateNode(this.node, {
        alignSelf: undefined,
      } as Partial<SerializedNode>);
    } else {
      this.api.updateNode(this.node, {
        alignSelf: v as
          | 'center'
          | 'flex-start'
          | 'flex-end'
          | 'stretch'
          | 'baseline',
      } as Partial<SerializedNode>);
    }
    this.api.record();
  }

  /** sp-number-field 的 value 可能在自定义元素上，且为 number */
  private static parseNumberFieldValue(e: Event): number | undefined {
    const t = e.target as HTMLElement & { value?: number | string };
    if (t.value === undefined || t.value === '') {
      return undefined;
    }
    const n =
      typeof t.value === 'number' ? t.value : parseFloat(String(t.value));
    return Number.isFinite(n) ? n : undefined;
  }

  private handleFlexGrowChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, {
      flexGrow: v,
    } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleFlexShrinkChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, {
      flexShrink: v,
    } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleFlexBasisChanged(e: Event) {
    const t = e.target as HTMLElement & { value?: number | string };
    const raw =
      t.value === undefined || t.value === ''
        ? ''
        : String(t.value).trim();
    if (raw === '') {
      this.api.updateNode(this.node, { flexBasis: undefined } as Partial<SerializedNode>);
    } else {
      const v = parseFloat(raw);
      this.api.updateNode(this.node, {
        flexBasis: Number.isFinite(v) ? v : undefined,
      } as Partial<SerializedNode>);
    }
    this.api.record();
  }

  private handleMinWidthChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, { minWidth: v } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleMaxWidthChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, { maxWidth: v } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleMinHeightChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, { minHeight: v } as Partial<SerializedNode>);
    this.api.record();
  }

  private handleMaxHeightChanged(e: Event) {
    const v = PropertiesPanelContent.parseNumberFieldValue(e);
    this.api.updateNode(this.node, { maxHeight: v } as Partial<SerializedNode>);
    this.api.record();
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
                    .value=${paddingSides[i]}
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
            .value=${paddingUniform ? paddingSides[0] : ''}
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
                    .value=${marginSides[i]}
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
            .value=${marginUniform ? marginSides[0] : ''}
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
          .value=${minW !== undefined && Number.isFinite(minW) ? minW : undefined}
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
          .value=${maxW !== undefined && Number.isFinite(maxW) ? maxW : undefined}
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
          .value=${minH !== undefined && Number.isFinite(minH) ? minH : undefined}
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
          .value=${maxH !== undefined && Number.isFinite(maxH) ? maxH : undefined}
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
            .value=${alignSelf}
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
            .value=${flexGrow}
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
            .value=${flexShrink}
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
            .value=${flexBasisStr === '' ? undefined : flexBasisStr}
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
                    value=${paddingSides[0]}
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
                    value=${paddingSides[1]}
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
                    value=${paddingSides[2]}
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
                    value=${paddingSides[3]}
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
              value=${paddingUniform ? paddingSides[0] : ''}
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
                    value=${marginSides[0]}
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
                    value=${marginSides[1]}
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
                    value=${marginSides[2]}
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
                    value=${marginSides[3]}
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
              value=${marginUniform ? marginSides[0] : ''}
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
            value=${gap}
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
            value=${rowGap}
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
            value=${columnGap}
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
            .value=${flexDirection}
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
            .value=${alignItems}
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
            .value=${justifyContent}
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
          <sp-picker size="s" .value=${flexWrap} @change=${this.handleFlexWrapChanged}>
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
              value=${width}
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
              value=${x}
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
              value=${height}
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
              value=${y}
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
              value=${angle}
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

    const fillOpRaw = (this.node as FillAttributes).fillOpacity ?? 1;
    const fillOpacityResolved = resolveDesignVariableValue(
      fillOpRaw,
      this.appState.variables,
      this.appState.themeMode,
    );
    const fillOpacityShow = (() => {
      if (typeof fillOpacityResolved === 'number') {
        return fillOpacityResolved;
      }
      const n = parseFloat(String(fillOpacityResolved ?? ''));
      return Number.isFinite(n) ? n : 1;
    })();
    const fillOpacityBound =
      typeof fillOpRaw === 'string' && isDesignVariableReference(fillOpRaw);

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
                label=${'Shape ' + this.node.type}
                ?open=${this.propertiesPanelSectionsOpenResolved.shape}
              >
                <div class="content style-group">
                  <div class="line">
                    <sp-field-label for="style" side-aligned="start"
                      >${msg(str`Style`)}</sp-field-label
                    >
                    <div>
                      <ic-spectrum-fill-action-button
                        .node=${this.node}
                      ></ic-spectrum-fill-action-button>
                      ${when(
          !isText,
          () => html` <ic-spectrum-stroke-action-button
                          .node=${this.node}
                        ></ic-spectrum-stroke-action-button>`,
        )}
                    </div>
                  </div>

                  <div class="line">
                    <sp-field-label for="fill-opacity" side-aligned="start"
                      >${msg(str`Fill opacity`)}</sp-field-label
                    >
                    <div class="fill-opacity-controls">
                      <sp-action-button
                        quiet
                        size="s"
                        id="props-fill-opacity-dv-trigger"
                      >
                        <sp-icon-link slot="icon"></sp-icon-link>
                        <sp-tooltip self-managed placement="bottom">
                          ${msg(str`Attach a variable`)}
                        </sp-tooltip>
                      </sp-action-button>
                      <sp-number-field
                        id="fill-opacity"
                        size="s"
                        value=${fillOpacityShow}
                        min="0"
                        max="1"
                        step="0.01"
                        hide-stepper
                        autocomplete="off"
                        @change=${this.handleFillOpacityChanged}
                      ></sp-number-field>
                      <sp-overlay
                        trigger="props-fill-opacity-dv-trigger@click"
                        placement="bottom"
                        type="auto"
                      >
                        <sp-popover dialog>
                          <div class="dv-popover-body">
                            ${when(
          fillOpacityBound,
          () =>
            html`<div class="dv-row">
                                  <span
                                    class="dv-badge"
                                    title=${String(fillOpRaw)}
                                    >${String(fillOpRaw)}</span
                                  >
                                  <sp-action-button
                                    quiet
                                    size="s"
                                    @click=${this.handleFillOpacityVariableUnbind}
                                  >
                                    <sp-icon-unlink slot="icon"></sp-icon-unlink>
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
          fillOpRaw,
        )}
                              @ic-variable-pick=${this
            .handleFillOpacityVariablePick}
                            ></ic-spectrum-design-variable-picker>
                          </div>
                        </sp-popover>
                      </sp-overlay>
                    </div>
                  </div>

                  ${when(
              isRect,
              () => html`
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
                            value=${cornerRadiusShow}
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
                    `,
            )}

                  ${when(
              !isText,
              () => html`<ic-spectrum-stroke-content
                      .node=${this.node}
                    ></ic-spectrum-stroke-content>`,
              () => html`<ic-spectrum-text-content
                      .node=${this.node}
                    ></ic-spectrum-text-content>`,
            )}
                </div>
              </sp-accordion-item>
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
