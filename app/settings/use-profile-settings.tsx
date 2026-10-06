"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PERSONALISATION, normalisePersonalisation, savePersonalisation, type LearnerPersonalisation } from "@/lib/learner-personalization";

export type DeliveryEdition = "school" | "emerging_adult" | "workplace";
export const experiences = [{ value: "school", label: "School" }, { value: "emerging_adult", label: "Emerging Adult" }, { value: "workplace", label: "Workplace" }] as const;

type Snapshot = { profile: null | { deliveryEdition?: DeliveryEdition; appearancePreference?: string; accentPreference?: string; textSizePreference?: string; readingWidthPreference?: string } };

async function profileResponse(response: Response): Promise<Snapshot> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("profile" in payload)) throw new Error("Your settings are unavailable. Try again.");
  return payload;
}

export function useProfileSettings() {
  const [personalisation, setPersonalisation] = useState(DEFAULT_PERSONALISATION);
  const [edition, setEdition] = useState<DeliveryEdition>("school");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const writing = useRef(false);

  const apply = useCallback((snapshot: Snapshot) => {
    const p = snapshot.profile;
    const next = normalisePersonalisation({ appearance: p?.appearancePreference, accent: p?.accentPreference, textSize: p?.textSizePreference, readingWidth: p?.readingWidthPreference } as Partial<LearnerPersonalisation>);
    setPersonalisation(savePersonalisation(next));
    setEdition(p?.deliveryEdition ?? "school");
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setMessage("");
    try {
      const snapshot = await profileResponse(await fetch("/api/profile", { cache: "no-store", signal }));
      if (!signal?.aborted) apply(snapshot);
    } catch {
      if (!signal?.aborted) setError("Settings could not be loaded.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [apply]);

  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);

  async function persist(body: Record<string, string>) {
    if (writing.current || loading || error) return;
    writing.current = true; setSaving(true); setMessage(""); setError("");
    const previous = personalisation;
    const previousEdition = edition;
    if ("deliveryEdition" in body) setEdition(body.deliveryEdition as DeliveryEdition);
    else setPersonalisation(savePersonalisation({ ...previous, ...body } as LearnerPersonalisation));
    try {
      const snapshot = await profileResponse(await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
      apply(snapshot); setMessage("Saved");
    } catch {
      setPersonalisation(savePersonalisation(previous));
      setEdition(previousEdition);
      setError("That setting could not be saved. Try again.");
    } finally { writing.current = false; setSaving(false); }
  }

  return { personalisation, edition, loading, saving, error, message, load, persist, disabled: loading || saving || Boolean(error) };
}

export function SettingsStatus({ state }: { state: ReturnType<typeof useProfileSettings> }) {
  return <div className="settings-status" aria-live="polite">
    {state.error ? <><span role="alert">{state.error}</span><button type="button" onClick={() => void state.load()}>Retry</button></> : state.loading ? "Loading…" : state.saving ? "Saving…" : state.message}
  </div>;
}
