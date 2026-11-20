import {
  GlyphAtlasPool,
  glyphFontState,
} from '../../packages/ecs/src/utils/glyph/glyph-atlas-pool';
import { glyphAtlasPoolContract } from '../helpers/glyph-atlas-pool-contract';
glyphAtlasPoolContract(() => new GlyphAtlasPool());

import { glyphFontStateContract } from '../helpers/glyph-font-state-contract';
glyphFontStateContract(glyphFontState);
