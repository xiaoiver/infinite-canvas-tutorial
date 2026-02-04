import type { Metadata } from "next";
import { Gaegu } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import "../globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/components/providers/theme-provider";

const gaegu = Gaegu({
  variable: "--font-gaegu",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Infinite Canvas Tutorial",
  description: "Infinite Canvas Tutorial",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Ensure that the incoming `locale` is valid
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // 获取消息，显式传递 locale 确保使用正确的语言
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} suppressHydrationWarning>
      {/** suppressHydrationWarning on body, see: https://github.com/shadcn-ui/ui/issues/6757 */}
      <body className={`${gaegu.variable} antialiased`} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              {children}
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

