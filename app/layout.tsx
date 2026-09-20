import type { Metadata } from "next";
import { BIS_PRODUCTION_ORIGIN } from "@/lib/auth-redirect";
import "./globals.css";
import "./learning/programme-player.css";
import "./habit-lab/focused-runtime.css";

const metadataBase = new URL(BIS_PRODUCTION_ORIGIN);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "BIS — Behaviour Intelligence System",
    template: "%s · BIS",
  },
  description:
    "Investigate habits, decisions and spending behaviour through private evidence from your own life.",
  openGraph: {
    url: BIS_PRODUCTION_ORIGIN,
    siteName: "BIS",
    title: "BIS — Behaviour Intelligence System",
    description:
      "Investigate a pattern. Test it in real life. Evidence before judgment.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "BIS — Understand a pattern. Test it in real life.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BIS — Behaviour Intelligence System",
    description:
      "Investigate a pattern. Test it in real life. Evidence before judgment.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-ZA">
      <body className="antialiased">{children}</body>
    </html>
  );
}
