import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import "./globals.css";

const gaegu = Gaegu({
  variable: "--font-gaegu",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Infinite Canvas Tutorial",
  description: "Infinite Canvas Tutorial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${gaegu.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}