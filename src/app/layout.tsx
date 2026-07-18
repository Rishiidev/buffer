import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";
import { PwaInstaller } from "@/components/pwa-installer";
import { BottomNav } from "@/components/bottom-nav";
import { RouteFade } from "@/components/route-fade";
import { DataHydrator } from "@/lib/stores/data";

export const metadata: Metadata = {
  title: "Buffer — am I on track?",
  description:
    "The study operating system for serious exam prep. Time, progress, prediction.",
  applicationName: "Buffer",
  appleWebApp: {
    capable: true,
    title: "Buffer",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-fg antialiased overscroll-none">
        <ThemeProvider>
          <ToastProvider>
            <DataHydrator />
            <RouteFade>{children}</RouteFade>
            <BottomNav />
            <PwaInstaller />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
