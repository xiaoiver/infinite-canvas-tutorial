"use client";

import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import Chat from '@/components/chat';
import Canvas from '@/components/canvas';
import { nanoid } from 'nanoid';
import { useAuth } from '@/contexts/auth-context';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import type { UIMessage } from 'ai';

const DEFAULT_NODES: SerializedNode[] = [
  {
    id: '1',
    name: 'A swimming dog',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    x: 200,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '2',
    name: 'A swimming cat',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/koala/0RQAsrw5rRX015XQUd4HX.jpg',
    x: 200 + 1200,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '3',
    name: 'A swimming dog without background',
    type: 'rect',
    fill: 'https://v3b.fal.media/files/b/panda/Xo61xntJdsl8_txn9WC-5.jpg',
    x: 200 + 2400,
    y: 150,
    width: 1024,
    height: 1024,
    lockAspectRatio: true,
    version: 0,
  } as const,
  {
    id: '4',
    type: 'text',
    name: 'Enter your desired modifications in Chat.',
    fill: 'black',
    content: 'Enter your desired modifications in Chat.',
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 100,
    version: 0,
  } as const,
  {
    id: '5',
    type: 'text',
    name: 'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    fill: 'black',
    content:
      'Or select multiple images(😂 even my hand-drawn fish!) \nat once and combine them.',
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 1300,
    version: 0,
  } as const,
  {
    id: '6',
    type: 'polyline', 
    points:
      '200,1676.46 228.35,1598.48 270.88,1531.14 295.69,1499.24 324.05,1474.43 359.49,1460.25 394.94,1453.16 437.47,1453.16 476.46,1460.25 511.90,1477.97 604.06,1555.95 703.30,1616.20 742.29,1619.75 760.01,1587.85 752.92,1552.40 752.92,1513.42 742.29,1470.88 724.57,1438.98 713.93,1400 682.03,1417.72 565.07,1573.67 504.81,1619.75 430.38,1655.19 355.95,1680 238.98,1683.55 224.81,1648.10 277.97,1594.94 313.42,1591.39 309.87,1626.84 274.43,1633.93 256.71,1602.03',
    stroke: '#147af3',
    strokeWidth: 18,
    version: 0,
  } as const,
  {
    id: '7',
    type: 'rect',
    name: 'A dog with a hand-drawn fish',
    fill: 'https://v3.fal.media/files/penguin/9UH5Fgin7zc1u6NGGItGB.jpeg',
    x: 1400,
    y: 1400,
    width: 1408,
    height: 736,
    version: 0,
  } as const,
  {
    id: '8',
    type: 'polyline',
    points: '1100,1400 1215.69,1461.46 1324.16,1537.39',
    stroke: '#147af3',
    strokeWidth: 18,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    markerEnd: 'line',
    version: 0,
  },
  {
    id: '9',
    type: 'text',
    name: 'Smart inpainting & outpainting are on the way.',
    fill: 'black',
    content:
      "Smart inpainting & outpainting are on the way.\nYou can easily select the tennis ball in dog's mouth and replace it with a golf ball.\nAlternatively, you can resize the image by dragging it and add more content inside.",
    fontSize: 66,
    fontFamily: 'Gaegu',
    anchorX: 200,
    anchorY: 2300,
    version: 0,
  } as const,
];

const DEFAULT_MESSAGES: UIMessage[] = [
  {
    id: nanoid(),
    role: "user",
    parts: [
      {
        type: "text",
        text: "Can you explain how to use React hooks effectively?",
      },
    ],
  },
  {
    id: nanoid(),
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "React hooks are a powerful feature that let you use state and other React features without writing classes. Here are some tips for using them effectively:",
      },
    ],
  },
];

export default function HomeClient() {
  const { user, loading } = useAuth();
  const authT = useTranslations('auth');
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden">
      <div className="flex-1 h-full">
        <Canvas initialData={DEFAULT_NODES}/>
      </div>
      <div className="w-[400px] h-full flex flex-col relative">
        <Chat initialMessages={DEFAULT_MESSAGES} />
        {!loading && !user && (
          <div className="absolute inset-0 bg-background/10 backdrop-blur-xs flex items-center justify-center z-50">
            <div className="bg-card border rounded-lg p-6 max-w-sm mx-4 text-center shadow-lg">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {authT('loginRequired')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {authT('loginToUseChat')}
              </p>
              <Button onClick={handleLogin} className="w-full">
                {authT('login')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}