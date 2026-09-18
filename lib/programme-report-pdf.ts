type Outcome = {
  cohort: {
    id: string;
    name: string;
    labCode: string;
    labVersion: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  participantCount: number;
  suppressed: boolean;
  minimumReportableCohortSize: number;
  metrics: null | {
    completionContext: { completed: number; completionRate: number | null };
    action: { reachedExperimentStage: number; startedExperiment: number; readyButNotStarted: number; experimentAttemptRate: number | null };
    prediction: { averagePredictedRate: number | null; averageActualRate: number | null; averagePredictionAccuracy: number | null; averagePredictionGap: number | null };
    experiment: { participantsStarted: number; observationsRecorded: number; eligibleOpportunities: number };
    evidence: { sufficient: number; limited: number; none: number; notEnoughYet: number };
    change: { repeatOpportunityParticipants: number; improvedLaterResponse: number; changedOtherDirection: number; sameLaterResponse: number };
    support: { participantsRequestingHelp: number; supportRequests: number; supportRequestRate: number | null };
  };
  deepAnalysis?: null | {
    suppressed: boolean;
    experimentLandscape: null | {
      participantsStarted: number;
      themes: Array<{ label: string; participants: number; shareOfStarted: number }>;
    };
  };
};

function ascii(value: string) {
  return value
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("™", "TM")
    .replaceAll("•", "-")
    .replaceAll("≥", ">=")
    .replaceAll("≤", "<=")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdf(value: string) {
  return ascii(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrap(text: string, width = 88) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value) + "%";
}

function reportInsights(outcome: Outcome) {
  const metrics = outcome.metrics;
  if (!metrics) return [] as string[];
  const lines: string[] = [];
  if (metrics.action.experimentAttemptRate !== null) {
    lines.push(
      percent(metrics.action.experimentAttemptRate) +
      " of the group started a real-world experiment; " +
      String(metrics.action.readyButNotStarted) +
      " reached the experiment stage but had not started."
    );
  }
  if (metrics.experiment.participantsStarted > 0) {
    lines.push(
      String(metrics.evidence.sufficient) +
      " of " +
      String(metrics.experiment.participantsStarted) +
      " experiment starters have enough evidence for a stronger behavioural reading; " +
      String(metrics.evidence.notEnoughYet) +
      " still need more evidence."
    );
  }
  if (metrics.prediction.averagePredictionGap !== null) {
    const groupDifference =
      metrics.prediction.averagePredictedRate !== null && metrics.prediction.averageActualRate !== null
        ? Math.abs(metrics.prediction.averagePredictedRate - metrics.prediction.averageActualRate).toFixed(1)
        : null;
    lines.push(
      groupDifference === null
        ? "The average person-level prediction gap is " + String(metrics.prediction.averagePredictionGap) + " points."
        : "Expected and observed behaviour are only " + groupDifference + " points apart at group-average level, while the average person-level prediction gap is " + String(metrics.prediction.averagePredictionGap) + " points."
    );
  }
  if (metrics.support.participantsRequestingHelp > 0) {
    lines.push(
      String(metrics.support.participantsRequestingHelp) +
      " participants requested human help (" +
      percent(metrics.support.supportRequestRate) +
      " of the group), showing where facilitator capacity forms part of delivery."
    );
  }
  const themes = outcome.deepAnalysis?.experimentLandscape?.themes ?? [];
  if (themes.length) {
    lines.push(
      "Most common reportable experiment areas: " +
      themes.slice(0, 4).map((theme) => theme.label + " (" + String(theme.participants) + ")").join(", ") +
      ". Participants may appear in more than one area."
    );
  }
  return lines;
}

function reviewQuestions(outcome: Outcome) {
  const metrics = outcome.metrics;
  if (!metrics) return [] as string[];
  const questions: string[] = [];
  if (metrics.action.readyButNotStarted >= 2) {
    questions.push("Check whether timing, instructions, workload or facilitator support is making the transition into the experiment harder.");
  }
  const starters = metrics.experiment.participantsStarted;
  if (starters > 0 && (metrics.evidence.notEnoughYet / starters) >= 0.4) {
    questions.push("Check whether participants are encountering enough real-world opportunities during the programme window.");
  }
  if ((metrics.prediction.averagePredictionGap ?? 0) >= 20) {
    questions.push("Explore why participants' expectations are often far from their observed behaviour, even when the group averages look similar.");
  }
  if ((metrics.support.supportRequestRate ?? 0) >= 20) {
    questions.push("Review where human support is being requested and whether facilitator check-ins are positioned at the right moments.");
  }
  if (metrics.change.repeatOpportunityParticipants > 0) {
    questions.push("Use repeat opportunities to examine whether a different response becomes easier, stays unchanged, or moves in another direction over time.");
  }
  return questions;
}

type DrawOptions = { size?: number; bold?: boolean; indent?: number; gapAfter?: number; width?: number };

export function renderProgrammeOutcomePdf(outcome: Outcome, generatedAt = new Date()) {
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 790;

  const newPage = () => {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = 790;
  };

  const draw = (text: string, options: DrawOptions = {}) => {
    const size = options.size ?? 10;
    const lineHeight = size * 1.35;
    const indent = options.indent ?? 0;
    const maxWidth = options.width ?? Math.max(45, 88 - Math.round(indent / 6));
    for (const line of wrap(text, maxWidth)) {
      if (y < 62) newPage();
      const font = options.bold ? "/F2" : "/F1";
      commands.push(
        "BT " + font + " " + String(size) + " Tf 1 0 0 1 " + String(54 + indent) + " " + y.toFixed(1) + " Tm (" + escapePdf(line) + ") Tj ET"
      );
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 4;
  };

  const divider = () => {
    if (y < 70) newPage();
    commands.push("0.82 G 54 " + y.toFixed(1) + " m 541 " + y.toFixed(1) + " l S");
    y -= 14;
  };

  draw("BEHAVIOUR INTELLIGENCE SERIES", { size: 9, bold: true, gapAfter: 5 });
  draw("Programme Outcomes Report", { size: 24, bold: true, gapAfter: 8 });
  draw(outcome.cohort.name, { size: 15, bold: true, gapAfter: 3 });
  draw(
    "Habit Lab " + outcome.cohort.labVersion +
    " | " + (outcome.cohort.startsOn ?? "Start not set") +
    " to " + (outcome.cohort.endsOn ?? "End not set") +
    " | " + String(outcome.participantCount) + " participants",
    { size: 9, gapAfter: 4 }
  );
  draw("Generated " + generatedAt.toISOString().slice(0, 10) + " | Group-level report | Individual responses remain private", { size: 8, gapAfter: 12 });
  divider();

  if (outcome.suppressed || !outcome.metrics) {
    draw("Report unavailable for this group", { size: 16, bold: true, gapAfter: 8 });
    draw(
      "Behavioural outcomes are shown only when at least " +
      String(outcome.minimumReportableCohortSize) +
      " participants are present, so group reporting cannot become a proxy for one person.",
      { size: 10 }
    );
    if (commands.length) pages.push(commands.join("\n"));
    return buildPdf(pages);
  }

  const metrics = outcome.metrics;
  draw("WHAT STANDS OUT", { size: 9, bold: true, gapAfter: 6 });
  for (const insight of reportInsights(outcome)) {
    draw("- " + insight, { size: 10, indent: 8, gapAfter: 5, width: 82 });
  }
  divider();

  draw("Participation and action", { size: 16, bold: true, gapAfter: 7 });
  draw(
    "Reached experiment stage: " + String(metrics.action.reachedExperimentStage) +
    " | Started: " + String(metrics.action.startedExperiment) +
    " | Ready, not started: " + String(metrics.action.readyButNotStarted) +
    " | Attempt rate: " + percent(metrics.action.experimentAttemptRate),
    { size: 10, gapAfter: 9 }
  );

  draw("Expectation vs observed behaviour", { size: 16, bold: true, gapAfter: 7 });
  draw(
    "Average expected rate: " + percent(metrics.prediction.averagePredictedRate) +
    " | Average observed rate: " + percent(metrics.prediction.averageActualRate) +
    " | Average person-level prediction gap: " +
    (metrics.prediction.averagePredictionGap === null ? "-" : String(metrics.prediction.averagePredictionGap) + " points"),
    { size: 10, gapAfter: 9 }
  );

  draw("Evidence strength", { size: 16, bold: true, gapAfter: 7 });
  draw(
    "Enough evidence: " + String(metrics.evidence.sufficient) +
    " | Still building: " + String(metrics.evidence.limited) +
    " | No eligible opportunity evidence: " + String(metrics.evidence.none) +
    " | Observation days: " + String(metrics.experiment.observationsRecorded) +
    " | Real opportunities: " + String(metrics.experiment.eligibleOpportunities),
    { size: 10, gapAfter: 9 }
  );

  draw("What happened on repeat opportunities", { size: 16, bold: true, gapAfter: 7 });
  draw(
    "Participants with repeat situations: " + String(metrics.change.repeatOpportunityParticipants) +
    " | Moved toward the alternative: " + String(metrics.change.improvedLaterResponse) +
    " | Stayed the same: " + String(metrics.change.sameLaterResponse) +
    " | Changed in another direction: " + String(metrics.change.changedOtherDirection),
    { size: 10, gapAfter: 9 }
  );

  draw("Human support", { size: 16, bold: true, gapAfter: 7 });
  draw(
    "Participants requesting help: " + String(metrics.support.participantsRequestingHelp) +
    " | Requests: " + String(metrics.support.supportRequests) +
    " | Group request rate: " + percent(metrics.support.supportRequestRate),
    { size: 10, gapAfter: 9 }
  );

  const themes = outcome.deepAnalysis?.experimentLandscape?.themes ?? [];
  if (themes.length) {
    divider();
    draw("WHERE PEOPLE WERE TESTING BEHAVIOUR", { size: 9, bold: true, gapAfter: 7 });
    for (const theme of themes) {
      draw(
        theme.label + ": " + String(theme.participants) + " participants (" + String(theme.shareOfStarted) + "% of experiment starters)",
        { size: 10, indent: 8, gapAfter: 4 }
      );
    }
    draw("Participants can appear in more than one area. Categories are grouped broadly to protect privacy.", { size: 8, gapAfter: 8 });
  }

  const questions = reviewQuestions(outcome);
  if (questions.length) {
    divider();
    draw("WHAT MAY BE WORTH CHECKING", { size: 9, bold: true, gapAfter: 7 });
    for (const question of questions) {
      draw("- " + question, { size: 10, indent: 8, gapAfter: 5, width: 82 });
    }
  }

  divider();
  draw("Interpretation boundary", { size: 13, bold: true, gapAfter: 6 });
  draw(
    "This report describes group patterns from BIS evidence. It does not diagnose participants, rank people, prove causality, or expose private learner wording. Smaller categories may be suppressed to protect privacy.",
    { size: 9, gapAfter: 4 }
  );

  if (commands.length) pages.push(commands.join("\n"));
  return buildPdf(pages);
}

function buildPdf(pageStreams: string[]) {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageIds: number[] = [];
  for (let index = 0; index < pageStreams.length; index += 1) {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const stream = pageStreams[index];
    objects[pageId] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " +
      String(contentId) +
      " 0 R >>";
    objects[contentId] = "<< /Length " + String(Buffer.byteLength(stream, "latin1")) + " >>\nstream\n" + stream + "\nendstream";
  }

  objects[2] = "<< /Type /Pages /Count " + String(pageIds.length) + " /Kids [" + pageIds.map((id) => String(id) + " 0 R").join(" ") + "] >>";

  let pdf = "%PDF-1.4\n%BIS\n";
  const offsets: number[] = [0];
  const maxId = objects.length - 1;
  for (let id = 1; id <= maxId; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = Buffer.byteLength(pdf, "latin1");
    pdf += String(id) + " 0 obj\n" + objects[id] + "\nendobj\n";
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += "xref\n0 " + String(maxId + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= maxId; id += 1) {
    const offset = offsets[id] ?? 0;
    pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  }
  pdf += "trailer\n<< /Size " + String(maxId + 1) + " /Root 1 0 R >>\n";
  pdf += "startxref\n" + String(xrefOffset) + "\n%%EOF";
  return new TextEncoder().encode(pdf);
}

export function programmeReportFilename(name: string) {
  const safe = ascii(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (safe || "bis-programme-outcomes") + ".pdf";
}
