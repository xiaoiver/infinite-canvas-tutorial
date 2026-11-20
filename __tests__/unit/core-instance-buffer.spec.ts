import { InstanceBuffer } from '../../packages/core/src/utils/instance-buffer';
import { instanceBufferContract } from '../contracts/instance-buffer';
instanceBufferContract(
  (data, target, stride) => new InstanceBuffer(data, target, stride),
);
