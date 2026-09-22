import { path2Absolute, path2String } from '@antv/util';

export type PathCommand = [string, ...number[]];

export interface PathControlHandleMeta {
  commandIndex: number;
  coordOffset: number;
}

type HandlePoint = {
  x: number;
  y: number;
  meta: PathControlHandleMeta;
};

function reflect(current: [number, number], control: [number, number]) {
  return [current[0] * 2 - control[0], current[1] * 2 - control[1]] as [
    number,
    number,
  ];
}

export function normalizePathCommands(d: string): PathCommand[] {
  const absolute = path2Absolute(d) as PathCommand[];
  const normalized: PathCommand[] = [];
  let current: [number, number] = [0, 0];
  let subpathStart: [number, number] = [0, 0];
  let prevCubicControl: [number, number] | null = null;
  let prevQuadControl: [number, number] | null = null;

  absolute.forEach((command) => {
    const type = command[0];
    const data = command.slice(1) as number[];

    switch (type) {
      case 'M': {
        for (let i = 0; i < data.length; i += 2) {
          const x = data[i];
          const y = data[i + 1];
          if (i === 0) {
            normalized.push(['M', x, y]);
            subpathStart = [x, y];
          } else {
            normalized.push(['L', x, y]);
          }
          current = [x, y];
        }
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'L': {
        for (let i = 0; i < data.length; i += 2) {
          const x = data[i];
          const y = data[i + 1];
          normalized.push(['L', x, y]);
          current = [x, y];
        }
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'H': {
        data.forEach((x) => {
          normalized.push(['L', x, current[1]]);
          current = [x, current[1]];
        });
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'V': {
        data.forEach((y) => {
          normalized.push(['L', current[0], y]);
          current = [current[0], y];
        });
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      case 'C': {
        for (let i = 0; i < data.length; i += 6) {
          const cp1x = data[i];
          const cp1y = data[i + 1];
          const cp2x = data[i + 2];
          const cp2y = data[i + 3];
          const x = data[i + 4];
          const y = data[i + 5];
          normalized.push(['C', cp1x, cp1y, cp2x, cp2y, x, y]);
          current = [x, y];
          prevCubicControl = [cp2x, cp2y];
          prevQuadControl = null;
        }
        break;
      }
      case 'S': {
        for (let i = 0; i < data.length; i += 4) {
          const cp1 = prevCubicControl
            ? reflect(current, prevCubicControl)
            : current;
          const cp2x = data[i];
          const cp2y = data[i + 1];
          const x = data[i + 2];
          const y = data[i + 3];
          normalized.push(['C', cp1[0], cp1[1], cp2x, cp2y, x, y]);
          current = [x, y];
          prevCubicControl = [cp2x, cp2y];
          prevQuadControl = null;
        }
        break;
      }
      case 'Q': {
        for (let i = 0; i < data.length; i += 4) {
          const cpx = data[i];
          const cpy = data[i + 1];
          const x = data[i + 2];
          const y = data[i + 3];
          normalized.push(['Q', cpx, cpy, x, y]);
          current = [x, y];
          prevCubicControl = null;
          prevQuadControl = [cpx, cpy];
        }
        break;
      }
      case 'T': {
        for (let i = 0; i < data.length; i += 2) {
          const cp = prevQuadControl ? reflect(current, prevQuadControl) : current;
          const x = data[i];
          const y = data[i + 1];
          normalized.push(['Q', cp[0], cp[1], x, y]);
          current = [x, y];
          prevCubicControl = null;
          prevQuadControl = cp;
        }
        break;
      }
      case 'A': {
        for (let i = 0; i < data.length; i += 7) {
          const rx = data[i];
          const ry = data[i + 1];
          const rotation = data[i + 2];
          const largeArcFlag = data[i + 3];
          const sweepFlag = data[i + 4];
          const x = data[i + 5];
          const y = data[i + 6];
          normalized.push([
            'A',
            rx,
            ry,
            rotation,
            largeArcFlag,
            sweepFlag,
            x,
            y,
          ]);
          current = [x, y];
          prevCubicControl = null;
          prevQuadControl = null;
        }
        break;
      }
      case 'Z': {
        normalized.push(['Z']);
        current = [...subpathStart];
        prevCubicControl = null;
        prevQuadControl = null;
        break;
      }
      default: {
        normalized.push([type, ...data]);
        prevCubicControl = null;
        prevQuadControl = null;
      }
    }
  });

  return normalized;
}

/** 锚点 ↔ 控制柄连线（局部坐标），用于编辑时绘制虚线。 */
export type PathHandleLineSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/**
 * 与 tldraw 立方贝塞尔示例一致：C 段为 start→cp1、end→cp2；Q 段为 start→cp。
 */
export function collectPathHandleLineSegments(
  commands: PathCommand[],
): PathHandleLineSegment[] {
  const segments: PathHandleLineSegment[] = [];
  let current: [number, number] = [0, 0];
  let subpathStart: [number, number] = [0, 0];

  for (const command of commands) {
    const type = command[0];
    if (type === 'M') {
      const x = command[1];
      const y = command[2];
      current = [x, y];
      subpathStart = [x, y];
    } else if (type === 'L') {
      const x = command[1];
      const y = command[2];
      current = [x, y];
    } else if (type === 'C') {
      const cp1x = command[1];
      const cp1y = command[2];
      const cp2x = command[3];
      const cp2y = command[4];
      const x = command[5];
      const y = command[6];
      segments.push({
        x1: current[0],
        y1: current[1],
        x2: cp1x,
        y2: cp1y,
      });
      segments.push({
        x1: x,
        y1: y,
        x2: cp2x,
        y2: cp2y,
      });
      current = [x, y];
    } else if (type === 'Q') {
      const cpx = command[1];
      const cpy = command[2];
      const x = command[3];
      const y = command[4];
      segments.push({
        x1: current[0],
        y1: current[1],
        x2: cpx,
        y2: cpy,
      });
      current = [x, y];
    } else if (type === 'Z') {
      current = [...subpathStart];
    } else if (type === 'A') {
      const x = command[6];
      const y = command[7];
      current = [x, y];
    }
  }

  return segments;
}

export function collectPathControlHandles(commands: PathCommand[]): HandlePoint[] {
  const handles: HandlePoint[] = [];

  commands.forEach((command, commandIndex) => {
    const type = command[0];
    if (type === 'M' || type === 'L') {
      handles.push({
        x: command[1],
        y: command[2],
        meta: { commandIndex, coordOffset: 1 },
      });
      return;
    }

    if (type === 'Q') {
      handles.push({
        x: command[1],
        y: command[2],
        meta: { commandIndex, coordOffset: 1 },
      });
      handles.push({
        x: command[3],
        y: command[4],
        meta: { commandIndex, coordOffset: 3 },
      });
      return;
    }

    if (type === 'C') {
      handles.push({
        x: command[1],
        y: command[2],
        meta: { commandIndex, coordOffset: 1 },
      });
      handles.push({
        x: command[3],
        y: command[4],
        meta: { commandIndex, coordOffset: 3 },
      });
      handles.push({
        x: command[5],
        y: command[6],
        meta: { commandIndex, coordOffset: 5 },
      });
      return;
    }

    if (type === 'A') {
      handles.push({
        x: command[6],
        y: command[7],
        meta: { commandIndex, coordOffset: 6 },
      });
    }
  });

  return handles;
}

export function setPathHandlePoint(
  commands: PathCommand[],
  meta: PathControlHandleMeta,
  x: number,
  y: number,
) {
  const command = commands[meta.commandIndex];
  if (!command) {
    return;
  }
  command[meta.coordOffset] = x;
  command[meta.coordOffset + 1] = y;
}

export function toPathData(commands: PathCommand[]) {
  return path2String(commands as any);
}
