import { BindingAttributes, ConstraintAttributes, SerializedNode } from "../serialize/type";
import { IPointData } from "@pixi/math";
import { getPerimeterPoint } from "./perimeter";
import { isNil } from "@antv/util";

type EdgeState = SerializedNode & { absolutePoints: (IPointData | null)[] };

/**
 * Returns an <mxConnectionConstraint> that describes the given connection
 * point. This result can then be passed to <getConnectionPoint>.
 * 
 * @see https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/view/mxGraph.js#L6954
 */
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

function getNextPoint(edge: EdgeState, opposite: SerializedNode, source: boolean) {
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

export function getFloatingTerminalPoint(state: EdgeState, start: SerializedNode, end: SerializedNode, source: boolean) {
  // start = getTerminalPort(state, start, source);
	const next = getNextPoint(state, end, source);
  const orth = (state as BindingAttributes).orthogonal;
  const pt = getPerimeterPoint(start, next, orth);
  return pt;
}

export function getFixedTerminalPoint(edge: SerializedNode, terminal: SerializedNode, source: boolean, constraint: ConstraintAttributes) {
  let pt = null;
	// 步骤1：如果有约束，通过 getConnectionPoint 计算实际连接点
	if (!isNil(constraint)) {
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
	if (!isNil(vertex) && constraint.point) {
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

export function updateFloatingTerminalPoints(state: EdgeState, source: SerializedNode, target: SerializedNode) {
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
 * Updates the absolute terminal point in the given state for the given
 * start and end state, where start is the source if source is true.
 */
function updateFloatingTerminalPoint(edge: EdgeState, start: SerializedNode, end: SerializedNode, source: boolean) {
  setAbsoluteTerminalPoint(edge, getFloatingTerminalPoint(edge, start, end, source), source);
}

/**
 * Sets the fixed source or target terminal point on the given edge.
 */
function updateFixedTerminalPoint(edge: EdgeState, terminal: SerializedNode, source: boolean, constraint: ConstraintAttributes)
{
	setAbsoluteTerminalPoint(edge, getFixedTerminalPoint(edge, terminal, source, constraint), source);
}

function setAbsoluteTerminalPoint(edge: EdgeState, point: IPointData | null, source: boolean) {
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

/**
 * Updates the absolute points in the given state using the specified array
 * of Points as the relative points.
 * 
 * @see https://github.com/jgraph/drawio/blob/81a267568da862d3c99970758c09a8e768dea973/src/main/webapp/mxgraph/src/view/mxGraphView.js#L1435C1-L1448C76
 */
export function updatePoints(edge: EdgeState, points: IPointData[], source: SerializedNode, target: SerializedNode) {
  if (edge !== null && edge.absolutePoints !== null &&
		edge.absolutePoints.length > 0) {
    const pts: IPointData[] = [];
    pts.push(edge.absolutePoints[0]);

    // edgeStyle
    const edgeStyle = null;

    if (!isNil(edgeStyle)) {
      // Calculate control points based on edgeStyle
    } else if (!isNil(points)) {
      for (let i = 0; i < points.length; i++) {
        if (!isNil(points[i])) {
          const pt = { x: points[i].x, y: points[i].y };
          pts.push(transformControlPoint(edge, pt));
        }
      }
    }
      
    const tmp = edge.absolutePoints;
    pts.push(tmp[tmp.length-1]);
    edge.absolutePoints = pts;
  }
}

function transformControlPoint(state: EdgeState, pt: IPointData, ignoreScale = false): IPointData {
  if (state != null && pt != null) {
    const scaleX = ignoreScale ? 1 : (state.scaleX ?? 1);
    const scaleY = ignoreScale ? 1 : (state.scaleY ?? 1);
    
    return {
      x: scaleX * (pt.x + state.x),
      y: scaleY * (pt.y + state.y)
    };
  }
    
  return null;
}

export function updateFixedTerminalPoints(edge: EdgeState, source: SerializedNode, target: SerializedNode) {
  updateFixedTerminalPoint(edge, source, true, getConnectionConstraint(edge, source, true));
	updateFixedTerminalPoint(edge, target, false, getConnectionConstraint(edge, target, false));
}
