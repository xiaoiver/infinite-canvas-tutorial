import { css, html, LitElement } from 'lit';
import {
  customElement,
  eventOptions,
  property,
  state,
} from 'lit/decorators.js';
import { localized, msg, str } from '@lit/localize';
import {
  GlobalTransform,
  Transformable,
  VectorNetworkEditMode,
  createSVGElement,
  cutVectorNetworkFace,
  uncutVectorNetworkEdge,
  buildVectorNetworkFillMesh,
  glueVectorNetworkEdges,
  unglueVectorNetworkEdge,
  vectorEdgeUses,
  preferVectorNetworkEdge,
  type VectorEdgeUse,
  glueVertices,
  unglueVertex,
  vectorVertexEndpoints,
  vectorSegmentCubic,
  getVectorSegmentPointAt,
  requestTransformerRefreshForCanvas,
  type AppState,
  type VectorEndpoint,
  type VectorNetwork,
  type VectorNetworkSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import type { ExtendedAPI } from '../API';
import '@spectrum-web-components/overlay/sp-overlay.js';
import '@spectrum-web-components/popover/sp-popover.js';
import '@spectrum-web-components/picker/sp-picker.js';
import '@spectrum-web-components/menu/sp-menu-item.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-link.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-divide-path.js';

type Session = { node: VectorNetworkSerializedNode; source: number };

const geometry = (node: VectorNetworkSerializedNode) => ({
  vertices: node.vertices ?? [],
  segments: node.segments ?? [],
  regions: node.regions,
});

@customElement('ic-spectrum-vector-topology-controls')
@localized()
export class VectorTopologyControls extends LitElement {
  static styles = css`
    :host {
      flex: none;
    }
    sp-popover {
      width: min(280px, calc(100vw - 48px));
      padding: 16px;
    }
    h4,
    p {
      margin: 0 0 8px;
    }
    p {
      font-size: 12px;
      color: var(--spectrum-gray-700);
    }
    sp-picker {
      width: 100%;
      margin-bottom: 8px;
    }
    sp-divider {
      margin: 12px 0;
    }
    .edges {
      max-height: 140px;
      overflow: auto;
      margin-bottom: 8px;
    }
    label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      cursor: pointer;
    }
    input[type='checkbox'] {
      accent-color: var(--spectrum-accent-background-color-default, #147af3);
    }
    .actions {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
  `;

  @property({ type: Boolean }) faces = false;
  @state() private faceAction: 'cut' | 'uncut' = 'cut';
  @state() private edgeMode = false;
  @state() private edgeAction: 'edge-glue' | 'edge-unglue' = 'edge-unglue';
  @state() private edgeTarget = '';
  @state() private uses: VectorEdgeUse[] = [];
  @state() private edge = '';
  @state() private error = '';
  @property({ attribute: false }) api: ExtendedAPI;
  @property({ attribute: false }) appState: AppState;
  @property({ attribute: false }) node: VectorNetworkSerializedNode;
  @state() private session?: Session;
  @state() private target = '';
  @state() private detached: VectorEndpoint[] = [];
  private preview?: SVGSVGElement;
  private frame = 0;
  private stopHistory?: () => void;
  private stopDestroy?: () => void;
  private pending = false;
  private previewKey = '';

  private get source() {
    const selected = this.appState.vectorNetworkSelectedVertex;
    return selected && this.node && selected.nodeId === this.node.id
      ? selected.index
      : -1;
  }

  private current(session: Session) {
    const node = this.api.getNodeById(session.node.id);
    const state = this.api.getAppState();
    const selected = state.vectorNetworkSelectedVertex;
    return node?.type === 'vector-network' &&
      node.isEditing &&
      !node.locked &&
      node.visibility !== 'hidden' &&
      state.layersSelected.length === 1 &&
      state.layersSelected[0] === node.id &&
      state.vectorNetworkEditMode === VectorNetworkEditMode.MOVE &&
      selected?.nodeId === node.id &&
      selected.index === session.source &&
      node.vertices === session.node.vertices &&
      node.segments === session.node.segments &&
      node.regions === session.node.regions &&
      (['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const).every(
        (key) => node[key] === session.node[key],
      )
      ? node
      : undefined;
  }

  @eventOptions({ capture: true })
  private preparePlacement() {
    // Spectrum captures placement options when opening the overlay.
    const overlay = this.renderRoot.querySelector('sp-overlay');
    if (overlay)
      overlay.placement = window.innerWidth >= 768 ? 'right-end' : 'top';
  }

  private open() {
    // Ignore duplicate opened events without leaking preview or subscriptions.
    if (this.session) return;
    const node = this.api.getNodeById(this.node.id);
    if (node?.type !== 'vector-network' || !node.vertices?.[this.source]) {
      this.close();
      return;
    }
    this.session = { node: { ...node }, source: this.source };
    this.target = '';
    this.detached = [];
    this.faceAction = 'cut';
    this.edgeMode = false;
    this.edgeAction = 'edge-unglue';
    this.edgeTarget = '';
    this.uses = [];
    this.edge = '';
    this.error = '';
    this.stopHistory = this.api.onBeforeHistoryChange(() => this.close());
    this.stopDestroy = this.api.onDestroy(() => this.close());
    this.preview = createSVGElement('svg') as SVGSVGElement;
    this.preview.setAttribute('data-vector-topology-preview', '');
    this.preview.setAttribute('aria-hidden', 'true');
    this.preview.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible';
    this.api.getSvgLayer()?.append(this.preview);
    const overlay = this.renderRoot.querySelector('sp-overlay')!;
    const tick = () => {
      if (!this.session || !this.isConnected || !this.current(this.session)) {
        this.close();
        return;
      }
      const placement = window.innerWidth >= 768 ? 'right-end' : 'top';
      if (overlay.placement !== placement) {
        this.close();
        return;
      }
      this.drawPreview();
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  private close() {
    const overlay = this.renderRoot.querySelector('sp-overlay');
    if (overlay) overlay.open = false;
    cancelAnimationFrame(this.frame);
    this.preview?.remove();
    this.preview = undefined;
    const stopHistory = this.stopHistory,
      stopDestroy = this.stopDestroy;
    this.stopHistory = this.stopDestroy = undefined;
    this.session = undefined;
    this.pending = false;
    this.previewKey = '';
    stopHistory?.();
    stopDestroy?.();
  }

  disconnectedCallback() {
    this.close();
    super.disconnectedCallback();
  }

  private drawPreview() {
    const { node, source } = this.session!;
    const m = this.api.getEntity(node).read(GlobalTransform).matrix;
    const state = this.api.getAppState();
    const key = [
      state.cameraX,
      state.cameraY,
      state.cameraZoom,
      state.cameraRotation,
      m.m00,
      m.m01,
      m.m10,
      m.m11,
      m.m20,
      m.m21,
      this.target,
      this.faceAction,
      this.edgeMode,
      this.edgeTarget,
      this.uses
        .map((u) => `${u.regionIndex}/${u.loopIndex}/${u.offset}`)
        .join(),
      this.edge,
      this.detached.map((e) => `${e.segmentIndex}:${e.end}`).join(','),
    ].join('/');
    if (key === this.previewKey) return;
    this.previewKey = key;
    const screen = (x: number, y: number) =>
      this.api.canvas2Viewport({
        x: m.m00 * x + m.m10 * y + m.m20,
        y: m.m01 * x + m.m11 * y + m.m21,
      });
    const svg = this.preview!;
    svg.replaceChildren();
    const append = (
      tag: string,
      attrs: Record<string, string | number>,
      text?: string,
    ) => {
      const el = createSVGElement(tag);
      for (const [key, value] of Object.entries(attrs))
        el.setAttribute(key, String(value));
      if (text) el.textContent = text;
      svg.append(el);
    };
    const label = (x: number, y: number, text: string, color = '#147af3') =>
      append(
        'text',
        {
          x,
          y,
          fill: color,
          stroke: 'white',
          'stroke-width': 3,
          'paint-order': 'stroke',
          'font-size': 12,
          'font-family': 'sans-serif',
          'font-weight': 'bold',
        },
        text,
      );
    if (this.edgeMode && this.edge !== '') {
      const regions = new Set(
        vectorEdgeUses(geometry(node), Number(this.edge)).map(
          (u) => u.regionIndex,
        ),
      );
      for (const i of regions) {
        const mesh = buildVectorNetworkFillMesh(node.vertices, node.segments, [
          node.regions[i],
        ]);
        const points = mesh.points;
        if (points.length < 6) continue;
        if (this.uses.some((u) => u.regionIndex === i)) {
          let path = '';
          for (let j = 0; j < points.length; j += 6) {
            const a = screen(points[j], points[j + 1]),
              b = screen(points[j + 2], points[j + 3]),
              c = screen(points[j + 4], points[j + 5]);
            path += `M${a.x},${a.y}L${b.x},${b.y}L${c.x},${c.y}Z`;
          }
          append('path', { d: path, fill: '#e8590c', opacity: 0.2 });
        }
        const p = screen(
          (points[0] + points[2] + points[4]) / 3,
          (points[1] + points[3] + points[5]) / 3,
        );
        label(p.x, p.y, `R${i + 1}`, '#9c3b10');
      }
    }
    const edges = new Set(
      vectorVertexEndpoints(geometry(node), source).map((e) => e.segmentIndex),
    );
    if (this.edgeMode && this.edgeTarget !== '')
      edges.add(Number(this.edgeTarget));
    for (const segmentIndex of edges) {
      const segment = node.segments[segmentIndex];
      const points = vectorSegmentCubic(node.vertices, segment)!.map(([x, y]) =>
        screen(x, y),
      );
      if (
        this.detached.some((e) => e.segmentIndex === segmentIndex) ||
        ((this.edgeMode || (this.faces && this.faceAction === 'uncut')) &&
          this.edge === String(segmentIndex))
      ) {
        append('path', {
          d: `M${points[0].x},${points[0].y} C${points
            .slice(1)
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}`,
          fill: 'none',
          stroke: '#e8590c',
          'stroke-width': 4,
          opacity: 0.65,
        });
      }
      const p = getVectorSegmentPointAt(node.vertices, segment, 0.35)!;
      const v = screen(p[0], p[1]);
      label(v.x + 6, v.y - 6, `E${segmentIndex + 1}`);
    }
    if (
      !this.edgeMode &&
      this.target !== '' &&
      (!this.faces || this.faceAction === 'cut')
    ) {
      const a = node.vertices[source],
        b = node.vertices[Number(this.target)];
      if (b) {
        const p = screen(a.x, a.y),
          q = screen(b.x, b.y);
        append('line', {
          x1: p.x,
          y1: p.y,
          x2: q.x,
          y2: q.y,
          stroke: '#e8590c',
          'stroke-width': 2,
          'stroke-dasharray': '4 4',
        });
      }
    }
    const overlaps = new Map<string, number>();
    node.vertices.forEach((v, i) => {
      const p = screen(v.x, v.y),
        key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const offset = overlaps.get(key) ?? 0;
      overlaps.set(key, offset + 1);
      label(
        p.x + 9,
        p.y - 9 - offset * 15,
        `V${i + 1}`,
        i === source ? '#e8590c' : '#147af3',
      );
    });
  }

  private apply(
    kind: 'glue' | 'unglue' | 'cut' | 'uncut' | 'edge-glue' | 'edge-unglue',
  ) {
    const session = this.session;
    if (!session || this.pending) return;
    const target = Number(this.target);
    const edge = Number(this.edge);
    const endpoints = this.detached.slice();
    const uses = this.uses.slice();
    const edgeTarget = Number(this.edgeTarget);
    if ((kind === 'edge-glue' || kind === 'edge-unglue') && this.edge === '')
      return;
    if (kind === 'edge-glue' && this.edgeTarget === '') return;
    if ((kind === 'glue' || kind === 'cut') && this.target === '') return;
    if (kind === 'uncut' && this.edge === '') return;
    this.error = '';
    this.pending = true;
    this.api.runAtNextTick(() => {
      if (!this.isConnected || this.session !== session) return;
      const node = this.current(session);
      if (!node) {
        this.close();
        return;
      }
      const result =
        kind === 'edge-glue'
          ? glueVectorNetworkEdges(geometry(node), edge, edgeTarget)
          : kind === 'edge-unglue'
          ? unglueVectorNetworkEdge(geometry(node), edge, uses)
          : kind === 'cut'
          ? cutVectorNetworkFace(geometry(node), session.source, target)
          : kind === 'uncut'
          ? uncutVectorNetworkEdge(geometry(node), edge)
          : kind === 'glue'
          ? glueVertices(geometry(node), session.source, target)
          : unglueVertex(geometry(node), session.source, endpoints);
      if (result.ok) {
        this.api.updateNodeVectorNetwork(node, result.network as VectorNetwork);
        const transformable = this.api.getCamera().write(Transformable);
        transformable.selectedControlPointIndex = result.selectedVertex;
        transformable.hoveredControlPointIndex = -1;
        transformable.hoveredSegmentIndex = -1;
        this.api.setAppState({
          vectorNetworkSelectedVertex: {
            nodeId: node.id,
            index: result.selectedVertex,
          },
        });
        this.api.record();
        if (
          'selectedSegment' in result &&
          typeof result.selectedSegment === 'number'
        ) {
          const current = this.api.getNodeById(
            node.id,
          ) as VectorNetworkSerializedNode;
          preferVectorNetworkEdge(this.api, current, result.selectedSegment);
          if (kind === 'edge-unglue')
            this.api.setAppState({
              vectorNetworkEditMode: VectorNetworkEditMode.BEND,
            });
        }
        requestTransformerRefreshForCanvas(this.api.getCanvas());
      }
      if (result.ok === false && (this.faces || this.edgeMode)) {
        const messages: Record<string, string> = {
          'invalid-uses': msg(
            str`Choose some, but not all, region boundary uses. Fill adjacent faces first if the edge is not shared.`,
          ),
          'different-geometry': msg(
            str`The edges must have matching curves, including their control points.`,
          ),
          'collapsed-region': msg(
            str`Both edges occur in one boundary. This merge is not supported.`,
          ),
          'incompatible-winding': msg(
            str`Merging would change a nonzero fill boundary. Keep these edges separate.`,
          ),
          'incompatible-endpoints': msg(
            str`The endpoint topology of these edges cannot be matched.`,
          ),
          'invalid-edge': msg(str`Choose an existing edge.`),
          'same-edge': msg(str`Choose two different edges.`),
          'no-shared-face': msg(
            str`Choose two boundary vertices of the same face, including its holes.`,
          ),
          'crossing-cut': msg(
            str`The cut touches or crosses an existing edge. Choose another target.`,
          ),
          'not-interior-edge': msg(
            str`Choose a shared face edge or a seam connecting hole boundaries.`,
          ),
          'different-fills': msg(
            str`Both faces must have the same fill state. Fill or clear the other face first.`,
          ),
          'unsupported-topology': msg(
            str`This operation requires compatible planar face boundaries.`,
          ),
          'invalid-network': msg(
            str`The network contains an invalid edge or region boundary.`,
          ),
        };
        this.error =
          messages[result.reason] ?? msg(str`Choose a different vertex.`);
        this.pending = false;
        return;
      }
      this.close();
    });
  }

  private bendEdge() {
    const session = this.session,
      edge = Number(this.edge);
    if (!session || this.edge === '') return;
    this.api.runAtNextTick(() => {
      if (this.session !== session || !this.isConnected) return;
      const node = this.current(session);
      if (node) {
        preferVectorNetworkEdge(this.api, node, edge);
        this.api.setAppState({
          vectorNetworkEditMode: VectorNetworkEditMode.BEND,
        });
      }
      this.close();
    });
  }

  private renderEdgeControls(session: Session, incident: VectorEndpoint[]) {
    const uses =
      this.edge === ''
        ? []
        : vectorEdgeUses(geometry(session.node), Number(this.edge));
    const key = (u: VectorEdgeUse) =>
      `${u.regionIndex}/${u.loopIndex}/${u.offset}`;
    return html` <sp-picker
        label=${msg(str`Edge operation`)}
        .value=${this.edgeAction}
        @change=${(e: Event) => {
          this.edgeAction = (e.target as HTMLInputElement)
            .value as typeof this.edgeAction;
          this.error = '';
        }}
      >
        <sp-menu-item value="edge-unglue"
          >${msg(str`Unglue edge`)}</sp-menu-item
        >
        <sp-menu-item value="edge-glue">${msg(str`Glue edges`)}</sp-menu-item>
      </sp-picker>
      <sp-picker
        label=${msg(str`Source edge`)}
        .value=${this.edge}
        @change=${(e: Event) => {
          this.edge = (e.target as HTMLInputElement).value;
          this.edgeTarget = '';
          this.uses = [];
          this.error = '';
        }}
      >
        ${[...new Set(incident.map((e) => e.segmentIndex))].map(
          (i) =>
            html`<sp-menu-item value=${String(i)}>E${i + 1}</sp-menu-item>`,
        )}
      </sp-picker>
      ${this.edgeAction === 'edge-glue'
        ? html` <p>
              ${msg(
                str`Merge matching curves. Reversed edge direction is supported.`,
              )}
            </p>
            <sp-picker
              label=${msg(str`Target edge`)}
              .value=${this.edgeTarget}
              @change=${(e: Event) => {
                this.edgeTarget = (e.target as HTMLInputElement).value;
                this.error = '';
              }}
            >
              ${session.node.segments.map((_, i) =>
                String(i) === this.edge
                  ? ''
                  : html`<sp-menu-item value=${String(i)}
                      >E${i + 1}</sp-menu-item
                    >`,
              )}
            </sp-picker>`
        : html` <p>
              ${msg(
                str`Detach selected filled-region boundaries. End vertices stay shared.`,
              )}
            </p>
            <div class="edges">
              ${uses.map(
                (u) => html`<label
                  ><input
                    type="checkbox"
                    .checked=${this.uses.some((v) => key(v) === key(u))}
                    @change=${(e: Event) => {
                      this.uses = this.uses.filter((v) => key(v) !== key(u));
                      if ((e.target as HTMLInputElement).checked)
                        this.uses = [...this.uses, u];
                      this.error = '';
                    }}
                  />R${u.regionIndex + 1} · L${u.loopIndex + 1} ·
                  ${u.offset + 1}</label
                >`,
              )}
            </div>
            <p>
              ${msg(
                str`Keep at least one use on the original edge. Unglue enters Bend to edit the copy.`,
              )}
            </p>
            ${this.edge !== '' && uses.length < 2
              ? html`<p>
                  ${msg(
                    str`Fill adjacent faces first so this edge has at least two region uses.`,
                  )}
                </p>`
              : ''}`}
      ${this.error ? html`<p role="alert">${this.error}</p>` : ''}
      <div class="actions">
        <sp-action-button
          ?disabled=${this.edge === '' ||
          (this.edgeAction === 'edge-glue'
            ? this.edgeTarget === ''
            : !this.uses.length || this.uses.length === uses.length)}
          @click=${() => this.apply(this.edgeAction)}
          >${this.edgeAction === 'edge-glue'
            ? msg(str`Glue edges`)
            : msg(str`Unglue edge`)}</sp-action-button
        >
        <sp-action-button @click=${this.close}
          >${msg(str`Cancel`)}</sp-action-button
        >
      </div>
      <sp-action-button ?disabled=${this.edge === ''} @click=${this.bendEdge}
        >${msg(str`Bend selected edge`)}</sp-action-button
      >`;
  }

  private renderFaceControls(session: Session, incident: VectorEndpoint[]) {
    return html` <h4>${msg(str`Vertex`)} V${session.source + 1}</h4>
      <sp-picker
        label=${msg(str`Face operation`)}
        .value=${this.faceAction}
        @change=${(e: Event) => {
          this.faceAction = (e.target as HTMLInputElement).value as
            | 'cut'
            | 'uncut';
          this.error = '';
        }}
      >
        <sp-menu-item value="cut">${msg(str`Cut face`)}</sp-menu-item>
        <sp-menu-item value="uncut">${msg(str`Uncut edge`)}</sp-menu-item>
      </sp-picker>
      <p>
        ${this.faceAction === 'cut'
          ? msg(
              str`Connect boundary vertices of one face, including its holes.`,
            )
          : msg(
              str`Merge equally filled faces, or remove a seam to restore separate hole boundaries.`,
            )}
      </p>
      ${this.faceAction === 'cut'
        ? html` <sp-picker
            label=${msg(str`Target vertex`)}
            .value=${this.target}
            @change=${(e: Event) => {
              this.target = (e.target as HTMLInputElement).value;
              this.error = '';
            }}
          >
            ${session.node.vertices.map((_, i) =>
              i === session.source
                ? ''
                : html` <sp-menu-item value=${String(i)}
                    >V${i + 1}</sp-menu-item
                  >`,
            )}
          </sp-picker>`
        : html` <sp-picker
            label=${msg(str`Shared edge`)}
            .value=${this.edge}
            @change=${(e: Event) => {
              this.edge = (e.target as HTMLInputElement).value;
              this.error = '';
            }}
          >
            ${[...new Set(incident.map((e) => e.segmentIndex))].map(
              (i) => html` <sp-menu-item value=${String(i)}
                >E${i + 1}</sp-menu-item
              >`,
            )}
          </sp-picker>`}
      ${this.error ? html`<p role="alert">${this.error}</p>` : ''}
      <div class="actions">
        <sp-action-button
          ?disabled=${this.faceAction === 'cut'
            ? this.target === ''
            : this.edge === ''}
          @click=${() => this.apply(this.faceAction)}
        >
          ${this.faceAction === 'cut'
            ? msg(str`Cut face`)
            : msg(str`Uncut edge`)}
        </sp-action-button>
        <sp-action-button @click=${this.close}
          >${msg(str`Cancel`)}</sp-action-button
        >
      </div>`;
  }

  render() {
    const session = this.session;
    const incident = session
      ? vectorVertexEndpoints(geometry(session.node), session.source)
      : [];
    return html` <sp-action-button
        id="topology"
        quiet
        size="m"
        label=${this.faces
          ? msg(str`Cut / Uncut faces`)
          : msg(str`Glue / Unglue`)}
        ?disabled=${this.source < 0 || this.node?.locked}
        @click=${this.preparePlacement}
      >
        ${this.faces
          ? html`<sp-icon-divide-path slot="icon"></sp-icon-divide-path>`
          : html`<sp-icon-link slot="icon"></sp-icon-link>`}
        <sp-tooltip self-managed placement="top"
          >${this.faces
            ? msg(str`Cut or merge faces`)
            : msg(str`Select a vertex to glue or unglue`)}</sp-tooltip
        >
      </sp-action-button>
      <sp-overlay
        trigger="topology@click"
        placement="top"
        type="auto"
        @sp-opened=${(e: Event) => {
          if (e.target === e.currentTarget) this.open();
        }}
        @sp-closed=${(e: Event) => {
          if (e.target === e.currentTarget) this.close();
        }}
      >
        <sp-popover dialog>
          ${session && !this.faces
            ? html` <sp-picker
                label=${msg(str`Topology target`)}
                .value=${this.edgeMode ? 'edges' : 'vertices'}
                @change=${(e: Event) => {
                  this.edgeMode =
                    (e.target as HTMLInputElement).value === 'edges';
                  this.error = '';
                }}
              >
                <sp-menu-item value="vertices"
                  >${msg(str`Vertices`)}</sp-menu-item
                >
                <sp-menu-item value="edges">${msg(str`Edges`)}</sp-menu-item>
              </sp-picker>`
            : ''}
          ${session
            ? this.faces
              ? this.renderFaceControls(session, incident)
              : this.edgeMode
              ? this.renderEdgeControls(session, incident)
              : html`
                  <h4>${msg(str`Vertex`)} V${session.source + 1}</h4>
                  <p>${msg(str`Glue moves this vertex to the target.`)}</p>
                  <sp-picker
                    label=${msg(str`Target vertex`)}
                    .value=${this.target}
                    @change=${(e: Event) => {
                      this.target = (e.target as HTMLInputElement).value;
                    }}
                  >
                    ${session.node.vertices.map((_, i) =>
                      i === session.source
                        ? ''
                        : html` <sp-menu-item value=${String(i)}
                            >V${i + 1}</sp-menu-item
                          >`,
                    )}
                  </sp-picker>
                  <sp-action-button
                    ?disabled=${this.target === ''}
                    @click=${() => this.apply('glue')}
                    >${msg(str`Glue`)}</sp-action-button
                  >
                  <sp-divider size="s"></sp-divider>
                  <p>${msg(str`Unglue: choose the edge ends to detach.`)}</p>
                  <div class="edges">
                    ${incident.map(
                      (end) => html`<label
                        ><input
                          type="checkbox"
                          .checked=${this.detached.some(
                            (e) =>
                              e.segmentIndex === end.segmentIndex &&
                              e.end === end.end,
                          )}
                          @change=${(e: Event) => {
                            this.detached = this.detached.filter(
                              (v) =>
                                v.segmentIndex !== end.segmentIndex ||
                                v.end !== end.end,
                            );
                            if ((e.target as HTMLInputElement).checked)
                              this.detached = [...this.detached, end];
                          }}
                        />E${end.segmentIndex + 1} ·
                        ${end.end === 'start'
                          ? msg(str`Start`)
                          : msg(str`End`)}</label
                      >`,
                    )}
                  </div>
                  <p>
                    ${msg(
                      str`Keep at least one edge end attached. Open boundaries lose their fill.`,
                    )}
                  </p>
                  <div class="actions">
                    <sp-action-button
                      ?disabled=${!this.detached.length ||
                      this.detached.length === incident.length}
                      @click=${() => this.apply('unglue')}
                      >${msg(str`Unglue`)}</sp-action-button
                    >
                    <sp-action-button @click=${this.close}
                      >${msg(str`Cancel`)}</sp-action-button
                    >
                  </div>
                `
            : ''}
        </sp-popover>
      </sp-overlay>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ic-spectrum-vector-topology-controls': VectorTopologyControls;
  }
}
