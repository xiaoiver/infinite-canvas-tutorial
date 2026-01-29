import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}