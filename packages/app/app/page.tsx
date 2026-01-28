'use client';

import Chat from '@/components/chat';
import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('../components/canvas'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center text-black">
      <div className="flex-1 h-screen">
        <Canvas />
      </div>
      <div className="w-[240px] h-screen">
        <Chat />
      </div>
    </div>
  );
}