import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { map } from 'lit/directives/map.js';
import { repeat } from 'lit/directives/repeat.js';
import type { OverlayOpenCloseDetail } from '@spectrum-web-components/overlay';
import '@spectrum-web-components/overlay/sp-overlay.js';
import {
  type Gradient,
  type MeshGradient,
  DEFAULT_MESH_GRADIENT_CORNER_POSITIONS,
  formatMeshGradientStringSuffix,
  isMeshGradientGradient,
  parseGradient,
} from '@infinite-canvas-tutorial/ecs';
import { ColorType } from './color-picker';

@customElement('ic-spectrum-input-gradient')
export class InputGradient extends LitElement {
  static styles = css`
    .gradient-actions {
      display: flex;
      align-items: center;
      justify-content: end;
      gap: 8px;
    }
    .gradient-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow-y: auto;
      overflow-x: hidden;
      height: 114px;
    }

    .gradient-item {
      display: flex;
      align-items: center;
      justify-content: space-between;

      > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      sp-picker {
        width: 100px;
      }
    }

    sp-popover {
      padding: 0;
    }

    sp-swatch {
      transform: rotate(90deg);
    }

    .gradient-settings-popover {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;

      h4 {
        margin: 0;
      }

      .angle-field {
        display: flex;
        align-items: center;
      }

      sp-number-field {
        width: 100px;
      }
    }

    .gradient-stops-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .gradient-stops {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: auto;
    }

    .gradient-stop {
      display: flex;
      align-items: center;
      justify-content: space-between;

      > div {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .mesh-gradient-panel {
      --mesh-warp-label-w: 72px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* 与 mesh-warp-grid 第一列同宽，避免「Background」与上面弯折区不对齐 */
    .mesh-bg-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Gradient / Warp / Warp size / Warp mix：两列「标签 | 控件」对齐 */
    .mesh-warp-grid {
      display: grid;
      grid-template-columns:
        var(--mesh-warp-label-w) minmax(0, 1fr)
        var(--mesh-warp-label-w) minmax(0, 1fr);
      column-gap: 8px;
      row-gap: 4px;
      align-items: end;
    }

    .mesh-warp-grid sp-field-label {
      min-width: 0;
      justify-self: start;
    }

    .mesh-warp-grid sp-picker,
    .mesh-warp-grid sp-number-field {
      min-width: 0;
      width: 80px;
    }

    .mesh-grad-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
    }

    .mesh-grad-row sp-picker,
    .mesh-grad-row sp-number-field {
      min-width: 0;
    }

    .mesh-grad-label {
      font-size: 12px;
    }

    .mesh-corners-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mesh-corner-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      width: 100%;
    }

    .mesh-corner-row .mesh-corner-remove {
      margin-left: auto;
      flex-shrink: 0;
    }

    .mesh-corner-row sp-number-field {
      width: 100px;
    }
  `;

  @property()
  value: string;

  @property()
  opacity: number;

  @state()
  gradients: Gradient[] = [];

  @state()
  private gradientSettingsOpenIndex: number | null = null;

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('value')) {
      this.gradients = parseGradient(this.value) || [];
      this.ensureAllMeshPointsNum();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.value) {
      this.gradients = parseGradient(this.value) || [];
      this.ensureAllMeshPointsNum();
    }
  }

  private triggerGradientChangeEvent() {
    const event = new CustomEvent('color-change', {
      detail: {
        type: 'gradient',
        value: convertGradientsToCSSValue(this.gradients),
        opacity: this.opacity,
      },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(event);
  }

  private addGradient() {
    this.gradients = [
      ...this.gradients,
      {
        type: 'linear-gradient',
        angle: 0,
        steps: [
          {
            offset: {
              type: '%',
              value: 0,
            },
            color: '#fff',
          },
          {
            offset: {
              type: '%',
              value: 100,
            },
            color: '#000',
          },
        ],
      },
    ];

    this.triggerGradientChangeEvent();
  }

  private removeGradient(index: number) {
    if (this.gradientSettingsOpenIndex === index) {
      this.gradientSettingsOpenIndex = null;
    } else if (
      this.gradientSettingsOpenIndex != null &&
      this.gradientSettingsOpenIndex > index
    ) {
      this.gradientSettingsOpenIndex -= 1;
    }
    this.gradients = this.gradients.filter((_, i) => i !== index);

    this.triggerGradientChangeEvent();
  }

  private addStop(index: number) {
    const g = this.gradients[index];
    if (g.type === 'mesh-gradient') {
      return;
    }
    g.steps.push({
      offset: {
        type: '%',
        value: 0,
      },
      color: 'white',
    });

    this.triggerGradientChangeEvent();
  }

  private removeStop(index: number, stopIndex: number) {
    const g = this.gradients[index];
    if (g.type === 'mesh-gradient') {
      return;
    }
    g.steps = g.steps.filter((_, i) => i !== stopIndex);

    this.triggerGradientChangeEvent();
  }

  private handleOpacityChange(e: CustomEvent) {
    const opacity = (e.target as any).value;
    this.opacity = opacity;
    this.triggerGradientChangeEvent();
  }

  private handleAngleChange(index: number, e: CustomEvent) {
    const angle = (e.target as any).value;
    if (this.gradients[index].type === 'linear-gradient') {
      (this.gradients[index] as any).angle = angle;

      this.triggerGradientChangeEvent();
    }
  }

  private handleGradientTypeChange(index: number, e: CustomEvent) {
    const type = (e.target as any).value;
    const prev = this.gradients[index];
    if (type === 'mesh-gradient') {
      this.gradients[index] = createDefaultMeshGradient();
    } else if (isMeshGradientGradient(prev)) {
      const steps = [
        {
          offset: { type: '%' as const, value: 0 },
          color: prev.backgroundColor,
        },
        {
          offset: { type: '%' as const, value: 100 },
          color: prev.colors[4] || '#000000',
        },
      ];
      const center = { value: 50, type: '%' as const };
      if (type === 'linear-gradient') {
        this.gradients[index] = { type: 'linear-gradient', angle: 0, steps };
      } else if (type === 'radial-gradient') {
        this.gradients[index] = {
          type: 'radial-gradient',
          cx: center,
          cy: center,
          steps,
        };
      } else if (type === 'conic-gradient') {
        this.gradients[index] = {
          type: 'conic-gradient',
          angle: 0,
          cx: center,
          cy: center,
          steps,
        };
      } else {
        this.gradients[index] = { type: 'linear-gradient', angle: 0, steps };
      }
    } else {
      (prev as { type: string }).type = type;
    }
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private handleColorChange(index: number, stopIndex: number, e: CustomEvent) {
    e.stopPropagation();
    const color = (e.detail as any).value;
    const g = this.gradients[index];
    if (g.type === 'mesh-gradient') {
      return;
    }
    g.steps[stopIndex].color = color;
    this.triggerGradientChangeEvent();
  }

  private handleMeshBackgroundChange(index: number, e: CustomEvent) {
    e.stopPropagation();
    const g = this.gradients[index];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    g.backgroundColor = (e.detail as { value: string }).value;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private handleMeshCornerChange(
    index: number,
    cornerIndex: number,
    e: CustomEvent,
  ) {
    e.stopPropagation();
    const g = this.gradients[index];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    g.colors[cornerIndex] = (e.detail as { value: string }).value;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private meshWithDefaults(g: MeshGradient) {
    return {
      gradientTypeIndex: g.gradientTypeIndex ?? 2,
      warpShapeIndex: g.warpShapeIndex ?? 0,
      warpSize: g.warpSize ?? 0.5,
      warpRatio: g.warpRatio ?? 0,
      time: g.time ?? 0,
    };
  }

  /**
   * 与 `MeshGradientPass` / 站点一致：10 个 UBO 点，缺省为网格 UV。
   * 用显式 U/V 校验，避免 `if (pos[i])` 把非法结构或 0/NaN 误当「无坐标」,
   * 也避免和默认 UV 与首角「巧合」混淆。
   */
  private isMeshPositionTuple(
    p: [number, number] | null | undefined,
  ): p is [number, number] {
    return (
      p != null &&
      Array.isArray(p) &&
      p.length >= 2 &&
      Number.isFinite(p[0] as number) &&
      Number.isFinite(p[1] as number)
    );
  }

  private ensureMeshPositions(g: MeshGradient): [number, number][] {
    const d = DEFAULT_MESH_GRADIENT_CORNER_POSITIONS;
    const out: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const p = g.positions?.[i];
      if (this.isMeshPositionTuple(p)) {
        out.push([p[0]!, p[1]!]);
      } else {
        out.push([d[i]![0]!, d[i]![1]!]);
      }
    }
    return out;
  }

  private handleMeshMetaPicker(
    index: number,
    key: 'gradientTypeIndex' | 'warpShapeIndex',
    e: Event,
  ) {
    const v = Number(
      (e.currentTarget as HTMLInputElement & { value: string }).value,
    );
    const g = this.gradients[index];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    (g as MeshGradient)[key] = v;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private handleMeshNumberField(
    index: number,
    key: 'warpSize' | 'warpRatio' | 'time',
    e: Event,
  ) {
    const raw = (e.currentTarget as unknown as { value: number }).value;
    const g = this.gradients[index];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    (g as MeshGradient)[key] = raw;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private handleMeshPositionChange(
    index: number,
    cornerIndex: number,
    axis: 0 | 1,
    e: Event,
  ) {
    const g = this.gradients[index];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    const mg = g as MeshGradient;
    const n = (e.currentTarget as unknown as { value: number }).value;
    const pos = this.ensureMeshPositions(mg);
    const p = pos[cornerIndex]!;
    pos[cornerIndex] = axis === 0 ? [n, p[1]!] : [p[0]!, n];
    mg.positions = pos;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  /** 与 parse 填充规则一致：不足角点用 `backgroundColor` 填满 9 项，故不能单看 `colors.length===9` */
  private meshColorEquals(a: string, b: string): boolean {
    return a.replace(/\s/g, '').toLowerCase() === b.replace(/\s/g, '').toLowerCase();
  }

  /**
   * 不读 `pointsNum`：在「缺解析字段/旧包」时与 `parseGradient` 推断规则一致
   *（不足 9 项为有效角点数，满 9 时按与 background 首遇同色截断）。
   */
  private inferMeshLogicalPointCount(mg: MeshGradient): number {
    if (mg.colors.length < 9) {
      return Math.max(1, mg.colors.length);
    }
    const bg = mg.backgroundColor;
    for (let i = 0; i < 9; i++) {
      const c = mg.colors[i];
      if (c == null) {
        return Math.max(1, i);
      }
      if (this.meshColorEquals(c, bg)) {
        return Math.max(1, i);
      }
    }
    return 9;
  }

  /**
   * 与 `parseGradient` 的「显式角点个数」一致；若缺 `pointsNum`（如旧包），用 `inferMeshLogicalPointCount`。
   */
  private meshCornerCount(mg: MeshGradient): number {
    if (mg.pointsNum != null) {
      return Math.min(9, Math.max(1, mg.pointsNum));
    }
    return this.inferMeshLogicalPointCount(mg);
  }

  /**
   * 首屏从 `value` 解析后若未带 `pointsNum`，与当前角点色/填充规则对齐写入，
   * 使 `formatMeshGradientStringSuffix`、增删角点与 mesh 行数一致。
   */
  private ensureAllMeshPointsNum() {
    let changed = false;
    for (const g of this.gradients) {
      if (!isMeshGradientGradient(g)) {
        continue;
      }
      const mg = g as MeshGradient;
      if (mg.pointsNum != null) {
        continue;
      }
      mg.pointsNum = this.inferMeshLogicalPointCount(mg);
      changed = true;
    }
    if (changed) {
      this.gradients = [...this.gradients];
    }
  }

  private addMeshCorner(gradientIndex: number) {
    const g = this.gradients[gradientIndex];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    const mg = g as MeshGradient;
    const c = this.meshCornerCount(mg);
    if (c >= 9) {
      return;
    }
    const d = DEFAULT_MESH_GRADIENT_CORNER_POSITIONS;
    const newColor = '#60a5fa';
    if (mg.colors.length > c) {
      mg.colors[c] = newColor;
    } else {
      mg.colors.push(newColor);
    }
    const pos = this.ensureMeshPositions(mg);
    pos[c] = [d[c]![0]!, d[c]![1]!];
    mg.positions = pos;
    mg.pointsNum = c + 1;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private removeMeshCorner(gradientIndex: number, cornerIndex: number) {
    const g = this.gradients[gradientIndex];
    if (!isMeshGradientGradient(g)) {
      return;
    }
    const mg = g as MeshGradient;
    const n = this.meshCornerCount(mg);
    if (n <= 1) {
      return;
    }
    if (cornerIndex < 0 || cornerIndex >= n) {
      return;
    }
    mg.colors.splice(cornerIndex, 1);
    const pos = this.ensureMeshPositions(mg);
    pos.splice(cornerIndex, 1);
    const d2 = DEFAULT_MESH_GRADIENT_CORNER_POSITIONS;
    for (let k = pos.length; k < 10; k++) {
      pos.push([d2[k]![0]!, d2[k]![1]!]);
    }
    mg.positions = pos;
    mg.pointsNum = n - 1;
    this.gradients = [...this.gradients];
    this.triggerGradientChangeEvent();
  }

  private handleOffsetChange(index: number, stopIndex: number, e: CustomEvent) {
    const g = this.gradients[index];
    if (g.type === 'mesh-gradient') {
      return;
    }
    const offset = (e.target as any).value * 100;
    g.steps[stopIndex].offset.value = offset;

    this.triggerGradientChangeEvent();
  }

  render() {
    return html`
      <sp-action-button quiet size="s" @click="${this.addGradient}">
        <sp-tooltip self-managed placement="bottom"> Add gradient </sp-tooltip>
        <sp-icon-add slot="icon"></sp-icon-add>
      </sp-action-button>
      <div class="gradient-list">
        ${map(this.gradients, (gradient, index) => {
      const renderMeshSettings = (mg: MeshGradient) => {
        const o = this.meshWithDefaults(mg);
        const uv = this.ensureMeshPositions(mg);
        return html`
            <div class="mesh-gradient-panel">
              <div class="mesh-warp-grid">
                <sp-field-label
                  for=${`mesh-gt-${index}`}
                  side-aligned="start"
                  >Gradient</sp-field-label
                >
                <sp-picker
                  id=${`mesh-gt-${index}`}
                  label="Gradient"
                  value=${String(o.gradientTypeIndex)}
                  size="s"
                  @change=${this.handleMeshMetaPicker.bind(
          this,
          index,
          'gradientTypeIndex',
        )}
                >
                  <sp-menu-item value="0">Original</sp-menu-item>
                  <sp-menu-item value="1">Bezier</sp-menu-item>
                  <sp-menu-item value="2">Mesh</sp-menu-item>
                  <sp-menu-item value="3">Enhanced bezier</sp-menu-item>
                </sp-picker>
                <sp-field-label
                  for=${`mesh-ws-${index}`}
                  side-aligned="start"
                  >Warp</sp-field-label
                >
                <sp-picker
                  id=${`mesh-ws-${index}`}
                  label="Warp"
                  value=${String(o.warpShapeIndex)}
                  size="s"
                  @change=${this.handleMeshMetaPicker.bind(
          this,
          index,
          'warpShapeIndex',
        )}
                >
                  <sp-menu-item value="0">Snoise</sp-menu-item>
                  <sp-menu-item value="1">Sine</sp-menu-item>
                  <sp-menu-item value="2">Value</sp-menu-item>
                  <sp-menu-item value="3">Worley</sp-menu-item>
                  <sp-menu-item value="4">FBM</sp-menu-item>
                  <sp-menu-item value="5">Voronoi</sp-menu-item>
                  <sp-menu-item value="6">Domain warp</sp-menu-item>
                  <sp-menu-item value="7">Waves</sp-menu-item>
                  <sp-menu-item value="8">Smooth</sp-menu-item>
                  <sp-menu-item value="9">Sphere</sp-menu-item>
                  <sp-menu-item value="10">Rows</sp-menu-item>
                  <sp-menu-item value="11">Columns</sp-menu-item>
                  <sp-menu-item value="12">Flat</sp-menu-item>
                  <sp-menu-item value="13">Black hole</sp-menu-item>
                </sp-picker>
                <sp-field-label
                  for=${`mesh-wsize-${index}`}
                  side-aligned="start"
                  >Warp size</sp-field-label
                >
                <sp-number-field
                  id=${`mesh-wsize-${index}`}
                  size="s"
                  min="0"
                  max="4"
                  step="0.05"
                  .value=${o.warpSize}
                  @input=${this.handleMeshNumberField.bind(
          this,
          index,
          'warpSize',
        )}
                ></sp-number-field>
                <sp-field-label
                  for=${`mesh-wr-${index}`}
                  side-aligned="start"
                  >Warp mix</sp-field-label
                >
                <sp-number-field
                  id=${`mesh-wr-${index}`}
                  size="s"
                  min="0"
                  max="2"
                  step="0.05"
                  .value=${o.warpRatio}
                  @input=${this.handleMeshNumberField.bind(
          this,
          index,
          'warpRatio',
        )}
                ></sp-number-field>
              </div>
              <div class="mesh-bg-row">
                <sp-field-label
                  for=${`mesh-bg-${index}`}
                  side-aligned="start"
                  >Background</sp-field-label
                >
                <sp-swatch
                  id=${`mesh-bg-${index}`}
                  color=${mg.backgroundColor}
                  size="s"
                ></sp-swatch>
                <sp-overlay
                  type="auto"
                  trigger=${`mesh-bg-${index}@click`}
                  placement="bottom"
                >
                  <sp-popover class="stop-color-popover" dialog>
                    <ic-spectrum-color-picker
                      .types=${[ColorType.Solid]}
                      value=${mg.backgroundColor}
                      @color-change=${this.handleMeshBackgroundChange.bind(
          this,
          index,
        )}
                    ></ic-spectrum-color-picker>
                  </sp-popover>
                </sp-overlay>
              </div>
              <div class="gradient-stops-header">
                <span class="mesh-grad-label">Corners (UV 0–1)</span>
                <sp-action-button
                  quiet
                  size="s"
                  @click=${this.addMeshCorner.bind(this, index)}
                  ?disabled=${this.meshCornerCount(mg) >= 9}
                >
                  <sp-tooltip self-managed placement="bottom"
                    >Add corner</sp-tooltip
                  >
                  <sp-icon-add slot="icon"></sp-icon-add>
                </sp-action-button>
              </div>
              <div class="mesh-corners-list">
                ${repeat(
          Array.from(
            { length: this.meshCornerCount(mg) },
            (_, i) => i,
          ),
          (cornerIndex) => cornerIndex,
          (cornerIndex) => html`
                    <div class="mesh-corner-row">
                      <sp-swatch
                        id=${`mesh-c-${index}-${cornerIndex}`}
                        color=${mg.colors[cornerIndex]!}
                        size="s"
                      ></sp-swatch>
                      <sp-overlay
                        type="auto"
                        trigger=${`mesh-c-${index}-${cornerIndex}@click`}
                        placement="bottom"
                      >
                        <sp-popover class="stop-color-popover" dialog>
                          <ic-spectrum-color-picker
                            .types=${[ColorType.Solid]}
                            value=${mg.colors[cornerIndex]!}
                            @color-change=${this.handleMeshCornerChange.bind(
            this,
            index,
            cornerIndex,
          )}
                          ></ic-spectrum-color-picker>
                        </sp-popover>
                      </sp-overlay>
                      <sp-number-field
                        label="X"
                        size="s"
                        min="0"
                        max="1"
                        step="0.01"
                        .value=${uv[cornerIndex]![0]!}
                        @input=${this.handleMeshPositionChange.bind(
            this,
            index,
            cornerIndex,
            0,
          )}
                      ></sp-number-field>
                      <sp-number-field
                        label="Y"
                        size="s"
                        min="0"
                        max="1"
                        step="0.01"
                        .value=${uv[cornerIndex]![1]!}
                        @input=${this.handleMeshPositionChange.bind(
            this,
            index,
            cornerIndex,
            1,
          )}
                      ></sp-number-field>

                      <sp-action-button
                        class="mesh-corner-remove"
                        quiet
                        size="s"
                        @click=${this.removeMeshCorner.bind(
            this,
            index,
            cornerIndex,
          )}
                        ?disabled=${this.meshCornerCount(mg) <= 1}
                      >
                        <sp-tooltip self-managed placement="bottom"
                          >Remove corner</sp-tooltip
                        >
                        <sp-icon-remove slot="icon"></sp-icon-remove>
                      </sp-action-button>
                    </div>
                  `,
        )}
              </div>
            </div>
            `;
      };

      const renderStopsSettings = () => html`
            ${gradient.type === 'linear-gradient'
          ? html` <div class="angle-field">
                  <sp-field-label for="angle-${index}" side-aligned="start"
                    >Angle</sp-field-label
                  >
                  <sp-number-field
                    id="angle-${index}"
                    size="s"
                    min="0"
                    max="360"
                    step="1"
                    .value=${gradient.angle}
                    @input=${this.handleAngleChange.bind(this, index)}
                  ></sp-number-field>
                </div>`
          : ''}
            <div class="gradient-stops-header">
              Stops
              <sp-action-button
                quiet
                size="s"
                @click="${this.addStop.bind(this, index)}"
              >
                <sp-tooltip self-managed placement="bottom">
                  Add stop
                </sp-tooltip>
                <sp-icon-add slot="icon"></sp-icon-add>
              </sp-action-button>
            </div>
            <div class="gradient-stops">
              ${'steps' in gradient
          ? gradient.steps.map((step, stopIndex) => {
            return html`
                      <div class="gradient-stop">
                        <div>
                          <sp-number-field
                            id="off-${index}-${stopIndex}"
                            size="s"
                            min="0"
                            max="1"
                            step="0.1"
                            format-options='{
                                "style": "percent"
                              }'
                            value=${step.offset.value / 100}
                            @input=${this.handleOffsetChange.bind(
              this,
              index,
              stopIndex,
            )}
                          ></sp-number-field>

                          <sp-swatch
                            id=${`stop-color-${index}-${stopIndex}`}
                            color=${step.color}
                            size="s"
                          ></sp-swatch>
                          <sp-overlay
                            type="auto"
                            trigger=${`stop-color-${index}-${stopIndex}@click`}
                            placement="bottom"
                          >
                            <sp-popover class="stop-color-popover" dialog>
                              <ic-spectrum-color-picker
                                .types=${[ColorType.Solid]}
                                value=${step.color}
                                @color-change=${this.handleColorChange.bind(
              this,
              index,
              stopIndex,
            )}
                              ></ic-spectrum-color-picker>
                            </sp-popover>
                          </sp-overlay>
                        </div>
                        <sp-action-button
                          quiet
                          size="s"
                          @click="${this.removeStop.bind(
              this,
              index,
              stopIndex,
            )}"
                        >
                          <sp-tooltip self-managed placement="bottom">
                            Remove stop
                          </sp-tooltip>
                          <sp-icon-remove slot="icon"></sp-icon-remove>
                        </sp-action-button>
                      </div>
                    `;
          })
          : ''}
            </div>
          `;

      return html`<div class="gradient-item">
            <div>
              <sp-swatch
                color=${convertGradientsToCSSValue([gradient])}
                size="s"
              ></sp-swatch>
              <sp-picker
                label="Gradient type"
                size="s"
                value=${gradient.type}
                @change=${this.handleGradientTypeChange.bind(this, index)}
              >
                <sp-menu-item value="linear-gradient">Linear</sp-menu-item>
                <sp-menu-item value="radial-gradient">Radial</sp-menu-item>
                <sp-menu-item value="conic-gradient">Conic</sp-menu-item>
                <sp-menu-item value="mesh-gradient">Mesh</sp-menu-item>
              </sp-picker>
            </div>
            <div>
              <sp-action-button
                id=${`ic-grad-settings-${index}`}
                quiet
                size="s"
                ?selected=${this.gradientSettingsOpenIndex === index}
              >
                <sp-icon-settings slot="icon"></sp-icon-settings>
                <sp-tooltip self-managed placement="bottom">
                  Gradient settings
                </sp-tooltip>
              </sp-action-button>
              <sp-overlay
                trigger=${`ic-grad-settings-${index}@click`}
                placement="bottom"
                type="auto"
                .offset=${6}
              >
                <sp-popover
                  class="gradient-settings-popover"
                  dialog
                  @sp-opened=${(e: CustomEvent<OverlayOpenCloseDetail>) => {
          if (e.target !== e.currentTarget) {
            return;
          }
          this.gradientSettingsOpenIndex = index;
        }}
                  @sp-closed=${(e: CustomEvent<OverlayOpenCloseDetail>) => {
          if (e.target !== e.currentTarget) {
            return;
          }
          if (this.gradientSettingsOpenIndex === index) {
            this.gradientSettingsOpenIndex = null;
          }
        }}
                >
                  <h4>Gradient settings</h4>
                  ${isMeshGradientGradient(gradient)
          ? renderMeshSettings(gradient as MeshGradient)
          : renderStopsSettings()}
                </sp-popover>
              </sp-overlay>
              <sp-action-button
                quiet
                size="s"
                @click="${this.removeGradient.bind(this, index)}"
              >
                <sp-tooltip self-managed placement="bottom">
                  Remove gradient
                </sp-tooltip>
                <sp-icon-remove slot="icon"></sp-icon-remove>
              </sp-action-button>
            </div>
          </div>`;
    })}
      </div>
    `;
  }
}

function convertGradientsToCSSValue(gradients: Gradient[]) {
  return gradients
    .map((gradient) => {
      if (gradient.type === 'linear-gradient') {
        return `linear-gradient(${gradient.angle || 0}deg, ${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'radial-gradient') {
        return `radial-gradient(${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'conic-gradient') {
        return `conic-gradient(${gradient.steps
          .map((step) => `${step.color} ${step.offset.value}%`)
          .join(', ')})`;
      } else if (gradient.type === 'mesh-gradient') {
        const g = gradient;
        const def = DEFAULT_MESH_GRADIENT_CORNER_POSITIONS;
        const pos = g.positions;
        const n = Math.min(9, g.pointsNum ?? g.colors.length);
        const cornerParts = g.colors.slice(0, n).map((col, i) => {
          const p = pos?.[i];
          if (
            p != null &&
            Array.isArray(p) &&
            p.length >= 2 &&
            Number.isFinite(p[0] as number) &&
            Number.isFinite(p[1] as number) &&
            (p[0] !== def[i]![0] || p[1] !== def[i]![1])
          ) {
            return `${col} ${p[0]} ${p[1]}`;
          }
          return col;
        });
        const colorPart = [g.backgroundColor, ...cornerParts].join(', ');
        const extra = formatMeshGradientStringSuffix(g);
        return `mesh-gradient(${colorPart}${extra})`;
      }
      return '';
    })
    .join(', ');
}

function createDefaultMeshGradient() {
  return {
    type: 'mesh-gradient' as const,
    backgroundColor: '#1a1a2e',
    pointsNum: 9,
    // 9 色彼此区分、且避免 0-4-8 等同色，否则双线性会呈现明显中心/对角线对称感
    colors: [
      '#ff6b6b',
      '#4ecdc4',
      '#45b7d1',
      '#96ceb4',
      '#feca57',
      '#ab47bc',
      '#7c4dff',
      '#ff9f43',
      '#2f3542',
    ],
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-input-gradient': InputGradient;
  }
}
