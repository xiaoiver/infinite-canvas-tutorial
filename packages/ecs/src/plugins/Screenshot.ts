import { Plugin } from './types';
import {
  RasterScreenshotRequest,
  Screenshot,
  VectorScreenshotRequest,
} from '../components';
import { ExportSVG } from '../systems';

export const ScreenshotPlugin: Plugin = () => {
  return [
    RasterScreenshotRequest,
    VectorScreenshotRequest,
    Screenshot,
    ExportSVG,
  ];
};
