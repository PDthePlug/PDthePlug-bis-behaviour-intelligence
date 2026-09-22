"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { usePwaInstall } from "./pwa-provider";

export function InstallCard() {
  const { installed, available, install } = usePwaInstall();
  const [error, setError] = useState("");
  if (installed) return null;
  return <article className="profile-card">
    <div className="profile-card-icon"><Download aria-hidden="true" /></div>
    <div><p className="profile-label">BIS on your device</p><h2>A place on your home screen</h2></div>
    <p>Open your learning space directly. A connection is needed to load and save your work.</p>
    {available ? <button className="profile-secondary" type="button" onClick={() => { setError(""); void install().catch(() => setError("Use your browser menu to install BIS or add it to your home screen.")); }}>Install BIS</button> : <p>On Android, open your browser menu and choose Install app or Add to Home screen. On iPhone, use Safari’s Share menu, then Add to Home Screen.</p>}
    {error ? <p role="status">{error}</p> : null}
  </article>;
}
