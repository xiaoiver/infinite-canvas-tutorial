import { system, component } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  AnimationExportOutput,
  RasterAnimationExportRequest,
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from '../components';
import { Deleter, ExportSVG, Last } from '../systems';

export const ScreenshotPlugin: Plugin = () => {
  component(RasterScreenshotRequest);
  component(RasterAnimationExportRequest);
  component(AnimationExportOutput);
  component(VectorScreenshotRequest);
  component(Screenshot);

  system(Last)(ExportSVG);
  system((s) => s.before(Deleter))(ExportSVG);
};
