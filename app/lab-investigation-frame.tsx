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
      style={{ "--lab-frame-accent": accent } as React.CSSProperties}
    >
      <div className="universal-lab-progress" aria-label={`${labTitle} progress`}>
        <Progress value={(step / investigations.length) * 100} />
        <strong>{step}/{investigations.length}</strong>
      </div>

      <nav className="universal-investigation-nav" aria-label={`${labTitle} investigations`}>
        {investigations.map((item) => {
          const available = item.number <= Math.max(maxStep, step);
          const complete = item.number < maxStep;
          return (
            <button
              key={item.number}
              type="button"
              disabled={!available}
              className={step === item.number ? "current" : complete ? "complete" : ""}
              onClick={() => onSelect(item.number)}
              aria-current={step === item.number ? "step" : undefined}
            >
              <span>{complete ? <Check /> : item.number}</span>
              <div>
                <small>{item.phase}</small>
                <strong>{item.title}</strong>
              </div>
            </button>
          );
        })}
      </nav>

      <section className="universal-lab-stage">
        <LabMissionHeader investigation={current} step={step} total={investigations.length} />
        {children}
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
  return (
    <header className="universal-lab-mission">
      <div className="universal-lab-mission-copy">
        <p className="eyebrow">
          {canonicalStage
            ? `Investigation ${step} · ${canonicalStage.label}`
            : "Mission"}
        </p>
        <h1>{investigation.title}</h1>
        <p>{investigation.mission}</p>
        {canonicalStage?.role ? (
          <p className="universal-lab-stage-role">{canonicalStage.role}</p>
        ) : null}
        {investigation.produces?.length ? (
          <div className="universal-lab-produces">
            <strong>You will produce:</strong>
            {investigation.produces.map((output) => <span key={output}>□ {output}</span>)}
          </div>
        ) : null}
      </div>
      <div className="universal-lab-meta">
        <Badge variant="outline">{investigation.time}</Badge>
        {investigation.difficulty ? <Badge variant="outline">{investigation.difficulty}</Badge> : null}
        <small>Investigation {step} of {total}</small>
      </div>
    </header>
  );
}
