import { NodeSerializedNode } from "../serialize";
import { EdgeState } from "./connection";
import { DIRECTION_EAST, DIRECTION_MASK_EAST, DIRECTION_MASK_NONE, DIRECTION_MASK_NORTH, DIRECTION_MASK_SOUTH, DIRECTION_MASK_WEST, DIRECTION_NORTH, DIRECTION_SOUTH, DIRECTION_WEST } from "./constants";

export function getPortConstraints(terminal: NodeSerializedNode, edge: EdgeState, source: boolean, defaultValue: number) {
  const value = terminal.portConstraint ?? (source ? edge.sourcePortConstraint : edge.targetPortConstraint) ?? null;

  if (value == null) {
    return defaultValue;
  } else {
    const directions = value.toString();
    let returnValue = DIRECTION_MASK_NONE;
    // let constraintRotationEnabled = mxUtils.getValue(terminal.style, STYLE_PORT_CONSTRAINT_ROTATION, 0);
    const rotation = 0;

    // if (constraintRotationEnabled == 1)
    // {
    //   rotation = mxUtils.getValue(terminal.style, STYLE_ROTATION, 0);
    // }

    let quad = 0;
    if (rotation > 45) {
      quad = 1;

      if (rotation >= 135) {
        quad = 2;
      }
    }
    else if (rotation < -45) {
      quad = 3;

      if (rotation <= -135) {
        quad = 2;
      }
    }

    if (directions.indexOf(DIRECTION_NORTH) >= 0) {
      switch (quad) {
        case 0:
          returnValue |= DIRECTION_MASK_NORTH;
          break;
        case 1:
          returnValue |= DIRECTION_MASK_EAST;
          break;
        case 2:
          returnValue |= DIRECTION_MASK_SOUTH;
          break;
        case 3:
          returnValue |= DIRECTION_MASK_WEST;
          break;
      }
    }
    if (directions.indexOf(DIRECTION_WEST) >= 0) {
      switch (quad) {
        case 0:
          returnValue |= DIRECTION_MASK_WEST;
          break;
        case 1:
          returnValue |= DIRECTION_MASK_NORTH;
          break;
        case 2:
          returnValue |= DIRECTION_MASK_EAST;
          break;
        case 3:
          returnValue |= DIRECTION_MASK_SOUTH;
          break;
      }
    }
    if (directions.indexOf(DIRECTION_SOUTH) >= 0) {
      switch (quad) {
        case 0:
          returnValue |= DIRECTION_MASK_SOUTH;
          break;
        case 1:
          returnValue |= DIRECTION_MASK_WEST;
          break;
        case 2:
          returnValue |= DIRECTION_MASK_NORTH;
          break;
        case 3:
          returnValue |= DIRECTION_MASK_EAST;
          break;
      }
    }
    if (directions.indexOf(DIRECTION_EAST) >= 0) {
      switch (quad) {
        case 0:
          returnValue |= DIRECTION_MASK_EAST;
          break;
        case 1:
          returnValue |= DIRECTION_MASK_SOUTH;
          break;
        case 2:
          returnValue |= DIRECTION_MASK_WEST;
          break;
        case 3:
          returnValue |= DIRECTION_MASK_NORTH;
          break;
      }
    }

    return returnValue;
  }
}

export function reversePortConstraints(constraint: number): number {
  let result = 0;

  result = (constraint & DIRECTION_MASK_WEST) << 3;
  result |= (constraint & DIRECTION_MASK_NORTH) << 1;
  result |= (constraint & DIRECTION_MASK_SOUTH) >> 1;
  result |= (constraint & DIRECTION_MASK_EAST) >> 3;

  return result;
}