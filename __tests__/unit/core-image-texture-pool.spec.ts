import { ImageTexturePool } from '../../packages/core/src/utils/image-texture-pool';
import { imageTexturePoolContract } from '../contracts/image-texture-pool';
imageTexturePoolContract(() => new ImageTexturePool());
