import { system, component } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from '../components';
import { Deleter, ExportSVG, Last, MeshPipeline } from '../systems';

export const ScreenshotPlugin: Plugin = () => {
  component(RasterScreenshotRequest);
  component(VectorScreenshotRequest);
  component(Screenshot);

  system(Last)(ExportSVG);
  system((s) => s.before(Deleter).after(MeshPipeline))(ExportSVG);
};
