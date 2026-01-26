import { IPointData } from "@pixi/math";
import { SerializedNode } from "../serialize";
import { EdgeState } from "./connection";
import { DIRECTION_MASK_ALL } from "./constants";

/**
 * 
 * @see https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/util/mxConstants.js#L2407C2-L2461C40
 * 
 * @example
 * ```ts
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ELBOW, mxEdgeStyle.ElbowConnector);
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ENTITY_RELATION, mxEdgeStyle.EntityRelation);
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_LOOP, mxEdgeStyle.Loop);
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_SIDETOSIDE, mxEdgeStyle.SideToSide);
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_TOPTOBOTTOM, mxEdgeStyle.TopToBottom);
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_ORTHOGONAL, mxEdgeStyle.OrthConnector);
 * mxStyleRegistry.putValue(mxConstants.EDGESTYLE_SEGMENT, mxEdgeStyle.SegmentConnector);
 * ```
 */
export enum EdgeStyle {
  /**
   * Variable: EDGESTYLE_ELBOW
   * 
   * Name of the elbow edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  ELBOW = 'elbowEdgeStyle',

  /**
   * Variable: EDGESTYLE_ENTITY_RELATION
   * 
   * Name of the entity relation edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  ENTITY_RELATION = 'entityRelationEdgeStyle',

  /**
   * Variable: EDGESTYLE_LOOP
   * 
   * Name of the loop edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  LOOP = 'loopEdgeStyle',

  /**
   * Variable: EDGESTYLE_SIDETOSIDE
   * 
   * Name of the side to side edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  SIDETOSIDE = 'sideToSideEdgeStyle',

  /**
   * Variable: EDGESTYLE_TOPTOBOTTOM
   * 
   * Name of the top to bottom edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  TOPTOBOTTOM = 'topToBottomEdgeStyle',

  /**
   * Variable: EDGESTYLE_ORTHOGONAL
   * 
   * Name of the generic orthogonal edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  ORTHOGONAL = 'orthogonalEdgeStyle',

  /**
   * Variable: EDGESTYLE_SEGMENT
   * 
   * Name of the generic segment edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  SEGMENT = 'segmentEdgeStyle',
}

export function orthConnector(state: EdgeState, source: SerializedNode, target: SerializedNode, controlHints: IPointData[], result: IPointData[]) {
  const pts = state.absolutePoints;
  const p0 = pts[0];
  const pe = pts[pts.length - 1];

  const sourceX = source != null ? source.x : p0.x;
  const sourceY = source != null ? source.y : p0.y;
  const sourceWidth = source != null ? source.width : 1;
  const sourceHeight = source != null ? source.height : 1;

  const targetX = target != null ? target.x : pe.x;
  const targetY = target != null ? target.y : pe.y;
  const targetWidth = target != null ? target.width : 1;
  const targetHeight = target != null ? target.height : 1;

  // Determine the side(s) of the source and target vertices
  // that the edge may connect to
  // portConstraint [source, target]
  const portConstraint = [DIRECTION_MASK_ALL, DIRECTION_MASK_ALL]; // 默认允许所有方向
  const rotation = 0;
}