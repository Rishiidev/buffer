import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast-provider";
import { PwaInstaller } from "@/components/pwa-installer";

export const metadata: Metadata = {
  title: "Buffer — am I on track?",
  description:
    "The study operating system for serious exam prep. Time, progress, prediction.",
  applicationName: "Buffer",
  appleWebApp: {
    capable: true,
    title: "Buffer",
    statusBarStyle: "black-translucent",
    startupImage: ["/icon-512.png"],
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-fg antialiased">
        <ThemeProvider>
          <ToastProvider>
            {children}
            <PwaInstaller />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
