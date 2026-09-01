import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bis-behaviour-intelligence.pdmpofu.chatgpt.site"),
  title: {
    default: "BIS — Behaviour Intelligence System",
    template: "%s · BIS",
  },
  description:
    "Understand a pattern in your behaviour by collecting evidence from your own life.",
  openGraph: {
    title: "BIS — Behaviour Intelligence System",
    description:
      "Understand a pattern. Test it in real life. Evidence before judgment.",
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
      "Understand a pattern. Test it in real life. Evidence before judgment.",
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
