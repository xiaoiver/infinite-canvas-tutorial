import * as curves from '../../packages/ecs/src/utils/curve';
import { flattenPath } from '../../packages/ecs/src/utils/curve/adaptive';
import { bezierTangentContract } from '../contracts/bezier-tangents';

describe('ecs adaptive Bezier tangents', () => {
  bezierTangentContract(curves, flattenPath);
});

import { bezierSubdivisionContract } from '../contracts/bezier-subdivision';
bezierSubdivisionContract(curves, flattenPath);
