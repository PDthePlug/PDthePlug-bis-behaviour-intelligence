"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  MonitorCog,
  Palette,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  DEFAULT_PERSONALISATION,
  normalisePersonalisation,
  savePersonalisation,
  type BisAccent,
  type BisAppearance,
  type BisReadingWidth,
  type BisTextSize,
  type LearnerPersonalisation,
} from "@/lib/learner-personalization";

type DeliveryEdition = "school" | "emerging_adult" | "workplace";

type ProfileSnapshot = {
  profile?: null | {
    deliveryEdition?: DeliveryEdition;
    appearancePreference?: BisAppearance;
    accentPreference?: BisAccent;
    textSizePreference?: BisTextSize;
    readingWidthPreference?: BisReadingWidth;
  };
};

const appearances: Array<{ value: BisAppearance; label: string; detail: string }> = [
  { value: "system", label: "System", detail: "Follow your device light or dark preference." },
  { value: "light", label: "Light", detail: "A bright, clean workbook surface." },
  { value: "warm", label: "Warm", detail: "A softer paper-inspired reading surface." },
  { value: "dark", label: "Dark", detail: "A low-light reading surface." },
];

const accents: Array<{ value: BisAccent; label: string }> = [
  { value: "bis", label: "BIS" },
  { value: "blue", label: "Blue" },
  { value: "amber", label: "Amber" },
  { value: "sage", label: "Sage" },
];

const textSizes: Array<{ value: BisTextSize; label: string; sample: string }> = [
  { value: "small", label: "Small", sample: "Compact" },
  { value: "standard", label: "Standard", sample: "Comfortable" },
  { value: "large", label: "Large", sample: "Easier reading" },
  { value: "extra_large", label: "Extra large", sample: "Maximum reading size" },
];

const readingWidths: Array<{ value: BisReadingWidth; label: string; detail: string }> = [
  { value: "narrow", label: "Narrow", detail: "Shorter lines for focused reading." },
  { value: "standard", label: "Standard", detail: "Balanced workbook width." },
  { value: "wide", label: "Wide", detail: "More room for tables and longer passages." },
];

const experiences = [
  {
    value: "school" as const,
    label: "School",
    detail: "Examples and language grounded in school life, study and facilitated youth learning.",
    Icon: GraduationCap,
  },
  {
    value: "emerging_adult" as const,
    label: "Emerging Adult",
    detail: "Study, independence, first work experiences, relationships and personal agency.",
    Icon: Sparkles,
  },
  {
    value: "workplace" as const,
    label: "Workplace",
    detail: "Professional behaviour, teams, responsibility, performance and workplace situations.",
    Icon: BriefcaseBusiness,
  },
];

export function SettingsPanel() {
  const [personalisation, setPersonalisation] = useState<LearnerPersonalisation>(DEFAULT_PERSONALISATION);
  const [edition, setEdition] = useState<DeliveryEdition>("school");
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/profile", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Settings could not be loaded.");
        const payload = (await response.json()) as ProfileSnapshot;
        if (controller.signal.aborted) return;
        const next = normalisePersonalisation({
          appearance: payload.profile?.appearancePreference,
          accent: payload.profile?.accentPreference,
          textSize: payload.profile?.textSizePreference,
          readingWidth: payload.profile?.readingWidthPreference,
        });
        setPersonalisation(next);
        savePersonalisation(next);
        if (payload.profile?.deliveryEdition) setEdition(payload.profile.deliveryEdition);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Settings could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  async function persist(body: Record<string, string>, key: string) {
    setSavingKey(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "That setting could not be saved.");
      setMessage("Saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That setting could not be saved.");
    } finally {
      setSavingKey("");
    }
  }

  function changePersonalisation<K extends keyof LearnerPersonalisation>(key: K, value: LearnerPersonalisation[K]) {
    const next = savePersonalisation({ ...personalisation, [key]: value });
    setPersonalisation(next);
    void persist({ [key]: value }, key);
  }

  function changeEdition(value: DeliveryEdition) {
    setEdition(value);
    void persist({ deliveryEdition: value }, "deliveryEdition");
  }

  const currentExperience = useMemo(() => experiences.find((item) => item.value === edition), [edition]);

  return (
    <main className="settings-page">
      <header className="settings-hero">
        <p className="eyebrow">Profile · Settings</p>
        <h1>Make BIS comfortable to use.</h1>
        <p>Change the reading surface, accent, text size and the life context BIS uses for examples. Your saved evidence and programme history stay intact.</p>
        <div className="settings-status" aria-live="polite">
          {loading ? "Loading your settings…" : savingKey ? "Saving…" : error ? <span role="alert">{error}</span> : message || "Changes save to your BIS profile."}
        </div>
      </header>

      <section id="experience" className="settings-surface settings-section">
        <div className="settings-section-head">
          <div className="settings-icon"><UserRound aria-hidden="true" /></div>
          <div>
            <p className="settings-kicker">My experience</p>
            <h2>Choose the context that fits your life now</h2>
            <p>The behavioural principle stays the same. BIS changes examples, scenarios and supporting language to fit your context.</p>
          </div>
        </div>
        <div className="settings-choice-grid experience-grid">
          {experiences.map(({ value, label, detail, Icon }) => {
            const active = edition === value;
            return (
              <button
                className={"settings-choice experience-choice" + (active ? " active" : "")}
                type="button"
                key={value}
                aria-pressed={active}
                disabled={loading || savingKey === "deliveryEdition"}
                onClick={() => changeEdition(value)}
              >
                <Icon aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                {active ? <Check aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <p className="settings-note"><strong>Current experience:</strong> {currentExperience?.label ?? "School"}. Changing context does not delete, rewrite or reclassify evidence you already created.</p>
      </section>

      <section className="settings-surface settings-section">
        <div className="settings-section-head">
          <div className="settings-icon"><Palette aria-hidden="true" /></div>
          <div>
            <p className="settings-kicker">Appearance</p>
            <h2>Reading surface</h2>
            <p>Choose how the workbook canvas feels across Learn, Labs, Profile and your Evidence Portfolio.</p>
          </div>
        </div>
        <div className="settings-choice-grid">
          {appearances.map((item) => {
            const active = personalisation.appearance === item.value;
            return (
              <button className={"settings-choice" + (active ? " active" : "")} type="button" key={item.value} aria-pressed={active} onClick={() => changePersonalisation("appearance", item.value)}>
                <MonitorCog aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                {active ? <Check aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>

        <div className="settings-subsection">
          <h3>Accent colour</h3>
          <p>Accent changes navigation, progress and selected controls. It does not recolour authored learning content.</p>
          <div className="accent-options" role="group" aria-label="Accent colour">
            {accents.map((item) => {
              const active = personalisation.accent === item.value;
              return (
                <button
                  type="button"
                  className={"accent-choice accent-" + item.value + (active ? " active" : "")}
                  key={item.value}
                  aria-pressed={active}
                  onClick={() => changePersonalisation("accent", item.value)}
                >
                  <span aria-hidden="true" />
                  {item.label}
                  {active ? <Check aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="settings-surface settings-section">
        <div className="settings-section-head">
          <div className="settings-icon"><Accessibility aria-hidden="true" /></div>
          <div>
            <p className="settings-kicker">Reading</p>
            <h2>Text size and page width</h2>
            <p>Make long reading and reflection tasks easier without changing the content itself.</p>
          </div>
        </div>

        <div className="settings-subsection">
          <h3>Text size</h3>
          <div className="segmented-options" role="group" aria-label="Text size">
            {textSizes.map((item) => (
              <button type="button" key={item.value} className={personalisation.textSize === item.value ? "active" : ""} aria-pressed={personalisation.textSize === item.value} onClick={() => changePersonalisation("textSize", item.value)}>
                <strong>{item.label}</strong><small>{item.sample}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-subsection">
          <h3>Reading width</h3>
          <div className="settings-choice-grid three">
            {readingWidths.map((item) => {
              const active = personalisation.readingWidth === item.value;
              return (
                <button className={"settings-choice" + (active ? " active" : "")} type="button" key={item.value} aria-pressed={active} onClick={() => changePersonalisation("readingWidth", item.value)}>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                  {active ? <Check aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
