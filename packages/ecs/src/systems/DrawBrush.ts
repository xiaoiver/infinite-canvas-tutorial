import { System } from '@lastolivegames/becsy';
import { v4 as uuidv4 } from 'uuid';
import { Camera, Canvas, Cursor, Input, Pen, UI, UIType } from '../components';
import { API } from '../API';
import { serializeBrushPoints } from '../utils';
import { BrushSerializedNode } from '../types/serialized-node';
import { DRAW_RECT_Z_INDEX } from '../context';
import {
  BrushPressure,
  brushStrokePoints,
  type BrushStrokePoint,
} from '../utils/brush-stroke';
import type { PointerSample } from '../components/Input';

const BRUSH_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAMpSURBVHgB7VZNSBtREJ5sQv6MIdHaGm3THEpjW6o92JjoQW859CJY66HtRYREEA1CqBeLB0UoXqrUgzcPueihVMzFW7VoRUgRakURFRT8gZZi0pIY903nrausloKQjS0lHwz7suzL+3bmm28W4B+D5g/rrEE4f2BPT495ZWXlIfwFMtDW1laSTqe/jY6OIuHz2NjY45mZmQqXy2W8DCKaaDQa6OrqQpvNJubl5WE4HMahoSHc3NxkOzs7r+TnBFARZ0qwt7dXtLGxAcPDw8Ls7Czo9XqYm5sDt9uNHR0d4VQq9YmeY6AiiTMEKO0afuj+/j6Ul5dDb28vRCIRSCaTQjweZ93d3Q8mJiZC9CyCStCdJyAtNL+Xenx8XMjPz4e+vr5H9PM1qARlBlCn02kpzVLqlWCMAWkCDAYDJBKJMrqlBZUEqSSgX11d/eDxeGB6ehpPDubgGdnd3YWjoyOwWq1X19bWIs3NzQ55n2qdYS4oKLhB9U7QGskLUIna2lpOSoqamhokct9DoZBDTQJcD0UktCB1AgqCwCgbrKWlBYuLi6WDFxYWJDKBQIA5nU6+/CLvVaUr+JvYKG41NDQ8EUUxPjk5iYODg9wPWGVlpXT44eGhdLXb7WJ/fz8S2ZeK/RmDZ+EKxR2TyeSrrq5+1tnZ+YJMKEXmdFqOxsZGrKurQxIrknekybxcoGIpuMKtFNcpuOLvzs/Pv21vb0efzydypywtLZWIkHOixWJhlK1lea9qBqWRiZgoSkic3q2treWBgQGuBba0tHSajaamJrG1tVX1UihhpHI46VpGIny3vb2N5AcsGAwyToB8QyoFtWaaJqkLsjSwzEaj8SZd79fX1z+nc3/4/X50OBwiWTQuLi4iueRJKbSQBfC3MlDwvr9H49m/vr4e45OSfrOpqSkkgiIJEquqqq6ByhNTCd4lNirBbbpWjIyMvDk4OBBpcEmjm3Twnu5bIEtZOAHPhlnWhdvr9T4l1/wYi8WihYWFHjhu4wtnIBPB8InF29UOx28sUiQpvlL8vOifZKpYrUyE64PrISWHat8LF4UGLuvDNYcccvjv8Au1hn6W8NMbDwAAAABJRU5ErkJggg==") 4 28, pointer';

export class DrawBrush extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<
    number,
    {
      brush?: BrushSerializedNode;
      pressure?: BrushPressure;
      points: BrushStrokePoint[];
      origin: [number, number];
      active: boolean;
      started: boolean;
    }
  >();

  constructor() {
    super();

    this.query((q) => q.using(Canvas, Input).read.and.using(Cursor).write);
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      const canvas = camera.read(Camera).canvas?.hold();
      const cameraId = camera.__id;
      if (!canvas) return;
      const { api } = canvas.read(Canvas);
      const input = canvas.read(Input);
      const drawing = api.getAppState().penbarSelected === Pen.BRUSH;
      if (drawing) canvas.write(Cursor).value = BRUSH_CURSOR;

      if (!drawing || input.pointerCancelled || input.key === 'Escape') {
        if (this.selections.get(cameraId)?.active) {
          api.runAtNextTick(() => this.cancel(api, cameraId));
        }
        return;
      }

      // Copy event samples before EventDisposer clears them. Process a whole
      // frame together so coalesced events do not cause repeated tessellation.
      const samples = input.pointerSamples.slice();
      if (!samples.length) return;
      api.runAtNextTick(() => {
        if (
          api.getAppState().penbarSelected !== Pen.BRUSH ||
          canvas.read(Input).pointerCancelled ||
          canvas.read(Input).key === 'Escape'
        ) {
          this.cancel(api, cameraId);
          return;
        }
        this.brush(api, cameraId, samples);
      });
    });
  }

  private cancel(api: API, cameraId: number) {
    const selection = this.selections.get(cameraId);
    if (!selection) return;
    selection.active = false;
    selection.points = [];
    if (selection.brush) {
      api.updateNode(selection.brush, { visibility: 'hidden' }, false);
    }
  }

  private brush(api: API, cameraId: number, samples: PointerSample[]) {
    let selection = this.selections.get(cameraId);
    for (const sample of samples) {
      if (sample.phase === 'down') {
        if (!selection) api.onDestroy(() => this.selections.delete(cameraId));
        selection = {
          brush: selection?.brush,
          pressure: new BrushPressure(sample),
          points: [{ ...api.viewport2Canvas(sample), pressure: 0 }],
          origin: [sample.x, sample.y],
          active: true,
          started: false,
        };
        selection.points[0].pressure = selection.pressure.value;
        this.selections.set(cameraId, selection);
        continue;
      }
      if (!selection?.active) continue;
      const pressure = selection.pressure.update(sample);
      const point = api.viewport2Canvas(sample);
      const previous = selection.points[selection.points.length - 1];
      if (point.x !== previous.x || point.y !== previous.y) {
        selection.points.push({ ...point, pressure });
      }
      selection.started ||=
        Math.hypot(
          sample.x - selection.origin[0],
          sample.y - selection.origin[1],
        ) > 10;

      if (sample.phase === 'up') {
        // Flush the release position even when down/move/up share one frame.
        if (selection.started) {
          this.paint(api, selection, true);
          const { brush } = selection;
          api.updateNode(brush, { visibility: 'hidden' }, false);
          const { stamps, ...rest } = api.getAppState().penbarBrush;
          const activeStamp =
            stamps?.find((stamp) => stamp.active) ?? stamps?.[0];
          const maxZIndex = api
            .getNodes()
            .reduce((max, node) => Math.max(max, node.zIndex ?? 0), 0);
          const node: BrushSerializedNode = {
            ...rest,
            id: uuidv4(),
            type: 'brush',
            version: 0,
            zIndex: maxZIndex + 1,
            points: brush.points,
            brushStamp: activeStamp?.src,
          };
          api.updateNode(node);
          api.setAppState({ penbarSelected: Pen.SELECT });
          api.selectNodes([node]);
          api.record();
        }
        selection.active = false;
      }
    }
    if (selection?.active && selection.started) this.paint(api, selection);
  }

  private paint(
    api: API,
    selection: { brush?: BrushSerializedNode; points: BrushStrokePoint[] },
    last = false,
  ) {
    const { stamps, ...rest } = api.getAppState().penbarBrush;
    const activeStamp = stamps?.find((stamp) => stamp.active) ?? stamps?.[0];
    if (!selection.brush) {
      selection.brush = {
        ...rest,
        id: uuidv4(),
        type: 'brush',
        points: '0,0,0',
        visibility: 'hidden',
        zIndex: DRAW_RECT_Z_INDEX,
      };
      api.updateNode(selection.brush, undefined, false);
      api.getEntity(selection.brush).add(UI, { type: UIType.BRUSH });
    }
    api.updateNode(
      selection.brush,
      {
        ...rest,
        visibility: 'visible',
        points: serializeBrushPoints(
          brushStrokePoints(selection.points, rest.strokeWidth, last),
        ),
        brushStamp: activeStamp?.src,
      },
      false,
    );
  }
}
