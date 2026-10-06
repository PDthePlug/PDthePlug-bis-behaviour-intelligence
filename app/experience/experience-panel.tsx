"use client";
import Link from "next/link";
import { experiences, SettingsStatus, useProfileSettings } from "../settings/use-profile-settings";
export function ExperiencePanel() {
  const state = useProfileSettings();
  return <main className="settings-page experience-page"><header className="settings-header"><Link href="/profile">Profile</Link><h1>My experience</h1><SettingsStatus state={state} /></header>
    <fieldset className="experience-options" disabled={state.disabled}><legend>Context</legend>{experiences.map(item => <label key={item.value}><span>{item.label}</span><input type="radio" name="experience" value={item.value} checked={state.edition === item.value} onChange={() => void state.persist({ deliveryEdition: item.value })}/></label>)}</fieldset>
  </main>;
}
