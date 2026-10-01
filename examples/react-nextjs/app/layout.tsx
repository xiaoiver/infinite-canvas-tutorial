import type { ReactNode } from 'react';
import './style.css';

export const metadata = { title: 'React canvas with Next.js' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
