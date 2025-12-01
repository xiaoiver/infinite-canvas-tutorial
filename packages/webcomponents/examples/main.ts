import {
  App,
  svgElementsToSerializedNodes,
  svgSvgElementToComputedCamera,
  DefaultPlugins,
  Pen,
  Task,
  CheckboardStyle,
  BrushType,
} from '../../ecs';
import { Event, UIPlugin } from '../src';
import '../src/spectrum';
import WebFont from 'webfontloader';

WebFont.load({
  google: {
    families: ['Gaegu'],
  },
});

const res = await fetch('/test.svg');
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
// const nodes = svgElementsToSerializedNodes(
//   Array.from($svg.children) as SVGElement[],
// );

// console.log('nodes', nodes);

const canvas = document.querySelector<HTMLElement>('#canvas1')!;
canvas.addEventListener(Event.READY, async (e) => {
  const api = e.detail;

  // Generate sinewave geometry
  // const maxRadius = (1 / 3) * 100;
  // const segmentCount = 32;

  // const position: [number, number][] = [];
  // const radius: number[] = [];

  // const gr = (1 + Math.sqrt(5)) / 2; // golden ratio
  // const pi = Math.PI;

  // for (let i = 0; i <= segmentCount; ++i) {
  //   let a = i / segmentCount;
  //   let x = -pi + 2 * pi * a;
  //   let y = Math.sin(x) / gr;
  //   let r = Math.cos(x / 2.0) * maxRadius;

  //   position.push([x * 100, y * 100]);
  //   radius.push(r);
  // }

  const nodes = [
    // {
    //   id: '1',
    //   name: 'A swimming dog',
    //   type: 'rect',
    //   fill: 'red',
    //   x: 100,
    //   y: 100,
    //   width: 100,
    //   height: 100,
    // } as const,
    // {
    //   id: '2',
    //   name: 'A swimming dog',
    //   type: 'rect',
    //   fill: 'green',
    //   x: 300,
    //   y: 100,
    //   width: 100,
    //   height: 100,
    // } as const,
    // {
    //   id: '3',
    //   type: 'html',
    //   editable: true,
    //   html: '<div style="background-color: red; height: 100%; width: 100%;">hello <input type="text" /></div>',
    //   x: 400,
    //   y: 100,
    //   width: 100,
    //   height: 100,
    // } as const,
    // {
    //   id: '4',
    //   type: 'embed',
    //   url: 'https://www.youtube.com/watch?v=37fvFffAmf8',
    //   x: 500,
    //   y: 100,
    //   width: 800,
    //   height: 450,
    //   lockAspectRatio: true,
    // } as const,
    {
      id: '1',
      name: 'A swimming dog',
      type: 'rect',
      fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
      // fill: 'red',
      x: 100,
      y: 100,
      width: 400,
      height: 400,
      lockAspectRatio: true,
      filter: 'brightness(0.4)',
    } as const,
    // {
    //   id: '2',
    //   name: 'A swimming cat',
    //   type: 'rect',
    //   fill: 'https://v3b.fal.media/files/b/koala/0RQAsrw5rRX015XQUd4HX.jpg',
    //   x: 200 + 1200,
    //   y: 150,
    //   width: 1024,
    //   height: 1024,
    //   lockAspectRatio: true,
    // } as const,
    // {
    //   id: '3',
    //   name: 'A swimming dog without background',
    //   type: 'rect',
    //   fill: 'https://v3b.fal.media/files/b/panda/Xo61xntJdsl8_txn9WC-5.jpg',
    //   x: 200 + 2400,
    //   y: 150,
    //   width: 1024,
    //   height: 1024,
    //   lockAspectRatio: true,
    // } as const,
    // {
    //   id: '4',
    //   type: 'text',
    //   name: 'Enter your desired modifications in Chat.',
    //   fill: 'black',
    //   content: 'Enter your desired modifications in Chat.',
    //   fontSize: 66,
    //   fontFamily: 'Gaegu',
    //   anchorX: 200,
    //   anchorY: 100,
    // } as const,
    // {
    //   id: '5',
    //   type: 'text',
    //   name: 'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    //   fill: 'black',
    //   content:
    //     'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    //   fontSize: 66,
    //   fontFamily: 'Gaegu',
    //   anchorX: 200,
    //   anchorY: 1300,
    // } as const,
    // {
    //   id: '6',
    //   type: 'polyline',
    //   fill: 'none',
    //   points:
    //     '200,1676.46 228.35,1598.48 270.88,1531.14 295.69,1499.24 324.05,1474.43 359.49,1460.25 394.94,1453.16 437.47,1453.16 476.46,1460.25 511.90,1477.97 604.06,1555.95 703.30,1616.20 742.29,1619.75 760.01,1587.85 752.92,1552.40 752.92,1513.42 742.29,1470.88 724.57,1438.98 713.93,1400 682.03,1417.72 565.07,1573.67 504.81,1619.75 430.38,1655.19 355.95,1680 238.98,1683.55 224.81,1648.10 277.97,1594.94 313.42,1591.39 309.87,1626.84 274.43,1633.93 256.71,1602.03',
    //   stroke: '#147af3',
    //   strokeWidth: 18,
    // } as const,
    // {
    //   id: '7',
    //   type: 'rect',
    //   name: 'A dog with a hand-drawn fish',
    //   fill: 'https://v3.fal.media/files/penguin/9UH5Fgin7zc1u6NGGItGB.jpeg',
    //   x: 1400,
    //   y: 1400,
    //   width: 1408,
    //   height: 736,
    // } as const,
    // {
    //   id: '8',
    //   type: 'polyline',
    //   fill: 'none',
    //   points: '1100,1400 1215.69,1461.46 1324.16,1537.39',
    //   stroke: '#147af3',
    //   strokeWidth: 18,
    //   strokeLinecap: 'round',
    //   strokeLinejoin: 'round',
    //   markerEnd: 'line',
    // },
    // {
    //   id: '9',
    //   type: 'text',
    //   name: 'Smart inpainting & outpainting are on the way.',
    //   fill: 'black',
    //   content:
    //     "Smart inpainting & outpainting are on the way.\nYou can easily select the tennis ball in dog's mouth and replace it with a golf ball.\nAlternatively, you can resize the image by dragging it and add more content inside.",
    //   fontSize: 66,
    //   fontFamily: 'Gaegu',
    //   anchorX: 200,
    //   anchorY: 2300,
    // } as const,
    // {
    //   id: '3',
    //   type: 'rough-polyline',
    //   points: '200,150 300,150 300,250 200,250',
    //   stroke: 'red',
    //   strokeWidth: 10,
    // },
    // {
    //   id: '1',
    //   type: 'vector-network',
    //   stroke: 'red',
    //   strokeWidth: 10,
    //   vertices: [
    //     { x: 100, y: 100 },
    //     { x: 200, y: 200 },
    //     { x: 300, y: 200 },
    //   ],
    //   segments: [
    //     {
    //       start: 0,
    //       end: 1,
    //     },
    //     {
    //       start: 1,
    //       end: 2,
    //     },
    //   ],
    // } as const,
    // {
    //   id: '1',
    //   type: 'polyline',
    //   stroke: 'red',
    //   strokeWidth: 10,
    //   points: '100,100 200,200 300,200',
    // } as const,
    // {
    //   id: '1',
    //   type: 'text',
    //   fill: 'black',
    //   content: 'Hello world',
    //   fontSize: 16,
    //   fontFamily: 'system-ui',
    //   textAlign: 'center',
    //   anchorX: 100,
    //   anchorY: 100,
    // },
    // {
    //   id: '1',
    //   type: 'brush',
    //   points: position.map(([x, y], i) => `${x},${y},${radius[i]}`).join(' '),
    //   brushType: BrushType.STAMP,
    //   brushStamp: '/brush.jpg',
    //   stroke: 'red',
    //   strokeOpacity: 1,
    //   // wireframe: true,
    // },
  ];

  api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
  };

  // api.runAtNextTick(() => {
  api.setAppState({
    cameraX: 0,
    // cameraZoom: 0.35,
    // penbarSelected: Pen.VECTOR_NETWORK,
    penbarSelected: Pen.SELECT,
    penbarText: {
      ...api.getAppState().penbarText,
      fontFamily: 'system-ui',
      fontFamilies: ['system-ui', 'serif', 'monospace', 'Gaegu'],
    },
    taskbarAll: [
      // Task.SHOW_CHAT_PANEL,
      Task.SHOW_LAYERS_PANEL,
      Task.SHOW_PROPERTIES_PANEL,
    ],
    // taskbarSelected: [Task.SHOW_CHAT_PANEL, Task.SHOW_LAYERS_PANEL],
    // taskbarChatMessages: [
    //   {
    //     role: 'user',
    //     content:
    //       "An action shot of a black lab swimming in an inground suburban swimming pool. The camera is placed meticulously on the water line, dividing the image in half, revealing both the dogs head above water holding a tennis ball in it's mouth, and it's paws paddling underwater.",
    //   },
    //   {
    //     role: 'assistant',
    //     content: 'Sure! Here is your image:',
    //     images: [
    //       {
    //         url: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    //       },
    //     ],
    //     suggestions: [
    //       {
    //         text: 'Replace the puppy with a kitten.',
    //       },
    //       {
    //         text: 'Remove the background.',
    //       },
    //     ],
    //   },
    // ],
    checkboardStyle: CheckboardStyle.GRID,
    snapToPixelGridEnabled: true,
    snapToPixelGridSize: 1,
    // snapToObjectsEnabled: true,
    // checkboardStyle: CheckboardStyle.NONE,
    // penbarSelected: Pen.SELECT,
    // topbarVisible: false,
    // contextBarVisible: false,
    // penbarVisible: false,
    // taskbarVisible: false,
    // rotateEnabled: false,
    // flipEnabled: false,
  });

  api.updateNodes(nodes);
  // api.selectNodes([nodes[0]]);

  // const threadId = `${Date.now()}`;
  // const commentId = `${Date.now()}`;
  // api.setThreads([
  //   {
  //     type: 'thread',
  //     id: threadId,
  //     roomId: 'my-room-id',
  //     createdAt: new Date(),
  //     comments: [
  //       {
  //         type: 'comment',
  //         threadId,
  //         id: commentId,
  //         roomId: 'my-room-id',
  //         userId: 'alicia@example.com',
  //         createdAt: new Date(),
  //         editedAt: new Date(),
  //         text: 'Hello, world!',
  //         avatar: 'https://ui-avatars.com/api/?name=Alicia',
  //       },
  //     ],
  //     metadata: {
  //       x: 500,
  //       y: 200,
  //     },
  //   },
  //   {
  //     type: 'thread',
  //     id: threadId,
  //     roomId: 'my-room-id',
  //     createdAt: new Date(),
  //     comments: [
  //       {
  //         type: 'comment',
  //         threadId,
  //         id: commentId,
  //         roomId: 'my-room-id',
  //         userId: 'alicia@example.com',
  //         createdAt: new Date(),
  //         editedAt: new Date(),
  //         text: 'Hello, world!',
  //         avatar: 'https://ui-avatars.com/api/?name=Bob',
  //       },
  //     ],
  //     metadata: {
  //       x: 600,
  //       y: 200,
  //     },
  //   },
  // ]);

  // api.record();
  // });
});

// canvas.addEventListener(Event.SCREENSHOT_DOWNLOADED, (e) => {
//   const { dataURL, svg } = e.detail;

//   console.log(dataURL, svg);
// });

// canvas.addEventListener(Event.SELECTED_NODES_CHANGED, (e) => {
//   console.log(e.detail);
// });

// canvas.addEventListener(Event.NODE_UPDATED, (e) => {
//   console.log(e.detail);
// });

// canvas.addEventListener(Event.NODES_UPDATED, (e) => {
//   console.log(e.detail);
// });

// const canvas2 = document.querySelector<HTMLElement>('#canvas2')!;
// canvas2.addEventListener(Event.READY, (e) => {
//   const api = e.detail;
//   api.setPen(Pen.SELECT);

//   const node = {
//     id: '1',
//     type: 'rect',
//     x: 100,
//     y: 100,
//     width: 100,
//     height: 100,
//     fill: 'green',
//   };
//   api.updateNodes([node]);
//   api.selectNodes([node]);
// });

try {
  const app = new App().addPlugins(...DefaultPlugins, UIPlugin);
  app.run();
} catch (e) {
  console.log(e);
}
