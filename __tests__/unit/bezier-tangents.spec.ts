import * as curves from '../../packages/core/src/utils/curve';
import { flattenPath } from '../../packages/core/src/utils/curve/adaptive';
import { bezierTangentContract } from '../contracts/bezier-tangents';

describe('core adaptive Bezier tangents', () => {
  bezierTangentContract(curves, flattenPath);
});

import { bezierSubdivisionContract } from '../contracts/bezier-subdivision';
import { CubicBezierCurve } from '../../packages/core/src/utils/curve/cubic-bezier-curve';
bezierSubdivisionContract({ ...curves, CubicBezierCurve }, flattenPath);
