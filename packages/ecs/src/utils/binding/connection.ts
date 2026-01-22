import { BindingAttributes, ConstraintAttributes, SerializedNode } from "../serialize/type";
import { IPointData } from "@pixi/math";
import { getPerimeterPoint } from "./perimeter";
import { isNil } from "@antv/util";

export function getConnectionConstraint(edge: SerializedNode, terminal: SerializedNode, source: boolean): ConstraintAttributes | null {
  const point = null;

  // Constraint on edge
  // var x = edge.style[(source) ? mxConstants.STYLE_EXIT_X : mxConstants.STYLE_ENTRY_X];
	// if (x != null)
	// {
	// 	var y = edge.style[(source) ? mxConstants.STYLE_EXIT_Y : mxConstants.STYLE_ENTRY_Y];
		
	// 	if (y != null)
	// 	{
	// 		point = new mxPoint(parseFloat(x), parseFloat(y));
	// 	}
	// }

  const perimeter = false;
	const dx = 0;
	const dy = 0;
	
	// if (point != null) {
	// 	perimeter = mxUtils.getValue(edge.style, (source) ? mxConstants.STYLE_EXIT_PERIMETER :
	// 		mxConstants.STYLE_ENTRY_PERIMETER, true);

	// 	//Add entry/exit offset
	// 	dx = parseFloat(edge.style[(source) ? mxConstants.STYLE_EXIT_DX : mxConstants.STYLE_ENTRY_DX]);
	// 	dy = parseFloat(edge.style[(source) ? mxConstants.STYLE_EXIT_DY : mxConstants.STYLE_ENTRY_DY]);
		
	// 	dx = isFinite(dx)? dx : 0;
	// 	dy = isFinite(dy)? dy : 0;
	// }

	return {
    point,
    perimeter,
    dx,
    dy
  };
}

function getNextPoint(edge: SerializedNode & { absolutePoints: (IPointData | null)[] }, opposite: SerializedNode, source: boolean) {
  const pts = edge.absolutePoints;
	let point: IPointData | null = null;
	
	if (!isNil(pts) && pts.length >= 2) {
		const count = pts.length;
		point = pts[(source) ? Math.min(1, count - 1) : Math.max(0, count - 2)];
	}
	if (isNil(point) && !isNil(opposite)) {
		point = { x: opposite.x + opposite.width / 2, y: opposite.y + opposite.height / 2 };
	}
	
	return point;
}

export function getFloatingTerminalPoint(state: SerializedNode & { absolutePoints: (IPointData | null)[] }, start: SerializedNode, end: SerializedNode, source: boolean) {
  // start = getTerminalPort(state, start, source);
	const next = getNextPoint(state, end, source);
  const orth = (state as BindingAttributes).orthogonal;
  const pt = getPerimeterPoint(start, next, orth);
  return pt;
}

export function getFixedTerminalPoint(edge: SerializedNode, terminal: SerializedNode, source: SerializedNode, constraint: ConstraintAttributes) {
  let pt = null;
	// 步骤1：如果有约束，通过 getConnectionPoint 计算实际连接点
	if (constraint !== null) {
		pt = getConnectionPoint(terminal, constraint);
	}
	
	// 步骤2：如果没有终端节点（悬空边），从边的几何信息中获取终端点
	// if (pt == null && terminal == null) {
	// 	var s = this.scale;
	// 	var tr = this.translate;
	// 	var orig = edge.origin;
	// 	var geo = this.graph.getCellGeometry(edge. cell);
	// 	pt = geo.getTerminalPoint(source);
		
	// 	if (pt != null) {
	// 		// 将相对坐标转换为绝对坐标
	// 		pt = {
	// 			x: s * (tr.x + pt.x + orig.x),
	// 			y: s * (tr.y + pt.y + orig.y)
	// 		};
	// 	}
	// }
	
	return pt;
}

export function getConnectionPoint(vertex: SerializedNode | null, constraint: ConstraintAttributes): IPointData | null {
  let point = null;
	
	// 步骤1：如果有约束点信息，计算基于约束的连接点
	if (vertex != null && constraint.point) {
    const { x, y, width, height } = vertex;
    // const cx: IPointData = { x: x + width / 2, y: y + height / 2 };

    // 步骤2：计算相对坐标的实际点位置
		// constraint.point 是相对坐标 (0-1范围)
		// constraint.dx, constraint.dy 是像素偏移
		point = {
			x: x + constraint.point[0] * width + constraint.dx,
			y: y + constraint.point[1] * height + constraint.dy
    };

    if (constraint.perimeter) {
      point = getPerimeterPoint(vertex, point, false);
    }
  }

  return point;
}

export function updateFloatingTerminalPoints(state: SerializedNode & { absolutePoints: (IPointData | null)[] }, source: SerializedNode, target: SerializedNode) {
  const pts = state.absolutePoints;

	if (!isNil(pts)) {
		const p0 = pts[0];
		const pe = pts[pts.length - 1];

		if (isNil(pe) && !isNil(target)) {
			updateFloatingTerminalPoint(state, target, source, false);
		}
		
		if (isNil(p0) && !isNil(source)) {
			updateFloatingTerminalPoint(state, source, target, true);
		}
	}
}

/**
 * Function: updateFloatingTerminalPoint
 *
 * Updates the absolute terminal point in the given state for the given
 * start and end state, where start is the source if source is true.
 * 
 * Parameters:
 * 
 * edge - <mxCellState> whose terminal point should be updated.
 * start - <mxCellState> for the terminal on "this" side of the edge.
 * end - <mxCellState> for the terminal on the other side of the edge.
 * source - Boolean indicating if start is the source terminal state.
 */
function updateFloatingTerminalPoint(edge: SerializedNode & { absolutePoints: (IPointData | null)[] }, start: SerializedNode, end: SerializedNode, source: boolean) {
  setAbsoluteTerminalPoint(edge, getFloatingTerminalPoint(edge, start, end, source), source);
}

function setAbsoluteTerminalPoint(edge: SerializedNode & { absolutePoints: (IPointData | null)[] }, point: IPointData | null, source: boolean) {
  if (source) {
    if (isNil(edge.absolutePoints)) {
      edge.absolutePoints = [];
    }
    
    if (edge.absolutePoints.length === 0) {
      edge.absolutePoints.push(point);
    } else {
      edge.absolutePoints[0] = point;
    }
  } else {
    if (isNil(edge.absolutePoints)) {
      edge.absolutePoints = [];
      edge.absolutePoints.push(null);
      edge.absolutePoints.push(point);
    } else if (edge.absolutePoints.length === 1) {
      edge.absolutePoints.push(point);
    } else {
      edge.absolutePoints[edge.absolutePoints.length - 1] = point;
    }
  }
}