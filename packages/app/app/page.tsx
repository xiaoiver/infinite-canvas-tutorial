'use client';

import { PromptInputProvider } from '@/components/ai-elements/prompt-input';
import Chat from '@/components/chat';
import dynamic from 'next/dynamic';

const Canvas = dynamic(() => import('../components/canvas'), {
  ssr: false,
});

export default function Home() {
  return (
    <PromptInputProvider>
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex-1 h-screen">
        <Canvas />
      </div>
      <div className="w-[400px] h-screen">
        <Chat />
      </div>
    </div>
    </PromptInputProvider>
  );
}