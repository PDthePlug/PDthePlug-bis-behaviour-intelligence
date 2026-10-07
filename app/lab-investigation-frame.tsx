"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { HABIT_LAB_STAGES } from "@/lib/universal-lab-standard.mjs";

export type UniversalInvestigation = {
  number: number;
  title: string;
  mission: string;
  time: string;
  phase: string;
  difficulty?: string;
  produces?: readonly string[];
  standardStage?: {
    number: number;
    key: string;
    label: string;
    role: string;
  };
};

export function LabInvestigationFrame({
  labTitle,
  accent,
  investigations,
  step,
  maxStep,
  onSelect,
  children,
}: {
  labTitle: string;
  accent: string;
  investigations: readonly UniversalInvestigation[];
  step: number;
  maxStep: number;
  onSelect: (step: number) => void;
  children: React.ReactNode;
}) {
  const current = investigations[step - 1];
  return (
    <div
      className="universal-lab-frame"
      style={{ "--lab-frame-accent": accent, "--learner-document-accent": accent } as React.CSSProperties}
    >
      <div className="universal-lab-progress learner-document-route-progress" aria-label={`${labTitle} progress`}>
        <Progress aria-label={`${labTitle} investigation progress`} aria-valuetext={`Investigation ${step} of ${investigations.length}`} value={(step / investigations.length) * 100} />
        <strong>{step}/{investigations.length}</strong>
      </div>

      <nav className="universal-investigation-nav" aria-label={`${labTitle} investigations`}>
        {investigations.map((item) => {
          const available = item.number <= Math.max(maxStep, step);
          const complete = item.number < maxStep;
          const title = /^of\s+\d+$|^\d+\s*\/\s*9$|^investigation\s+\d+$/i.test(item.title.trim())
            ? (item.standardStage ?? HABIT_LAB_STAGES.find(stage => stage.number === item.number))?.label ?? item.title
            : item.title;
          return (
            <button
              key={item.number}
              type="button"
              disabled={!available}
              aria-label={`Investigation ${item.number}: ${title}${complete ? ", completed" : ""}`}
              className={step === item.number ? "current" : complete ? "complete" : ""}
              onClick={() => onSelect(item.number)}
              aria-current={step === item.number ? "step" : undefined}
            >
              <span>{complete ? <Check /> : item.number}</span>
              <div>
                <small>{item.phase}</small>
                <strong>{title}</strong>
              </div>
            </button>
          );
        })}
      </nav>

      <section className="universal-lab-stage learner-document-stage" id="lab-investigation-start">
        <article className="universal-lab-document learner-document">
          <LabMissionHeader investigation={current} step={step} total={investigations.length} />
          <div className="universal-lab-document-body learner-document-body">
            {children}
          </div>
        </article>
      </section>
    </div>
  );
}

export function LabMissionHeader({
  investigation,
  step,
  total,
}: {
  investigation: UniversalInvestigation;
  step: number;
  total: number;
}) {
  const canonicalStage = investigation.standardStage
    ?? HABIT_LAB_STAGES.find((stage) => stage.number === investigation.number);
  const authoredTitle = String(investigation.title ?? "").trim();
  const canonicalTitle = canonicalStage?.label ?? authoredTitle;
  const comparable = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const malformedTitle =
    !authoredTitle
    || /^of\s+\d+$/i.test(authoredTitle)
    || /^\d+\s*\/\s*9$/.test(authoredTitle)
    || /^investigation\s+\d+/i.test(authoredTitle);
  const legacyPredictionTitle = /^the\s+prediction$|^prediction$/i.test(authoredTitle.trim());
  const authoredFocus =
    !malformedTitle
    && canonicalStage
    && !legacyPredictionTitle
    && comparable(authoredTitle) !== comparable(canonicalTitle)
      ? authoredTitle
      : "";
  return (
    <header className="universal-lab-mission learner-document-header">
      <div className="universal-lab-mission-copy learner-document-heading">
        <p className="eyebrow learner-document-eyebrow">Investigation {step} of {total}</p>
        <h1 className="learner-document-title">{canonicalTitle}</h1>
        {authoredFocus ? <p className="universal-lab-focus">{authoredFocus}</p> : null}
        <p className="learner-document-purpose">{investigation.mission}</p>
        {investigation.produces?.length ? (
          <div className="universal-lab-produces learner-document-outcomes">
            <strong>You will produce:</strong>
            {investigation.produces.map((output) => <span key={output}>{output}</span>)}
          </div>
        ) : null}
      </div>
      <div className="universal-lab-meta learner-document-meta">
        <Badge variant="outline">{investigation.time}</Badge>
        {investigation.difficulty ? <Badge variant="outline">{investigation.difficulty}</Badge> : null}
        <small>Investigation {step} of {total}</small>
      </div>
    </header>
  );
}
