import {
  App,
  registerIconifyIconSet,
  svgElementsToSerializedNodes,
  svgSvgElementToComputedCamera,
  DefaultPlugins,
  Pen,
  Task,
  CheckboardStyle,
  BrushType,
  inferXYWidthHeight,
  StampMode,
  EdgeStyle,
  DefaultRendererPlugin,
  RendererPlugin,
  System,
  Commands,
  system,
  PreStartUp,
  ComputeZIndex,
  Screenshot,
  Canvas,
  Theme,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  FillSolid,
  Stroke,
  Rect,
  Visibility,
  Name,
  Opacity,
  ZIndex,
  Text,
  TextDecoration,
  Line,
  Plugin,
  ThemeMode,
  RectSerializedNode,
  TRANSFORMER_MASK_FILL_COLOR,
  TesselationMethod,
  SerializedNode,
  registerCubeLutFromText,
  GPUResource,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import { LaserPointerPlugin } from '../../plugin-laser-pointer/src';
import { EraserPlugin } from '../../plugin-eraser/src';
import { LassoPlugin } from '../../plugin-lasso/src';
import { YogaPlugin } from '../../plugin-yoga/src';
import { loadAnimation } from '../../plugin-lottie/src';
import { InitVello, VelloPipeline, registerFont } from '../../plugin-vello/src';
import '../../plugin-laser-pointer/src/spectrum';
import '../../plugin-eraser/src/spectrum';
import '../../plugin-lasso/src/spectrum';
import WebFont from 'webfontloader';

WebFont.load({
  google: {
    families: ['Gaegu'],
  },
});

const res = await fetch('/Ghostscript_Tiger.svg');
// const res = await fetch('/maslow-hierarchy.svg');
// const res = await fetch('/mindmap.svg');
// const res = await fetch('/test-camera.svg');
// const res = await fetch(
//   '/62f5208ddbc232ac973f53d9cfd91ba463c50b8bfd846349247709fe4a7a9053.svg',
// );
const svg = await res.text();
// TODO: extract semantic groups inside comments
const $container = document.createElement('div');
$container.innerHTML = svg;
const $svg = $container.children[0] as SVGSVGElement;

// const camera = svgSvgElementToComputedCamera($svg);
const nodes = svgElementsToSerializedNodes(
  Array.from($svg.children) as SVGElement[],
);
nodes[0].x = 500;

// const root = {
//   id: 'root',
//   type: 'rect',
//   x: 0,
//   y: 0,
//   width: 1000,
//   height: 1000
// };
// nodes.forEach((node) => node.parentId = root.id);
// console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // api.onchange = (e) => {
  //   const { appState, nodes } = e;
  //   console.log('selected', appState.layersSelected);
  // };

  // api.runAtNextTick(() => {
  api.setAppState({
    cameraZoom: 1,
    penbarSelected: Pen.SELECT,
    penbarAll: [
      Pen.HAND,
      Pen.SELECT,
      Pen.DRAW_RECT,
      Pen.DRAW_ELLIPSE,
      Pen.DRAW_TRIANGLE,
      Pen.DRAW_PENTAGON,
      Pen.DRAW_HEXAGON,
      Pen.DRAW_LINE,
      Pen.DRAW_ARROW,
      Pen.DRAW_ROUGH_RECT,
      Pen.DRAW_ROUGH_ELLIPSE,
      Pen.DRAW_ICONFONT,
      Pen.IMAGE,
      Pen.LASSO,
      Pen.TEXT,
      Pen.PENCIL,
      Pen.BRUSH,
      Pen.ERASER,
      Pen.LASER_POINTER,
    ],
    penbarLasso: {
      ...api.getAppState().penbarLasso,
      // mode: 'draw',
      // fill: 'none',
      // stroke: 'red',
      // strokeWidth: 2,
    },
    penbarText: {
      ...api.getAppState().penbarText,
      fontFamily: 'system-ui',
      fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
    },
    penbarPencil: {
      ...api.getAppState().penbarPencil,
      freehand: true,
    },
    taskbarAll: [
      Task.SHOW_CHAT_PANEL,
      Task.SHOW_LAYERS_PANEL,
      Task.SHOW_PROPERTIES_PANEL,
    ],
    taskbarSelected: [
      Task.SHOW_PROPERTIES_PANEL,
    ],
    propertiesPanelSectionsOpen: {
      shape: false,
      transform: false,
      layout: false,
      flexItem: true,
      effects: false,
      multiSelectAlignment: true,
      multiSelectEffects: true,
      exportSection: true,
      iconFont: true,
    },
    penbarVisible: true,
    taskbarVisible: true,
    checkboardStyle: CheckboardStyle.GRID,
    snapToPixelGridEnabled: true,
    snapToPixelGridSize: 1,
    // snapToPixelGridEnabled: false,
    // snapToPixelGridSize: 0,
    // snapToObjectsEnabled: true,
    // filter: 'brightness(0.8) noise(0.1)',
    // penbarDrawSizeLabelVisible: true,
    // penbarSelected: Pen.SELECT,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    rotateEnabled: true,
    flipEnabled: true,
    // giEnabled: true,
    // giStrength: 0.05,
    // themeMode: ThemeMode.DARK,
    // filter: 'noise(0.5)',
    // layersLassoing: ['parent'],
  });

  const path = {
    id: 'cj03l-path',
    type: 'path',
    d: 'M150 0 L121 90 L198 35 L102 35 L179 90 Z',
    fill: 'black',
    fillRule: 'evenodd',
    // wireframe: true,
    tessellationMethod: TesselationMethod.LIBTESS,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 0,
    filter:
      'liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)',
  }

  /** 对齐 https://shaders.paper.design 的 `<LiquidMetal image=… fit=contain … />` 典型参数（ ecs 的 filter 串无 speed/scale/fit，由节点尺寸与 fill 位图体现）。 */
  const image = {
    id: 'cj03l-image',
    type: 'rect',
    width: 400,
    height: 300,
    x: 0,
    y: 0,
    // fill: 'https://shaders.paper.design/images/logos/diamond.svg',
    fill: "/soundboard.heic",
    // fill: 'black',
    zIndex: 2,
  } as const;

  const BlenderIcon = {
    id: 'blender-icon-material-icon-theme',
    type: 'iconfont' as const,
    x: 50,
    y: 50,
    width: 32,
    height: 32,
    zIndex: 1,
    iconFontName: 'android',
    iconFontFamily: 'material-icon-theme',
    lockAspectRatio: true,
  };

  const AndroidIcon = {
    id: 'android-icon-material-icon-theme',
    type: 'iconfont' as const,
    x: 300,
    y: 300,
    width: 100,
    height: 100,
    zIndex: 1,
    iconFontName: 'atom',
    iconFontFamily: 'lucide',
    lockAspectRatio: true,
  };


  api.setAppState({
    penbarNameLabelVisible: true,
    variables: {
      // 避免用 #FFFFFF：默认画布背景为浅色（如 #fbfbfb），白填充/白描边会几乎看不见
      '--primary': { type: 'color', value: '#FF8400' },
      '--primary-foreground': { type: 'color', value: '#111111' },
      '--radius-pill': { type: 'number', value: 999 },
    },
  });

  {
    const m = await import('@iconify/json/json/lucide.json');
    registerIconifyIconSet('lucide', m);
  }
  {
    const m = await import('@iconify/json/json/material-icon-theme.json');
    registerIconifyIconSet('material-icon-theme', m);
  }

  const button1 = {
    id: 'icon-button',
    type: 'rect',
    name: 'Button/Default',
    x: 100,
    y: 100,
    fill: 'grey',
    display: 'flex',
    padding: [16, 16],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    cornerRadius: 30,
    gap: 4,
    zIndex: 0,
    reusable: true,
  } as const;

  const SearchIcon = {
    id: 'icon-button-icon',
    parentId: 'icon-button',
    type: 'iconfont' as const,
    zIndex: 1,
    iconFontName: 'search',
    iconFontFamily: 'lucide',
    stroke: 'white',
    strokeWidth: 2,
    width: 32,
    height: 32,
    lockAspectRatio: true,
  };

  const text1 = {
    id: 'icon-button-text',
    parentId: 'icon-button',
    type: 'text',
    content: 'Button',
    fontFamily: 'system-ui',
    fontSize: 24,
    lineHeight: 32,
    fill: 'white',
    zIndex: 1,
    textAlign: 'center',
    textBaseline: 'middle',
    // wordWrap: true,
    // wordWrapWidth: 100,
    // maxLines: 1,
    // textOverflow: 'ellipsis',
  };

  const button2 = {
    id: 'icon-button-variant-destructive',
    type: 'ref',
    ref: 'icon-button',
    name: 'Button/Destructive',
    x: 100,
    y: 250,
    fill: 'red',
    zIndex: 0,
    descendants: {
      'icon-button-icon': {
        iconFontName: 'circle-alert',
      },
      'icon-button-text': {
        content: 'Destructive',
      },
    },
  };

  const button3 = {
    id: 'icon-button-variant-liquid-metal',
    type: 'ref',
    ref: 'icon-button',
    name: 'Button/LiquidMetal',
    x: 100,
    y: 350,
    fill: 'black',
    zIndex: 0,
    descendants: {
      'icon-button-icon': {
        iconFontName: 'sparkles',
      },
      'icon-button-text': {
        fill: 'white',
        content: 'Liquid Metal',
      },
    },
    filter: 'liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)',
  };

  const button4 = {
    id: 'icon-button-variant-liquid-heatmap',
    type: 'ref',
    ref: 'icon-button',
    name: 'Button/Heatmap',
    x: 100,
    y: 450,
    fill: 'black',
    zIndex: 0,
    descendants: {
      'icon-button-icon': {
        iconFontName: 'sparkles',
      },
      'icon-button-text': {
        fill: 'white',
        content: 'Heatmap',
        wordWrap: false,
      },
    },
    filter: 'heat-map(0.5, 0, 0, 0.5, 0.5, 1, 1, auto, #000000, #112069, #1f3ca3, #3265e7, #6bd8ff, #ffe77a, #ff9a1f, #ff4d00)',
  };

  const logo = {
    id: 'logo',
    type: 'rect',
    fill: '/youmind.svg',
    width: 990,
    height: 140,
    x: 100,
    y: 100,
    zIndex: 0,
    lockAspectRatio: true,
    filter: 'liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)',
  }

  const icon = {
    id: 'icon',
    type: 'iconfont',
    iconFontName: 'claude',
    iconFontFamily: 'material-icon-theme',
    width: 320,
    height: 320,
    x: 100,
    y: 100,
    zIndex: 1,
    strokeWidth: 0,
    lockAspectRatio: true,
    filter: 'liquid-metal(2, 0.1, 0.3, 0.3, 0.07, 0.4, 70, 3, 1, transparent, #ffffff, auto, 1)',
  }

  const rect = {
    id: 'rect',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    width: 400,
    height: 400,
    // stroke: 'linear-gradient(to right, red, blue)',
    strokeWidth: 10,
    x: 100,
    y: 100,
    zIndex: 1,
    // 逻辑名 `fuji` 需在下方 `registerCubeLutFromText(device, "fuji", …)` 中注册
    filter: 'lut(fuji-classic-neg, 0.2)',
  }

  const device = api.getCanvas().read(GPUResource).device;
  {
    const lutFileUrl = './FLog2C_to_CLASSIC-Neg_VLog.cube';
    const text = await (await fetch(lutFileUrl)).text()
    registerCubeLutFromText(device, 'fuji-classic-neg', text, {
      atlasFormat: 'f16',
    });
  }
  {
    const lutFileUrl = './FLog2C_to_CLASSIC-CHROME_VLog.cube';
    const text = await (await fetch(lutFileUrl)).text()
    registerCubeLutFromText(device, 'fuji-classic-chrome', text, {
      atlasFormat: 'f16',
    });
  }
  {
    const lutFileUrl = './L-Log_to_Classic_VLog.cube';
    const text = await (await fetch(lutFileUrl)).text()
    registerCubeLutFromText(device, 'leica-classic', text, {
      atlasFormat: 'f16',
    });
  }
  {
    const lutFileUrl = './L-Log_to_Natural_VLog.cube';
    const text = await (await fetch(lutFileUrl)).text()
    registerCubeLutFromText(device, 'leica-natural', text, {
      atlasFormat: 'f16',
    });
  }

  api.runAtNextTick(() => {
    api.updateNodes([
      rect
      // logo,
      // icon
      // button1, SearchIcon, text1,
      // button2,
      // button3,
      // button4
    ]);
  });

  // fetch('/gradient-text.json').then(res => res.json()).then(data => {
  //   const animation = loadAnimation(data, {
  //     loop: true,
  //     autoplay: true,
  //   });

  //   api.runAtNextTick(() => {
  //     animation.render(api);
  //     animation.play();
  //   });
  // });
});

// const VelloRendererPlugin = RendererPlugin.configure({
//   setupDeviceSystemCtor: InitVello,
//   rendererSystemCtor: VelloPipeline,
// });
// DefaultPlugins.splice(DefaultPlugins.indexOf(DefaultRendererPlugin), 1, VelloRendererPlugin);
// // registerFont('/Gaegu-Regular.ttf');
// registerFont('/NotoSansCJKsc-VF.ttf');
// registerFont('/NotoSans-Regular.ttf');
// registerFont('/NotoSans-Bold.ttf');
// registerFont('/NotoSans-Italic.ttf');
// registerFont('/NotoSansArabic.ttf');

try {
  const app = new App().addPlugins(
    ...DefaultPlugins,
    UIPlugin,
    EraserPlugin,
    LaserPointerPlugin,
    LassoPlugin,
    YogaPlugin
  );
  app.run();
} catch (e) {
  console.log(e);
}
