"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
const InstallContext = createContext<{ installed: boolean; available: boolean; install: () => Promise<void> }>({ installed: false, available: false, install: async () => {} });
export const usePwaInstall = () => useContext(InstallContext);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const updateDisplay = () => setInstalled(display.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const frame = requestAnimationFrame(updateDisplay);
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    display.addEventListener("change", updateDisplay);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator && window.isSecureContext && window.location.hostname === "www.bisportal.online") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Installation enhancements must never block sign-in or workbook use.
        console.warn("BIS offline screen could not be prepared.");
      });
    }
    return () => {
      cancelAnimationFrame(frame);
      display.removeEventListener("change", updateDisplay);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    const current = prompt;
    setPrompt(null);
    await current.prompt();
    await current.userChoice;
  }
  return <InstallContext.Provider value={{ installed, available: Boolean(prompt), install }}>{children}</InstallContext.Provider>;
}
