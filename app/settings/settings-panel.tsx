"use client";

import Link from "next/link";
import { useState } from "react";
import { SettingsStatus, useProfileSettings } from "./use-profile-settings";

export function SettingsPanel() {
  const state = useProfileSettings();
  const [section, setSection] = useState("appearance");
  const p = state.personalisation;
  return <main className="settings-page">
    <header className="settings-header"><Link href="/profile">Profile</Link><h1>Settings</h1><SettingsStatus state={state} /></header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings categories">
        <button type="button" aria-current={section === "appearance" ? "page" : undefined} onClick={() => setSection("appearance")}>Appearance</button>
        <button type="button" aria-current={section === "reading" ? "page" : undefined} onClick={() => setSection("reading")}>Reading</button>
      </nav>
      <section className="settings-content" aria-label={section === "appearance" ? "Appearance" : "Reading"}>
        <h2 className="sr-only">{section === "appearance" ? "Appearance" : "Reading"}</h2>
        {section === "appearance" ? <>
          <label className="settings-row"><span>Theme</span><select value={p.appearance} disabled={state.disabled} onChange={e => void state.persist({ appearance: e.target.value })}><option value="system">System</option><option value="light">Light</option><option value="warm">Warm</option><option value="dark">Dark</option></select></label>
          <fieldset className="settings-row settings-accent"><legend>Accent colour</legend><div className="accent-options">{[{ value: "bis", label: "BIS" }, { value: "blue", label: "Blue" }, { value: "amber", label: "Amber" }, { value: "sage", label: "Sage" }].map(item => <button type="button" className={`accent-choice accent-${item.value}`} key={item.value} aria-label={item.label} title={item.label} aria-pressed={p.accent === item.value} disabled={state.disabled} onClick={() => void state.persist({ accent: item.value })}><span aria-hidden="true" /></button>)}</div></fieldset>
        </> : <>
          <label className="settings-row"><span>Text size</span><select value={p.textSize} disabled={state.disabled} onChange={e => void state.persist({ textSize: e.target.value })}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option><option value="extra_large">Extra large</option></select></label>
          <label className="settings-row"><span>Page width</span><select value={p.readingWidth} disabled={state.disabled} onChange={e => void state.persist({ readingWidth: e.target.value })}><option value="narrow">Narrow</option><option value="standard">Standard</option><option value="wide">Wide</option></select></label>
          <div className="reading-preview" style={{ fontSize: `calc(16px * var(--bis-text-scale))`, maxWidth: p.readingWidth === "narrow" ? "32ch" : p.readingWidth === "wide" ? "100%" : "42ch" }}><span>Preview</span><p>Behaviour comes before results.</p></div>
        </>}
      </section>
    </div>
  </main>;
}
