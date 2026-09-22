import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BIS — Behaviour Intelligence Series",
    short_name: "BIS",
    description: "Every habit tells a story. Let's discover yours.",
    start_url: "/habit",
    scope: "/",
    display: "standalone",
    background_color: "#f4f2ed",
    theme_color: "#173f35",
    lang: "en-ZA",
    categories: ["education"],
    prefer_related_applications: false,
    icons: [
      { src: "/brand/bis-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/bis-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/bis-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/habit" },
      { name: "Learning library", url: "/learn" },
    ],
  };
}
