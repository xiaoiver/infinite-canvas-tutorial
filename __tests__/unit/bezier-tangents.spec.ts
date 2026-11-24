import * as curves from '../../packages/core/src/utils/curve';
import { flattenPath } from '../../packages/core/src/utils/curve/adaptive';
import { bezierTangentContract } from '../contracts/bezier-tangents';

describe('core adaptive Bezier tangents', () => {
  bezierTangentContract(curves, flattenPath);
});
