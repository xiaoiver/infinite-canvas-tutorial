import { IPointData } from "@pixi/math";
import { NodeSerializedNode } from "../serialize";
import { EdgeState } from "./connection";
import { DIRECTION_MASK_ALL, DIRECTION_MASK_EAST, DIRECTION_MASK_NORTH, DIRECTION_MASK_SOUTH, DIRECTION_MASK_WEST } from "./constants";
import { getPortConstraints, reversePortConstraints } from "./port";

const SIDE_MASK = 480;
const CENTER_MASK = 512;
const SOURCE_MASK = 1024;
const TARGET_MASK = 2048;

const orthBuffer = 10;
const limits: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0]];
const vertexSeperations: number[] = [];
const dirVectors: number[][] = [[-1, 0],
[0, -1], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]];
const wayPoints1: number[][] = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],
[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];
const routePatterns = [
  [[513, 2308, 2081, 2562], [513, 1090, 514, 2184, 2114, 2561],
  [513, 1090, 514, 2564, 2184, 2562],
  [513, 2308, 2561, 1090, 514, 2568, 2308]],
  [[514, 1057, 513, 2308, 2081, 2562], [514, 2184, 2114, 2561],
  [514, 2184, 2562, 1057, 513, 2564, 2184],
  [514, 1057, 513, 2568, 2308, 2561]],
  [[1090, 514, 1057, 513, 2308, 2081, 2562], [2114, 2561],
  [1090, 2562, 1057, 513, 2564, 2184],
  [1090, 514, 1057, 513, 2308, 2561, 2568]],
  [[2081, 2562], [1057, 513, 1090, 514, 2184, 2114, 2561],
  [1057, 513, 1090, 514, 2184, 2562, 2564],
  [1057, 2561, 1090, 514, 2568, 2308]]];

/**
 * 
 * @see https://github.com/jgraph/drawio/blob/dev/src/main/webapp/mxgraph/src/util/js#L2407C2-L2461C40
 * 
 * @example
 * ```ts
 * mxStyleRegistry.putValue(EDGESTYLE_ELBOW, ElbowConnector);
 * mxStyleRegistry.putValue(EDGESTYLE_ENTITY_RELATION, EntityRelation);
 * mxStyleRegistry.putValue(EDGESTYLE_LOOP, Loop);
 * mxStyleRegistry.putValue(EDGESTYLE_SIDETOSIDE, SideToSide);
 * mxStyleRegistry.putValue(EDGESTYLE_TOPTOBOTTOM, TopToBottom);
 * mxStyleRegistry.putValue(EDGESTYLE_ORTHOGONAL, OrthConnector);
 * mxStyleRegistry.putValue(EDGESTYLE_SEGMENT, SegmentConnector);
 * ```
 */
export enum EdgeStyle {
  /**
   * letiable: EDGESTYLE_ELBOW
   * 
   * Name of the elbow edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  ELBOW = 'elbowEdgeStyle',

  /**
   * letiable: EDGESTYLE_ENTITY_RELATION
   * 
   * Name of the entity relation edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  ENTITY_RELATION = 'entityRelationEdgeStyle',

  /**
   * letiable: EDGESTYLE_LOOP
   * 
   * Name of the loop edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  LOOP = 'loopEdgeStyle',

  /**
   * letiable: EDGESTYLE_SIDETOSIDE
   * 
   * Name of the side to side edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  SIDETOSIDE = 'sideToSideEdgeStyle',

  /**
   * letiable: EDGESTYLE_TOPTOBOTTOM
   * 
   * Name of the top to bottom edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  TOPTOBOTTOM = 'topToBottomEdgeStyle',

  /**
   * letiable: EDGESTYLE_ORTHOGONAL
   * 
   * Name of the generic orthogonal edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  ORTHOGONAL = 'orthogonalEdgeStyle',

  /**
   * letiable: EDGESTYLE_SEGMENT
   * 
   * Name of the generic segment edge style. Can be used as a string value
   * for the STYLE_EDGE style.
   */
  SEGMENT = 'segmentEdgeStyle',
}

export function orthConnector(state: EdgeState, source: NodeSerializedNode, target: NodeSerializedNode, controlHints: IPointData[], result: IPointData[]) {
  const pts = state.absolutePoints;
  const p0 = pts[0];
  const pe = pts[pts.length - 1];

  // Extract geometry information from the source and target nodes
  let sourceX = (source != null ? source.x : p0.x) as number;
  let sourceY = (source != null ? source.y : p0.y) as number;
  let sourceWidth = (source != null ? source.width : 1) as number;
  let sourceHeight = (source != null ? source.height : 1) as number;

  let targetX = (target != null ? target.x : pe.x) as number;
  let targetY = (target != null ? target.y : pe.y) as number;
  let targetWidth = (target != null ? target.width : 1) as number;
  let targetHeight = (target != null ? target.height : 1) as number;

  // Calculate jetty size
  let sourceBuffer = getJettySize(state, true);
  let targetBuffer = getJettySize(state, false);

  // Workaround for loop routing within buffer zone
  if (source !== null && target === source) {
    targetBuffer = Math.max(sourceBuffer, targetBuffer);
    sourceBuffer = targetBuffer;
  }

  const totalBuffer = targetBuffer + sourceBuffer;
  let tooShort = false;
  // Checks minimum distance for fixed points and falls back to segment connector
  if (p0 !== null && pe !== null) {
    const dx = pe.x - p0.x;
    const dy = pe.y - p0.y;
    tooShort = dx * dx + dy * dy < totalBuffer * totalBuffer;
  }

  if (tooShort) {
    // SegmentConnector(state, sourceScaled, targetScaled, controlHints, result);
    return;
  }

  // Determine the side(s) of the source and target vertices
  // that the edge may connect to
  // portConstraint [source, target]
  const portConstraint = [DIRECTION_MASK_ALL, DIRECTION_MASK_ALL]; // 默认允许所有方向
  let rotation = 0;

  if (source !== null) {
    portConstraint[0] = getPortConstraints(source, state, true, DIRECTION_MASK_ALL);
    // rotation = getValue(source.style, STYLE_ROTATION, 0);

    // //console.log('source rotation', rotation);

    // if (rotation !== 0) {
    //   let newRect = getBoundingBox(new mxRectangle(sourceX, sourceY, sourceWidth, sourceHeight), rotation);
    //   sourceX = newRect.x; 
    //   sourceY = newRect.y;
    //   sourceWidth = newRect.width;
    //   sourceHeight = newRect.height;
    // }
  }

  if (target != null) {
    portConstraint[1] = getPortConstraints(target, state, false,
      DIRECTION_MASK_ALL);
    // rotation = getValue(target.style, STYLE_ROTATION, 0);

    //console.log('target rotation', rotation);

    // if (rotation != 0)
    // {
    //   let newRect = getBoundingBox(new mxRectangle(targetX, targetY, targetWidth, targetHeight), rotation);
    //   targetX = newRect.x;
    //   targetY = newRect.y;
    //   targetWidth = newRect.width;
    //   targetHeight = newRect.height;
    // }
  }

  if (sourceWidth === 0 || sourceHeight === 0 ||
    targetWidth === 0 || targetHeight === 0) {
    return;
  }

  let dir = [0, 0];

  // Work out which faces of the vertices present against each other
  // in a way that would allow a 3-segment connection if port constraints
  // permitted.
  // geo -> [source, target] [x, y, width, height]
  let geo = [[sourceX, sourceY, sourceWidth, sourceHeight],
  [targetX, targetY, targetWidth, targetHeight]];
  let buffer = [sourceBuffer, targetBuffer];

  for (let i = 0; i < 2; i++) {
    limits[i][1] = geo[i][0] - buffer[i];
    limits[i][2] = geo[i][1] - buffer[i];
    limits[i][4] = geo[i][0] + geo[i][2] + buffer[i];
    limits[i][8] = geo[i][1] + geo[i][3] + buffer[i];
  }

  // Work out which quad the target is in
  let sourceCenX = geo[0][0] + geo[0][2] / 2.0;
  let sourceCenY = geo[0][1] + geo[0][3] / 2.0;
  let targetCenX = geo[1][0] + geo[1][2] / 2.0;
  let targetCenY = geo[1][1] + geo[1][3] / 2.0;

  let dx = sourceCenX - targetCenX;
  let dy = sourceCenY - targetCenY;

  let quad = 0;

  // 0 | 1
  // -----
  // 3 | 2

  if (dx < 0) {
    if (dy < 0) {
      quad = 2;
    } else {
      quad = 1;
    }
  } else {
    if (dy <= 0) {
      quad = 3;

      // Special case on x = 0 and negative y
      if (dx == 0) {
        quad = 2;
      }
    }
  }

  // Check for connection constraints
  let currentTerm = null;

  if (source != null) {
    currentTerm = p0;
  }

  let constraint = [[0.5, 0.5], [0.5, 0.5]];

  // The only assumed cases for the below is an unattached end, source/target has no dims in that case.
  if (!source) constraint[0] = [0, 0];   // use top-left corner (= exact p0)
  if (!target) constraint[1] = [0, 0];   // use top-left corner (= exact pe)

  for (let i = 0; i < 2; i++) {
    if (currentTerm != null) {
      constraint[i][0] = (currentTerm.x - geo[i][0]) / geo[i][2];

      if (Math.abs(currentTerm.x - geo[i][0]) <= 1) {
        dir[i] = DIRECTION_MASK_WEST;
      }
      else if (Math.abs(currentTerm.x - geo[i][0] - geo[i][2]) <= 1) {
        dir[i] = DIRECTION_MASK_EAST;
      }

      constraint[i][1] = (currentTerm.y - geo[i][1]) / geo[i][3];

      if (Math.abs(currentTerm.y - geo[i][1]) <= 1) {
        dir[i] = DIRECTION_MASK_NORTH;
      }
      else if (Math.abs(currentTerm.y - geo[i][1] - geo[i][3]) <= 1) {
        dir[i] = DIRECTION_MASK_SOUTH;
      }
    }

    currentTerm = null;

    if (target != null) {
      currentTerm = pe;
    }
  }

  let sourceTopDist = geo[0][1] - (geo[1][1] + geo[1][3]);
  let sourceLeftDist = geo[0][0] - (geo[1][0] + geo[1][2]);
  let sourceBottomDist = geo[1][1] - (geo[0][1] + geo[0][3]);
  let sourceRightDist = geo[1][0] - (geo[0][0] + geo[0][2]);

  vertexSeperations[1] = Math.max(sourceLeftDist - totalBuffer, 0);
  vertexSeperations[2] = Math.max(sourceTopDist - totalBuffer, 0);
  vertexSeperations[4] = Math.max(sourceBottomDist - totalBuffer, 0);
  vertexSeperations[3] = Math.max(sourceRightDist - totalBuffer, 0);

  //==============================================================
  // Start of source and target direction determination

  // Work through the preferred orientations by relative positioning
  // of the vertices and list them in preferred and available order

  let dirPref = [];
  let horPref = [];
  let vertPref = [];

  horPref[0] = (sourceLeftDist >= sourceRightDist) ? DIRECTION_MASK_WEST
    : DIRECTION_MASK_EAST;
  vertPref[0] = (sourceTopDist >= sourceBottomDist) ? DIRECTION_MASK_NORTH
    : DIRECTION_MASK_SOUTH;

  horPref[1] = reversePortConstraints(horPref[0]);
  vertPref[1] = reversePortConstraints(vertPref[0]);

  let preferredHorizDist = sourceLeftDist >= sourceRightDist ? sourceLeftDist
    : sourceRightDist;
  let preferredVertDist = sourceTopDist >= sourceBottomDist ? sourceTopDist
    : sourceBottomDist;

  let prefOrdering = [[0, 0], [0, 0]];
  let preferredOrderSet = false;

  // If the preferred port isn't available, switch it
  for (let i = 0; i < 2; i++) {
    if (dir[i] != 0x0) {
      continue;
    }

    if ((horPref[i] & portConstraint[i]) == 0) {
      horPref[i] = reversePortConstraints(horPref[i]);
    }

    if ((vertPref[i] & portConstraint[i]) == 0) {
      vertPref[i] = reversePortConstraints(vertPref[i]);
    }

    prefOrdering[i][0] = vertPref[i];
    prefOrdering[i][1] = horPref[i];
  }

  if (preferredVertDist > 0
    && preferredHorizDist > 0) {
    // Possibility of two segment edge connection
    if (((horPref[0] & portConstraint[0]) > 0)
      && ((vertPref[1] & portConstraint[1]) > 0)) {
      prefOrdering[0][0] = horPref[0];
      prefOrdering[0][1] = vertPref[0];
      prefOrdering[1][0] = vertPref[1];
      prefOrdering[1][1] = horPref[1];
      preferredOrderSet = true;
    }
    else if (((vertPref[0] & portConstraint[0]) > 0)
      && ((horPref[1] & portConstraint[1]) > 0)) {
      prefOrdering[0][0] = vertPref[0];
      prefOrdering[0][1] = horPref[0];
      prefOrdering[1][0] = horPref[1];
      prefOrdering[1][1] = vertPref[1];
      preferredOrderSet = true;
    }
  }

  if (preferredVertDist > 0 && !preferredOrderSet) {
    prefOrdering[0][0] = vertPref[0];
    prefOrdering[0][1] = horPref[0];
    prefOrdering[1][0] = vertPref[1];
    prefOrdering[1][1] = horPref[1];
    preferredOrderSet = true;

  }

  if (preferredHorizDist > 0 && !preferredOrderSet) {
    prefOrdering[0][0] = horPref[0];
    prefOrdering[0][1] = vertPref[0];
    prefOrdering[1][0] = horPref[1];
    prefOrdering[1][1] = vertPref[1];
    preferredOrderSet = true;
  }

  // The source and target prefs are now an ordered list of
  // the preferred port selections
  // If the list contains gaps, compact it

  for (let i = 0; i < 2; i++) {
    if (dir[i] != 0x0) {
      continue;
    }

    if ((prefOrdering[i][0] & portConstraint[i]) == 0) {
      prefOrdering[i][0] = prefOrdering[i][1];
    }

    dirPref[i] = prefOrdering[i][0] & portConstraint[i];
    dirPref[i] |= (prefOrdering[i][1] & portConstraint[i]) << 8;
    dirPref[i] |= (prefOrdering[1 - i][i] & portConstraint[i]) << 16;
    dirPref[i] |= (prefOrdering[1 - i][1 - i] & portConstraint[i]) << 24;

    if ((dirPref[i] & 0xF) == 0) {
      dirPref[i] = dirPref[i] << 8;
    }

    if ((dirPref[i] & 0xF00) == 0) {
      dirPref[i] = (dirPref[i] & 0xF) | dirPref[i] >> 8;
    }

    if ((dirPref[i] & 0xF0000) == 0) {
      dirPref[i] = (dirPref[i] & 0xFFFF)
        | ((dirPref[i] & 0xF000000) >> 8);
    }

    dir[i] = dirPref[i] & 0xF;

    if (portConstraint[i] == DIRECTION_MASK_WEST
      || portConstraint[i] == DIRECTION_MASK_NORTH
      || portConstraint[i] == DIRECTION_MASK_EAST
      || portConstraint[i] == DIRECTION_MASK_SOUTH) {
      dir[i] = portConstraint[i];
    }
  }

  //==============================================================
  // End of source and target direction determination

  let sourceIndex = dir[0] == DIRECTION_MASK_EAST ? 3
    : dir[0];
  let targetIndex = dir[1] == DIRECTION_MASK_EAST ? 3
    : dir[1];

  sourceIndex -= quad;
  targetIndex -= quad;

  if (sourceIndex < 1) {
    sourceIndex += 4;
  }

  if (targetIndex < 1) {
    targetIndex += 4;
  }

  let routePattern = routePatterns[sourceIndex - 1][targetIndex - 1];

  //console.log('routePattern', routePattern);

  wayPoints1[0][0] = geo[0][0];
  wayPoints1[0][1] = geo[0][1];

  switch (dir[0]) {
    case DIRECTION_MASK_WEST:
      wayPoints1[0][0] -= sourceBuffer;
      wayPoints1[0][1] += constraint[0][1] * geo[0][3];
      break;
    case DIRECTION_MASK_SOUTH:
      wayPoints1[0][0] += constraint[0][0] * geo[0][2];
      wayPoints1[0][1] += geo[0][3] + sourceBuffer;
      break;
    case DIRECTION_MASK_EAST:
      wayPoints1[0][0] += geo[0][2] + sourceBuffer;
      wayPoints1[0][1] += constraint[0][1] * geo[0][3];
      break;
    case DIRECTION_MASK_NORTH:
      wayPoints1[0][0] += constraint[0][0] * geo[0][2];
      wayPoints1[0][1] -= sourceBuffer;
      break;
  }

  let currentIndex = 0;

  // Orientation, 0 horizontal, 1 vertical
  let lastOrientation = (dir[0] & (DIRECTION_MASK_EAST | DIRECTION_MASK_WEST)) > 0 ? 0
    : 1;
  let initialOrientation = lastOrientation;
  let currentOrientation = 0;

  for (let i = 0; i < routePattern.length; i++) {
    let nextDirection = routePattern[i] & 0xF;

    // Rotate the index of this direction by the quad
    // to get the real direction
    let directionIndex = nextDirection == DIRECTION_MASK_EAST ? 3
      : nextDirection;

    directionIndex += quad;

    if (directionIndex > 4) {
      directionIndex -= 4;
    }

    let direction = dirVectors[directionIndex - 1];

    currentOrientation = (directionIndex % 2 > 0) ? 0 : 1;
    // Only update the current index if the point moved
    // in the direction of the current segment move,
    // otherwise the same point is moved until there is 
    // a segment direction change
    if (currentOrientation != lastOrientation) {
      currentIndex++;
      // Copy the previous way point into the new one
      // We can't base the new position on index - 1
      // because sometime elbows turn out not to exist,
      // then we'd have to rewind.
      wayPoints1[currentIndex][0] = wayPoints1[currentIndex - 1][0];
      wayPoints1[currentIndex][1] = wayPoints1[currentIndex - 1][1];
    }

    let tar = (routePattern[i] & TARGET_MASK) > 0;
    let sou = (routePattern[i] & SOURCE_MASK) > 0;
    let side = (routePattern[i] & SIDE_MASK) >> 5;
    side = side << quad;

    if (side > 0xF) {
      side = side >> 4;
    }

    let center = (routePattern[i] & CENTER_MASK) > 0;

    if ((sou || tar) && side < 9) {
      let limit = 0;
      let souTar = sou ? 0 : 1;

      if (center && currentOrientation == 0) {
        limit = geo[souTar][0] + constraint[souTar][0] * geo[souTar][2];
      }
      else if (center) {
        limit = geo[souTar][1] + constraint[souTar][1] * geo[souTar][3];
      }
      else {
        limit = limits[souTar][side];
      }

      if (currentOrientation == 0) {
        let lastX = wayPoints1[currentIndex][0];
        let deltaX = (limit - lastX) * direction[0];

        if (deltaX > 0) {
          wayPoints1[currentIndex][0] += direction[0]
            * deltaX;
        }
      }
      else {
        let lastY = wayPoints1[currentIndex][1];
        let deltaY = (limit - lastY) * direction[1];

        if (deltaY > 0) {
          wayPoints1[currentIndex][1] += direction[1]
            * deltaY;
        }
      }
    }

    else if (center) {
      // Which center we're travelling to depend on the current direction
      wayPoints1[currentIndex][0] += direction[0]
        * Math.abs(vertexSeperations[directionIndex] / 2);
      wayPoints1[currentIndex][1] += direction[1]
        * Math.abs(vertexSeperations[directionIndex] / 2);
    }

    if (currentIndex > 0
      && wayPoints1[currentIndex][currentOrientation] == wayPoints1[currentIndex - 1][currentOrientation]) {
      currentIndex--;
    }
    else {
      lastOrientation = currentOrientation;
    }
  }

  for (let i = 0; i <= currentIndex; i++) {
    if (i == currentIndex) {
      // Last point can cause last segment to be in
      // same direction as jetty/approach. If so,
      // check the number of points is consistent
      // with the relative orientation of source and target
      // jx. Same orientation requires an even
      // number of turns (points), different requires
      // odd.
      let targetOrientation = (dir[1] & (DIRECTION_MASK_EAST | DIRECTION_MASK_WEST)) > 0 ? 0
        : 1;
      let sameOrient = targetOrientation == initialOrientation ? 0 : 1;

      // (currentIndex + 1) % 2 is 0 for even number of points,
      // 1 for odd
      if (sameOrient != (currentIndex + 1) % 2) {
        // The last point isn't required
        break;
      }
    }

    result.push({
      x: wayPoints1[i][0],
      y: wayPoints1[i][1]
    });
  }

  // We use simplify-js to remove duplicates
  // Removes duplicates
  // let index = 1;

  // while (index < result.length)
  // {
  //   if (result[index - 1] == null || result[index] == null ||
  //     result[index - 1].x != result[index].x ||
  //     result[index - 1].y != result[index].y)
  //   {
  //     index++;
  //   }
  //   else
  //   {
  //     result.splice(index, 1);
  //   }
  // }
}

function getJettySize(state: EdgeState, source: boolean) {
  const { sourceJettySize, targetJettySize, jettySize } = state;
  if (source) {
    return sourceJettySize ?? jettySize ?? orthBuffer;
  } else {
    return targetJettySize ?? jettySize ?? orthBuffer;
  }

  // TODO: auto
  // @see https://github.com/jgraph/drawio/blob/8b988d670049c4cbf1713decab0e922d94533b91/src/main/webapp/mxgraph/src/view/js#L956
}