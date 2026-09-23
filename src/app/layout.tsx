import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { OfflineStatus } from "./OfflineStatus";
import { TimeThemeController } from "@/components/shared/TimeThemeController";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Our Home",
  description: "จัดการเงินและงานบ้านของครอบครัวในที่เดียว",
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icons/icon-32.png",
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Our Home",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#607a65",
};

const timeThemeBootstrap = `(()=>{try{const h=Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Bangkok'}).format(new Date()));const t=h>=5&&h<8?'morning':h>=8&&h<11?'late-morning':h>=11&&h<14?'midday':h>=14&&h<17?'afternoon':h>=17&&h<20?'evening':h>=20&&h<23?'night':'late-night';const c={morning:'#607a65','late-morning':'#6f7653',midday:'#7c6c4f',afternoon:'#7e6b4c',evening:'#715348',night:'#081c30','late-night':'#061523'};document.documentElement.dataset.timeTheme=t;document.documentElement.style.colorScheme=t==='night'||t==='late-night'?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',c[t])}catch{}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      data-time-theme="morning"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: timeThemeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <OfflineStatus />
        <TimeThemeController />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
