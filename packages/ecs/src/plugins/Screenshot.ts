import { component, system } from '@lastolivegames/becsy';
import { Plugin } from '.';
import { App } from '../App';
import {
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from '../components';
import { ExportSVG, MeshPipeline } from '../systems';

export const ScreenshotPlugin: Plugin = (app: App) => {
  component(RasterScreenshotRequest);
  component(VectorScreenshotRequest);
  component(Screenshot);

  system((s) => s.after(MeshPipeline))(ExportSVG);
};
