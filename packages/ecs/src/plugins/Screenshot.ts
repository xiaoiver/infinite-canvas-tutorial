import { system, component } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from '../components';
import { ExportSVG, MeshPipeline } from '../systems';

export const ScreenshotPlugin: Plugin = () => {
  component(RasterScreenshotRequest);
  component(VectorScreenshotRequest);
  component(Screenshot);

  system((s) => s.after(MeshPipeline))(ExportSVG);
};
