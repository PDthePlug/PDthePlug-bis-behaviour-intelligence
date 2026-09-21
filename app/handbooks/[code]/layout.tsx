import type { Metadata } from "next";
export const metadata: Metadata = { title: "Learning handbook", robots: { index: false, follow: false } };
export default function HandbookLayout({ children }: { children: React.ReactNode }) { return children; }
