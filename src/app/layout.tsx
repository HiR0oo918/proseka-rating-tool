import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";

import "./globals.css";

const notoSans = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "プロセカレーティング",
  description:
    "ランクマッチ配点に基づく非公式レーティング。APPEND とそれ以外で別集計します。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background font-sans">
        {children}
      </body>
    </html>
  );
}
