import type { Metadata, Viewport } from "next";
import { BIS_PRODUCTION_ORIGIN } from "@/lib/auth-redirect";
import "./globals.css";
import "./brand.css";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import "./learning/programme-player.css";
import "./habit-lab/focused-runtime.css";
import "./responsive-readiness.css";
import "./learning/handbook-presentation.css";

const metadataBase = new URL(BIS_PRODUCTION_ORIGIN);

export const metadata: Metadata = {
  metadataBase,
  applicationName: "BIS",
  appleWebApp: { capable: true, title: "BIS", statusBarStyle: "default" },
  title: {
    default: "BIS — Behaviour Intelligence Series",
    template: "%s · BIS",
  },
  description:
    "Investigate habits, decisions and spending behaviour through private evidence from your own life.",
  openGraph: {
    url: BIS_PRODUCTION_ORIGIN,
    siteName: "BIS",
    title: "BIS — Behaviour Intelligence Series",
    description:
      "Investigate a pattern. Test it in real life. Evidence before judgment.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "BIS — Behaviour Intelligence Series, Applied Commerce",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BIS — Behaviour Intelligence Series",
    description:
      "Investigate a pattern. Test it in real life. Evidence before judgment.",
    images: ["/og.png"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/brand/bis-icon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/brand/bis-icon-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = { themeColor: "#173f35", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA">
      <body className="antialiased"><PwaProvider>{children}</PwaProvider></body>
    </html>
  );
}
