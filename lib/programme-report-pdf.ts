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
    action: {
      reachedExperimentStage: number;
      startedExperiment: number;
      readyButNotStarted: number;
      experimentAttemptRate: number | null;
    };
    prediction: {
      averagePredictedRate: number | null;
      averageActualRate: number | null;
      averagePredictionAccuracy: number | null;
      averagePredictionGap: number | null;
    };
    experiment: {
      participantsStarted: number;
      observationsRecorded: number;
      eligibleOpportunities: number;
    };
    evidence: { sufficient: number; limited: number; none: number; notEnoughYet: number };
    change: {
      repeatOpportunityParticipants: number;
      improvedLaterResponse: number;
      changedOtherDirection: number;
      sameLaterResponse: number;
    };
    support: {
      participantsRequestingHelp: number;
      supportRequests: number;
      supportRequestRate: number | null;
    };
  };
  learningSummary?: null | {
    suppressed: boolean;
    learningJourney: null | {
      days: Array<{
        day: number;
        reached: number;
        completed: number;
        reachedRate: number | null;
        completionRate: number | null;
      }>;
      baselineThemes: Array<{
        label: string;
        area: string;
        respondents: number;
        frequentCount: number;
        frequentShare: number;
      }>;
      skillShifts: Array<{
        label: string;
        pairedParticipants: number;
        averagePre: number;
        averagePost: number;
        averageShift: number;
      }>;
      activity: {
        participantsWithHandbookActivity: number;
        participantsWithStructuredResponses: number;
        structuredResponsesRecorded: number;
      };
    };
  };
  learningChecks?: null | {
    suppressed: boolean;
    signalsRecorded: number | null;
    understoodRate: number | null;
    supportSignalRate: number | null;
    byDay: Array<{
      semanticStepId: string;
      signalsRecorded: number;
      understoodRate: number | null;
      supportSignalRate: number | null;
    }>;
    interpretationBoundary?: {
      learnerReportedNotScored?: boolean;
      excludedFromBEI?: boolean;
      descriptiveNotCausal?: boolean;
      note?: string;
    };
  };
  questionPatterns?: null | {
    suppressed: boolean;
    participantCount: number;
    privacyNote: string;
    questions: Array<{
      semanticFieldId: string;
      questionFamily: string;
      label: string;
      evidenceClass: string;
      answerModel: string;
      respondents: number;
      coverageRate: number;
      summary:
        | { type: "NUMERIC"; average: number }
        | {
            type: "CATEGORICAL" | "MULTI_SELECT";
            categories: Array<{
              value: string;
              participants: number;
              shareOfRespondents: number;
            }>;
          };
    }>;
  };
  organisationLearning?: null | {
    suppressed: boolean;
    transition: null | {
      participants: number;
      activeInLearning: number;
      reachedExperimentStage: number;
      startedExperiment: number;
      repeatSituationParticipants: number;
      completed: number;
    };
    supportResponse: null | {
      requests: number;
      acknowledged: number;
      resolved: number;
      acknowledgementRate: number | null;
      resolutionRate: number | null;
    };
    adaptation: null | {
      checkpointParticipants: number;
      adjustedParticipants: number;
      keptPlanParticipants: number;
      checkpointCoverageRate: number | null;
      adjustmentRate: number | null;
    };
    comparison: null | {
      comparableCohorts: number;
      baselineOnly: boolean;
    };
  };
  decisionRegister?: {
    canManage: boolean;
    decisions: Array<{
      sourceSignal: string;
      sourceTitle: string;
      sourceEvidence: string;
      decisionText: string;
      expectedOutcome: string;
      ownerLabel: string | null;
      reviewOn: string | null;
      status: string;
      reviewOutcome: string | null;
      reviewNote: string | null;
      createdAt: string;
      reviewedAt: string | null;
    }>;
  };
  deepAnalysis?: null | {
    suppressed: boolean;
    experimentLandscape: null | {
      participantsStarted: number;
      themes: Array<{ label: string; participants: number; shareOfStarted: number }>;
    };
  };
};

type Color = readonly [number, number, number];

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const C = {
  ink: [0.075, 0.18, 0.19] as Color,
  teal: [0.08, 0.34, 0.31] as Color,
  tealSoft: [0.91, 0.95, 0.94] as Color,
  terracotta: [0.78, 0.37, 0.25] as Color,
  terracottaSoft: [0.97, 0.92, 0.89] as Color,
  warm: [0.97, 0.96, 0.93] as Color,
  paper: [0.995, 0.993, 0.985] as Color,
  white: [1, 1, 1] as Color,
  muted: [0.38, 0.43, 0.42] as Color,
  line: [0.83, 0.84, 0.81] as Color,
  pale: [0.95, 0.95, 0.93] as Color,
  gold: [0.73, 0.58, 0.29] as Color,
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

function esc(value: string) {
  return ascii(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function rgb(color: Color, stroke = false) {
  return color.map((value) => value.toFixed(3)).join(" ") + (stroke ? " RG" : " rg");
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : String(value) + "%";
}

function fixed(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined
    ? "-"
    : Number(value).toFixed(digits).replace(/\.0$/, "");
}

function wrap(text: string, widthPt: number, size: number, bold = false) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const factor = bold ? 0.56 : 0.51;
  const maxUnits = Math.max(8, widthPt / (size * factor));
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? current + " " + word : word;
    if (next.length > maxUnits && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type TextOptions = {
  size?: number;
  bold?: boolean;
  serif?: boolean;
  color?: Color;
  width?: number;
  lineHeight?: number;
  gapAfter?: number;
  indent?: number;
  uppercase?: boolean;
};

type Page = { commands: string[]; cover?: boolean };

class ReportCanvas {
  pages: Page[] = [];
  current: Page = { commands: [] };
  y = PAGE_H - MARGIN;

  constructor() {
    this.page(C.paper);
  }

  page(fill: Color = C.paper, cover = false) {
    if (this.current.commands.length) this.pages.push(this.current);
    this.current = { commands: [], cover };
    this.y = PAGE_H - MARGIN;
    this.rect(0, 0, PAGE_W, PAGE_H, fill);
  }

  finish() {
    if (this.current.commands.length) this.pages.push(this.current);
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      if (page.cover) return;
      page.commands.push(rgb(C.line, true));
      page.commands.push("0.6 w 48 33 m 547 33 l S");
      page.commands.push(this.textCmd(48, 18, "BEHAVIOUR INTELLIGENCE SERIES", 7.5, true, C.muted));
      page.commands.push(
        this.textCmd(
          547,
          18,
          "PROGRAMME RESULTS  |  " + String(index + 1) + " / " + String(total),
          7.5,
          true,
          C.muted,
          false,
          "right"
        )
      );
    });
    return buildPdf(this.pages.map((page) => page.commands.join("\n")));
  }

  ensure(height: number) {
    if (this.y - height < 54) this.page(C.paper);
  }

  rect(x: number, y: number, w: number, h: number, fill: Color, stroke?: Color, lineWidth = 0.8) {
    this.current.commands.push("q");
    this.current.commands.push(rgb(fill));
    if (stroke) {
      this.current.commands.push(rgb(stroke, true));
      this.current.commands.push(String(lineWidth) + " w");
      this.current.commands.push(String(x) + " " + String(y) + " " + String(w) + " " + String(h) + " re B");
    } else {
      this.current.commands.push(String(x) + " " + String(y) + " " + String(w) + " " + String(h) + " re f");
    }
    this.current.commands.push("Q");
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Color = C.line, width = 0.8) {
    this.current.commands.push("q");
    this.current.commands.push(rgb(color, true));
    this.current.commands.push(String(width) + " w");
    this.current.commands.push(String(x1) + " " + String(y1) + " m " + String(x2) + " " + String(y2) + " l S");
    this.current.commands.push("Q");
  }

  textCmd(
    x: number,
    y: number,
    text: string,
    size: number,
    bold = false,
    color: Color = C.ink,
    serif = false,
    align: "left" | "right" = "left"
  ) {
    const font = serif ? (bold ? "/F4" : "/F3") : bold ? "/F2" : "/F1";
    const cleaned = esc(text);
    const estimated = cleaned.length * size * (bold ? 0.56 : 0.51);
    const tx = align === "right" ? x - estimated : x;
    return "BT " + rgb(color) + " " + font + " " + String(size) + " Tf 1 0 0 1 " +
      tx.toFixed(1) + " " + y.toFixed(1) + " Tm (" + cleaned + ") Tj ET";
  }

  textAt(
    x: number,
    y: number,
    text: string,
    size: number,
    bold = false,
    color: Color = C.ink,
    serif = false,
    align: "left" | "right" = "left"
  ) {
    this.current.commands.push(this.textCmd(x, y, text, size, bold, color, serif, align));
  }

  text(text: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const bold = options.bold ?? false;
    const serif = options.serif ?? false;
    const color = options.color ?? C.ink;
    const width = options.width ?? CONTENT_W - (options.indent ?? 0);
    const lineHeight = options.lineHeight ?? size * 1.35;
    const indent = options.indent ?? 0;
    const value = options.uppercase ? text.toUpperCase() : text;
    const lines = wrap(value, width, size, bold);
    this.ensure(lines.length * lineHeight + (options.gapAfter ?? 0));
    for (const line of lines) {
      this.textAt(MARGIN + indent, this.y, line, size, bold, color, serif);
      this.y -= lineHeight;
    }
    this.y -= options.gapAfter ?? 3;
  }

  section(label: string, title: string, subtitle?: string) {
    this.ensure(subtitle ? 90 : 68);
    this.text(label.toUpperCase(), { size: 8.5, bold: true, color: C.teal, gapAfter: 5 });
    this.text(title, { size: 22, bold: true, serif: true, lineHeight: 24, gapAfter: subtitle ? 6 : 13 });
    if (subtitle) {
      this.text(subtitle, { size: 9.5, color: C.muted, width: 455, lineHeight: 13, gapAfter: 13 });
    }
  }

  rule(gap = 14) {
    this.line(MARGIN, this.y, PAGE_W - MARGIN, this.y, C.line, 0.8);
    this.y -= gap;
  }

  metricCards(
    cards: Array<{ label: string; value: string; detail?: string; tone?: "dark" | "teal" | "warm" | "plain" }>,
    columns = 4
  ) {
    const gap = 8;
    const w = (CONTENT_W - gap * (columns - 1)) / columns;
    const h = 80;
    this.ensure(h + 14);
    const top = this.y;
    cards.forEach((card, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = MARGIN + col * (w + gap);
      const y = top - h - row * (h + gap);
      const fill =
        card.tone === "dark"
          ? C.ink
          : card.tone === "teal"
            ? C.tealSoft
            : card.tone === "warm"
              ? C.terracottaSoft
              : C.white;
      const stroke = card.tone === "dark" ? C.ink : C.line;
      const primary = card.tone === "dark" ? C.white : C.ink;
      const secondary = card.tone === "dark" ? ([0.78, 0.84, 0.82] as Color) : C.muted;
      this.rect(x, y, w, h, fill, stroke);
      this.textAt(x + 12, y + h - 18, card.label.toUpperCase(), 7.2, true, secondary);
      this.textAt(x + 12, y + h - 45, card.value, 20, true, primary, true);
      if (card.detail) this.textAt(x + 12, y + 11, card.detail, 7.5, false, secondary);
    });
    const rows = Math.ceil(cards.length / columns);
    this.y = top - rows * h - (rows - 1) * gap - 14;
  }

  callout(title: string, body: string, tone: "teal" | "warm" | "dark" = "teal") {
    const fill = tone === "dark" ? C.ink : tone === "warm" ? C.terracottaSoft : C.tealSoft;
    const primary = tone === "dark" ? C.white : C.ink;
    const secondary = tone === "dark" ? ([0.82, 0.88, 0.86] as Color) : C.muted;
    const lines = wrap(body, CONTENT_W - 36, 9.5);
    const h = 45 + lines.length * 13;
    this.ensure(h + 12);
    const y = this.y - h;
    this.rect(MARGIN, y, CONTENT_W, h, fill, tone === "dark" ? C.ink : C.line);
    this.textAt(MARGIN + 16, y + h - 21, title, 10, true, primary);
    let ty = y + h - 40;
    for (const line of lines) {
      this.textAt(MARGIN + 16, ty, line, 9.5, false, secondary);
      ty -= 13;
    }
    this.y = y - 12;
  }

  twoColumnCards(cards: Array<{ kicker: string; title: string; body: string }>) {
    const gap = 10;
    const w = (CONTENT_W - gap) / 2;
    const rows = Math.ceil(cards.length / 2);
    for (let row = 0; row < rows; row += 1) {
      const rowCards = cards.slice(row * 2, row * 2 + 2);
      const heights = rowCards.map((card) => 66 + wrap(card.body, w - 28, 9.2).length * 12);
      const rowH = Math.max(...heights, 104);
      this.ensure(rowH + 8);
      const cursorTop = this.y;
      rowCards.forEach((card, col) => {
        const x = MARGIN + col * (w + gap);
        const y = cursorTop - rowH;
        this.rect(x, y, w, rowH, C.white, C.line);
        this.textAt(x + 14, y + rowH - 19, card.kicker.toUpperCase(), 7, true, C.teal);
        let ty = y + rowH - 41;
        for (const line of wrap(card.title, w - 28, 13.5, true).slice(0, 2)) {
          this.textAt(x + 14, ty, line, 13.5, true, C.ink, true);
          ty -= 15;
        }
        ty -= 3;
        for (const line of wrap(card.body, w - 28, 9.2)) {
          this.textAt(x + 14, ty, line, 9.2, false, C.muted);
          ty -= 12;
        }
      });
      this.y = cursorTop - rowH - 8;
    }
    this.y -= 4;
  }

  horizontalBars(
    items: Array<{ label: string; value: number; detail?: string }>,
    maxValue: number,
    options: { suffix?: string; color?: Color; maxItems?: number } = {}
  ) {
    const rows = items.slice(0, options.maxItems ?? items.length);
    const barX = MARGIN + 190;
    const barW = CONTENT_W - 240;
    const rowH = 38;
    this.ensure(rows.length * rowH + 10);
    for (const item of rows) {
      this.textAt(MARGIN, this.y - 1, item.label, 9, true, C.ink);
      if (item.detail) this.textAt(MARGIN, this.y - 14, item.detail, 7.5, false, C.muted);
      this.rect(barX, this.y - 7, barW, 7, C.pale);
      this.rect(
        barX,
        this.y - 7,
        barW * Math.max(0, Math.min(1, item.value / Math.max(1, maxValue))),
        7,
        options.color ?? C.teal
      );
      this.textAt(
        PAGE_W - MARGIN,
        this.y - 2,
        fixed(item.value) + (options.suffix ?? ""),
        8.5,
        true,
        C.ink,
        false,
        "right"
      );
      this.y -= rowH;
    }
    this.y -= 4;
  }

  stackedBar(
    segments: Array<{ label: string; value: number; color: Color }>,
    title: string,
    detail?: string
  ) {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    this.ensure(82);
    this.text(title, { size: 10, bold: true, gapAfter: 2 });
    if (detail) this.text(detail, { size: 8.3, color: C.muted, gapAfter: 8 });
    const y = this.y - 12;
    let x = MARGIN;
    for (const segment of segments) {
      const w = total > 0 ? CONTENT_W * (segment.value / total) : 0;
      if (w > 0) this.rect(x, y, w, 12, segment.color);
      x += w;
    }
    this.y = y - 17;
    let lx = MARGIN;
    for (const segment of segments) {
      this.rect(lx, this.y - 3, 7, 7, segment.color);
      this.textAt(lx + 11, this.y - 1, segment.label + ": " + String(segment.value), 7.8, false, C.muted);
      lx += Math.max(110, (segment.label.length + 6) * 5.1 + 15);
    }
    this.y -= 24;
  }
}

function executiveFindings(outcome: Outcome) {
  const metrics = outcome.metrics;
  if (!metrics) return [] as Array<{ kicker: string; title: string; body: string }>;
  const cards: Array<{ kicker: string; title: string; body: string }> = [];
  const attempt = metrics.action.experimentAttemptRate ?? 0;

  cards.push({
    kicker: "Action",
    title:
      attempt >= 70
        ? "Most participants moved into real-world testing"
        : attempt >= 40
          ? "Real-world testing reached a meaningful share of the group"
          : "Real-world testing remains limited",
    body:
      percent(metrics.action.experimentAttemptRate) +
      " started an experiment; " +
      String(metrics.action.readyButNotStarted) +
      " reached the experiment stage but had not started.",
  });

  const starters = metrics.experiment.participantsStarted;
  const enoughShare = starters > 0 ? (metrics.evidence.sufficient / starters) * 100 : 0;
  cards.push({
    kicker: "Evidence",
    title:
      enoughShare >= 70
        ? "Most experiment starters have enough evidence to review"
        : enoughShare >= 40
          ? "The evidence base is mixed"
          : "More repeat evidence is still needed",
    body:
      String(metrics.evidence.sufficient) +
      " of " +
      String(starters) +
      " experiment starters have enough evidence; " +
      String(metrics.evidence.notEnoughYet) +
      " still need more real-world opportunities.",
  });

  if (metrics.prediction.averagePredictionGap !== null) {
    cards.push({
      kicker: "Expectation vs reality",
      title: "Individual expectations often differed from observed behaviour",
      body:
        "Average expected behaviour was " +
        percent(metrics.prediction.averagePredictedRate) +
        " and observed behaviour " +
        percent(metrics.prediction.averageActualRate) +
        ". The average individual difference was " +
        fixed(metrics.prediction.averagePredictionGap) +
        " points.",
    });
  }

  cards.push({
    kicker: "Support",
    title:
      (metrics.support.supportRequestRate ?? 0) >= 20
        ? "Human support demand is material"
        : "Human support demand is currently limited",
    body:
      String(metrics.support.participantsRequestingHelp) +
      " learners asked for help (" +
      percent(metrics.support.supportRequestRate) +
      " of the group).",
  });

  return cards;
}

function recommendationItems(outcome: Outcome) {
  const metrics = outcome.metrics;
  const items: Array<{ title: string; body: string; source: string }> = [];
  if (!metrics) return items;

  if (metrics.action.readyButNotStarted >= 2) {
    items.push({
      title: "Strengthen the transition from learning to action",
      body: "Review timing, instructions, workload and facilitator prompts at the point where participants are ready to experiment but have not started.",
      source:
        String(metrics.action.readyButNotStarted) +
        " participants reached the experiment stage without starting",
    });
  }

  const starters = metrics.experiment.participantsStarted;
  if (starters > 0 && metrics.evidence.notEnoughYet / starters >= 0.3) {
    items.push({
      title: "Increase access to repeat situations",
      body: "Check whether the programme window gives participants enough realistic opportunities to test the behaviour more than once.",
      source:
        String(metrics.evidence.notEnoughYet) +
        " of " +
        String(starters) +
        " experiment starters still need more evidence",
    });
  }

  if ((metrics.support.supportRequestRate ?? 0) >= 20) {
    items.push({
      title: "Position facilitator support at the points of greatest demand",
      body: "Review when help is requested and move check-ins closer to the moments where participants are most likely to stall.",
      source:
        String(metrics.support.participantsRequestingHelp) +
        " participants requested human help",
    });
  }

  if (metrics.change.repeatOpportunityParticipants > 0) {
    items.push({
      title: "Use repeat situations as the main change signal",
      body: "Track what happens the next time a comparable situation appears. This is more useful than treating one successful attempt as behavioural change.",
      source:
        String(metrics.change.repeatOpportunityParticipants) +
        " participants had repeat situations",
    });
  }

  const journey = outcome.learningSummary?.learningJourney;
  for (const theme of journey?.baselineThemes.slice(0, 3) ?? []) {
    const action =
      theme.area === "Follow-through"
        ? "Test smaller commitments, visible follow-up points and clearer ownership of the next action."
        : theme.area === "Focus"
          ? "Review where distraction enters the environment and whether focused work needs stronger boundaries."
          : theme.area === "Self-regulation"
            ? "Build short pause, reset and recovery practices into moments of pressure."
            : theme.area === "Routine"
              ? "Reduce reliance on motivation by strengthening predictable cues and practical routines."
              : "Review the conditions around this recurring pattern and test a practical support response.";

    items.push({
      title: "Explore " + theme.area.toLowerCase(),
      body: action,
      source:
        String(theme.frequentCount) +
        " of " +
        String(theme.respondents) +
        " reported " +
        theme.label.toLowerCase() +
        " often or always",
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  }).slice(0, 6);
}

function retentionSummary(outcome: Outcome) {
  const journey = outcome.learningSummary?.learningJourney;
  if (!journey) return null;
  const active = journey.days.filter((day) => day.reached > 0);
  if (!active.length) return null;
  const first = active[0];
  const last = active[active.length - 1];
  const retained = first.reached ? (last.reached / first.reached) * 100 : 0;
  return {
    first,
    last,
    retained,
    title:
      retained >= 80
        ? "Participation remains strong across the learning journey"
        : retained >= 60
          ? "Participation thins as the programme progresses"
          : "Participation falls sharply across the learning journey",
  };
}

function drawCover(canvas: ReportCanvas, outcome: Outcome, generatedAt: Date) {
  canvas.page(C.warm, true);
  canvas.rect(0, 500, PAGE_W, 342, C.ink);

  canvas.textAt(MARGIN, 785, "BIS", 18, true, C.white, true);
  canvas.textAt(
    MARGIN + 48,
    789,
    "BEHAVIOUR INTELLIGENCE SERIES",
    8,
    true,
    [0.78, 0.87, 0.84] as Color
  );

  canvas.textAt(MARGIN, 714, "Programme", 34, true, C.white, true);
  canvas.textAt(MARGIN, 676, "Results Report", 34, true, C.white, true);

  let nameY = 620;
  for (const line of wrap(outcome.cohort.name, 470, 17, true).slice(0, 2)) {
    canvas.textAt(
      MARGIN,
      nameY,
      line,
      17,
      true,
      [0.91, 0.94, 0.92] as Color
    );
    nameY -= 21;
  }

  canvas.textAt(
    MARGIN,
    534,
    (outcome.cohort.labCode === "HAB" ? "Habit Lab" : outcome.cohort.labCode) +
      " " +
      outcome.cohort.labVersion,
    9,
    true,
    [0.82, 0.88, 0.86] as Color
  );
  canvas.textAt(
    PAGE_W - MARGIN,
    534,
    (outcome.cohort.startsOn ?? "Start not set") +
      "  -  " +
      (outcome.cohort.endsOn ?? "End not set"),
    9,
    false,
    [0.82, 0.88, 0.86] as Color,
    false,
    "right"
  );

  canvas.y = 456;
  const metrics = outcome.metrics;
  const coverCards = metrics
    ? [
        { label: "Learners", value: String(outcome.participantCount), detail: "programme group", tone: "plain" as const },
        {
          label: "Started experiment",
          value: percent(metrics.action.experimentAttemptRate),
          detail: String(metrics.action.startedExperiment) + " learners",
          tone: "teal" as const,
        },
        {
          label: "Enough observations",
          value: String(metrics.evidence.sufficient),
          detail: String(metrics.evidence.notEnoughYet) + " need more observations",
          tone: "warm" as const,
        },
        {
          label: "Asked for help",
          value: percent(metrics.support.supportRequestRate),
          detail: String(metrics.support.participantsRequestingHelp) + " learners",
          tone: "plain" as const,
        },
      ]
    : [{ label: "Learners", value: String(outcome.participantCount), detail: "programme group", tone: "plain" as const }];

  canvas.metricCards(coverCards, 4);

  const retention = retentionSummary(outcome);
  if (retention) {
    canvas.callout(
      retention.title,
      String(retention.first.reached) +
        " learners reached Day " +
        String(retention.first.day) +
        "; " +
        String(retention.last.reached) +
        " reached Day " +
        String(retention.last.day) +
        ". This report combines learning activity, programme measures and real-world experiment evidence.",
      retention.retained >= 60 ? "teal" : "warm"
    );
  } else {
    canvas.callout(
      "A group-level programme report",
      "This report summarises programme activity and behavioural evidence without exposing private learner wording.",
      "teal"
    );
  }

  canvas.textAt(
    MARGIN,
    56,
    "Generated " + generatedAt.toISOString().slice(0, 10),
    8,
    false,
    C.muted
  );
  canvas.textAt(
    PAGE_W - MARGIN,
    56,
    "GROUP-LEVEL REPORT",
    8,
    true,
    C.teal,
    false,
    "right"
  );
}

function drawExecutiveSummary(canvas: ReportCanvas, outcome: Outcome) {
  canvas.page(C.paper);
  canvas.section(
    "Executive summary",
    "What the programme results are showing",
    "A clear view of participation, real-world testing, how much information we have, and where the programme may need attention."
  );

  const metrics = outcome.metrics!;
  canvas.metricCards(
    [
      {
        label: "Real-world test started",
        value: percent(metrics.action.experimentAttemptRate),
        detail: String(metrics.action.startedExperiment) + " started",
        tone: "dark",
      },
      {
        label: "Enough observations",
        value: String(metrics.evidence.sufficient),
        detail: String(metrics.evidence.notEnoughYet) + " need more observations",
        tone: "teal",
      },
      {
        label: "Repeat situations",
        value: String(metrics.change.repeatOpportunityParticipants),
        detail: String(metrics.change.improvedLaterResponse) + " moved toward alternative",
        tone: "warm",
      },
      {
        label: "Help requested",
        value: percent(metrics.support.supportRequestRate),
        detail: String(metrics.support.participantsRequestingHelp) + " learners",
        tone: "plain",
      },
    ],
    4
  );

  canvas.text("KEY FINDINGS", {
    size: 8.5,
    bold: true,
    color: C.teal,
    gapAfter: 8,
  });
  canvas.twoColumnCards(executiveFindings(outcome));

  const retention = retentionSummary(outcome);
  if (retention) {
    canvas.callout(
      "Participation through the programme",
      String(retention.first.reached) +
        " learners reached Day " +
        String(retention.first.day) +
        "; " +
        String(retention.last.reached) +
        " reached Day " +
        String(retention.last.day) +
        ". Retention to the furthest active day is " +
        fixed(retention.retained) +
        "%.",
      retention.retained >= 60 ? "teal" : "warm"
    );
  }
}

function drawLearningJourney(canvas: ReportCanvas, outcome: Outcome) {
  const journey = outcome.learningSummary?.learningJourney;
  if (!journey) return;

  canvas.page(C.paper);
  canvas.section(
    "Learning journey",
    "How participation and learning responses developed",
    "This section shows how people moved through the programme, which challenges appeared most often, and where group measures changed from before to after."
  );

  canvas.metricCards(
    [
      {
        label: "Learning activity",
        value: String(journey.activity.participantsWithHandbookActivity),
        detail: "learners",
        tone: "plain",
      },
      {
        label: "Usable responses",
        value: String(journey.activity.participantsWithStructuredResponses),
        detail: "learners",
        tone: "teal",
      },
      {
        label: "Responses recorded",
        value: String(journey.activity.structuredResponsesRecorded),
        detail: "recorded",
        tone: "warm",
      },
      {
        label: "Programme days",
        value: "10",
        detail: "learning journey",
        tone: "plain",
      },
    ],
    4
  );

  canvas.text("DAY-BY-DAY PROGRESSION", {
    size: 8.5,
    bold: true,
    color: C.teal,
    gapAfter: 10,
  });

  const chartTop = canvas.y;
  const baseY = chartTop - 110;
  const colW = CONTENT_W / 10;
  const max = Math.max(outcome.participantCount, 1);

  for (let i = 0; i < 10; i += 1) {
    const day =
      journey.days.find((entry) => entry.day === i + 1) ?? {
        day: i + 1,
        reached: 0,
        completed: 0,
        reachedRate: 0,
        completionRate: 0,
      };
    const x = MARGIN + i * colW + 7;
    const barW = 11;
    const maxH = 78;
    const reachedH = maxH * (day.reached / max);
    const completedH = maxH * (day.completed / max);

    canvas.rect(x, baseY, barW, maxH, C.pale);
    canvas.rect(x, baseY, barW, reachedH, C.teal);
    canvas.rect(x + 14, baseY, barW, maxH, C.pale);
    canvas.rect(x + 14, baseY, barW, completedH, C.terracotta);
    canvas.textAt(x + 4, baseY - 14, "D" + String(day.day), 7, true, C.muted);
    canvas.textAt(x, baseY + maxH + 8, String(day.reached), 7.5, true, C.ink);
  }

  canvas.textAt(MARGIN, baseY - 34, "Reached", 7.5, true, C.teal);
  canvas.rect(MARGIN + 45, baseY - 30, 10, 6, C.teal);
  canvas.textAt(MARGIN + 72, baseY - 34, "Completed", 7.5, true, C.terracotta);
  canvas.rect(MARGIN + 129, baseY - 30, 10, 6, C.terracotta);
  canvas.y = baseY - 54;

  if (journey.baselineThemes.length) {
    canvas.rule(10);
    canvas.text("RECURRING CHALLENGES", {
      size: 8.5,
      bold: true,
      color: C.teal,
      gapAfter: 9,
    });
    canvas.horizontalBars(
      journey.baselineThemes.slice(0, 6).map((theme) => ({
        label: theme.label,
        value: theme.frequentShare,
        detail:
          String(theme.frequentCount) +
          " of " +
          String(theme.respondents) +
          " often/always  |  " +
          theme.area,
      })),
      100,
      { suffix: "%", color: C.terracotta, maxItems: 6 }
    );
  }

  if (journey.skillShifts.length) {
    canvas.ensure(155);
    canvas.rule(10);
    canvas.text("GROUP SHIFTS", {
      size: 8.5,
      bold: true,
      color: C.teal,
      gapAfter: 9,
    });

    const gap = 12;
    const w = (CONTENT_W - gap) / 2;
    journey.skillShifts.slice(0, 2).forEach((shift, index) => {
      const x = MARGIN + index * (w + gap);
      const y = canvas.y - 106;
      const maxScale =
        Math.max(shift.averagePre, shift.averagePost) <= 5 ? 5 : 10;

      canvas.rect(x, y, w, 106, C.white, C.line);
      canvas.textAt(x + 14, y + 82, shift.label, 11, true, C.ink, true);
      canvas.textAt(
        x + 14,
        y + 64,
        String(shift.pairedParticipants) + " learners with both check-ins",
        7.5,
        false,
        C.muted
      );

      const trackW = w - 80;
      canvas.textAt(x + 14, y + 40, "Before", 7.5, true, C.muted);
      canvas.rect(x + 58, y + 38, trackW, 7, C.pale);
      canvas.rect(
        x + 58,
        y + 38,
        trackW * (shift.averagePre / maxScale),
        7,
        C.muted
      );
      canvas.textAt(
        x + w - 12,
        y + 38,
        fixed(shift.averagePre, 2),
        8,
        true,
        C.ink,
        false,
        "right"
      );

      canvas.textAt(x + 14, y + 20, "After", 7.5, true, C.muted);
      canvas.rect(x + 58, y + 18, trackW, 7, C.pale);
      canvas.rect(
        x + 58,
        y + 18,
        trackW * (shift.averagePost / maxScale),
        7,
        C.teal
      );
      canvas.textAt(
        x + w - 12,
        y + 18,
        fixed(shift.averagePost, 2),
        8,
        true,
        C.ink,
        false,
        "right"
      );
    });

    canvas.y -= 120;
  }
}

function drawLearningChecks(canvas: ReportCanvas, outcome: Outcome) {
  const checks = outcome.learningChecks;
  if (!checks || checks.suppressed) return;

  canvas.page(C.paper);
  canvas.section(
    "In-session learning checks",
    "Where learners felt clear and where they wanted more support",
    "These are anonymous, learner-reported understanding signals captured during the guided sessions. They help teams see where another example, explanation or practice opportunity may be useful."
  );

  canvas.metricCards(
    [
      {
        label: "Check signals",
        value: String(checks.signalsRecorded ?? 0),
        detail: "recorded",
        tone: "plain",
      },
      {
        label: "Can explain",
        value: percent(checks.understoodRate),
        detail: "self-reported",
        tone: "teal",
      },
      {
        label: "Want more support",
        value: percent(checks.supportSignalRate),
        detail: "unsure / need example",
        tone: "warm",
      },
    ],
    3
  );

  if (checks.byDay.length) {
    canvas.text("DAY-BY-DAY LEARNING SIGNAL", {
      size: 8.5,
      bold: true,
      color: C.teal,
      gapAfter: 9,
    });
    canvas.horizontalBars(
      checks.byDay.map((day) => {
        const token = day.semanticStepId.split(".").at(-1) ?? day.semanticStepId;
        const dayLabel = token.startsWith("DAY") ? "Day " + token.slice(3) : token;
        return {
          label: dayLabel,
          value: day.understoodRate ?? 0,
          detail:
            String(day.signalsRecorded) +
            " signals  |  " +
            percent(day.supportSignalRate) +
            " want more support",
        };
      }),
      100,
      { suffix: "%", color: C.teal, maxItems: 10 }
    );
  }

  canvas.callout(
    "How to read this section",
    checks.interpretationBoundary?.note ??
      "These signals are not marks, BEI evidence or proof of mastery. Use them to decide where the programme may need clearer explanation, modelling or practice.",
    "teal"
  );
}

function drawBehaviourEvidence(canvas: ReportCanvas, outcome: Outcome) {
  const metrics = outcome.metrics!;
  canvas.page(C.paper);
  canvas.section(
    "Behaviour in practice",
    "What happened when learners tested behaviour in real situations",
    "This section separates attendance from action, expectation from observed behaviour, and one-off attempts from repeat evidence."
  );

  canvas.text("FROM LEARNING TO ACTION", {
    size: 8.5,
    bold: true,
    color: C.teal,
    gapAfter: 8,
  });

  canvas.metricCards(
    [
      {
        label: "Reached experiment stage",
        value: String(metrics.action.reachedExperimentStage),
        detail: "learners",
        tone: "plain",
      },
      {
        label: "Started",
        value: String(metrics.action.startedExperiment),
        detail: percent(metrics.action.experimentAttemptRate),
        tone: "teal",
      },
      {
        label: "Enough observations",
        value: String(metrics.evidence.sufficient),
        detail: "learners",
        tone: "warm",
      },
      {
        label: "Completed Lab",
        value: String(metrics.completionContext.completed),
        detail: percent(metrics.completionContext.completionRate),
        tone: "plain",
      },
    ],
    4
  );

  canvas.ensure(145);
  canvas.text("EXPECTATION VS OBSERVED BEHAVIOUR", {
    size: 8.5,
    bold: true,
    color: C.teal,
    gapAfter: 8,
  });

  const expectation = metrics.prediction.averagePredictedRate ?? 0;
  const observed = metrics.prediction.averageActualRate ?? 0;
  const gap = metrics.prediction.averagePredictionGap;

  canvas.textAt(MARGIN, canvas.y - 2, "Expected", 8.5, true, C.muted);
  canvas.rect(MARGIN + 90, canvas.y - 7, 310, 10, C.pale);
  canvas.rect(
    MARGIN + 90,
    canvas.y - 7,
    310 * Math.min(1, expectation / 100),
    10,
    C.terracotta
  );
  canvas.textAt(
    PAGE_W - MARGIN,
    canvas.y - 2,
    percent(metrics.prediction.averagePredictedRate),
    9,
    true,
    C.ink,
    false,
    "right"
  );

  canvas.y -= 30;
  canvas.textAt(MARGIN, canvas.y - 2, "Observed", 8.5, true, C.muted);
  canvas.rect(MARGIN + 90, canvas.y - 7, 310, 10, C.pale);
  canvas.rect(
    MARGIN + 90,
    canvas.y - 7,
    310 * Math.min(1, observed / 100),
    10,
    C.teal
  );
  canvas.textAt(
    PAGE_W - MARGIN,
    canvas.y - 2,
    percent(metrics.prediction.averageActualRate),
    9,
    true,
    C.ink,
    false,
    "right"
  );
  canvas.y -= 35;

  canvas.callout(
    "The important gap is at learner level",
    gap === null
      ? "There is not enough paired expectation data yet."
      : "The group averages can look similar while individual expectations differ. Across learners, the average individual expectation difference is " +
          fixed(gap) +
          " points.",
    "teal"
  );

  canvas.rule(10);
  canvas.stackedBar(
    [
      { label: "Enough observations", value: metrics.evidence.sufficient, color: C.teal },
      { label: "More observations needed", value: metrics.evidence.limited, color: C.gold },
      { label: "No opportunity yet", value: metrics.evidence.none, color: C.terracotta },
    ],
    "How much information we have",
    String(metrics.experiment.observationsRecorded) +
      " observation records across " +
      String(metrics.experiment.eligibleOpportunities) +
      " real-world opportunities"
  );

  canvas.stackedBar(
    [
      {
        label: "Moved toward alternative",
        value: metrics.change.improvedLaterResponse,
        color: C.teal,
      },
      {
        label: "Stayed the same",
        value: metrics.change.sameLaterResponse,
        color: C.gold,
      },
      {
        label: "Changed another way",
        value: metrics.change.changedOtherDirection,
        color: C.terracotta,
      },
    ],
    "What happened on repeat situations",
    String(metrics.change.repeatOpportunityParticipants) +
      " learners had at least two comparable opportunities"
  );

  canvas.callout(
    "Human support",
    String(metrics.support.participantsRequestingHelp) +
      " learners asked for help (" +
      percent(metrics.support.supportRequestRate) +
      " of the group). This is a delivery signal: it shows where facilitator capacity is part of programme effectiveness.",
    (metrics.support.supportRequestRate ?? 0) >= 20 ? "warm" : "teal"
  );
}

function drawExperimentLandscape(canvas: ReportCanvas, outcome: Outcome) {
  const themes = outcome.deepAnalysis?.experimentLandscape?.themes ?? [];
  canvas.page(C.paper);
  canvas.section(
    "Experiment landscape",
    "Where learners were testing behaviour",
    "Broad experiment contexts help an organisation understand where behaviour is being tested without exposing private experiment wording."
  );

  if (themes.length) {
    canvas.horizontalBars(
      themes.map((theme) => ({
        label: theme.label,
        value: theme.participants,
        detail: fixed(theme.shareOfStarted) + "% of experiment starters",
      })),
      Math.max(...themes.map((theme) => theme.participants), 1),
      { color: C.teal, maxItems: 8 }
    );
  } else {
    canvas.callout(
      "No shared areas are large enough to show safely yet",
      "Broad areas will appear when enough learners share them to protect individual privacy.",
      "teal"
    );
  }

  canvas.rule(12);
  canvas.text("ORGANISATION INTERPRETATION", {
    size: 8.5,
    bold: true,
    color: C.teal,
    gapAfter: 8,
  });

  const journey = outcome.learningSummary?.learningJourney;
  const challengeCards = (journey?.baselineThemes ?? []).slice(0, 4).map((theme) => ({
    kicker: theme.area,
    title: theme.label,
    body:
      String(theme.frequentCount) +
      " of " +
      String(theme.respondents) +
      " learners reported this often or always (" +
      fixed(theme.frequentShare) +
      "%).",
  }));

  if (challengeCards.length) canvas.twoColumnCards(challengeCards);

  canvas.callout(
    "How to read this section",
    "These patterns describe where behaviour and recurring challenges appear in the group. They do not prove why the pattern exists or that the organisation caused it.",
    "dark"
  );
}

function drawQuestionPatterns(canvas: ReportCanvas, outcome: Outcome) {
  const patterns = outcome.questionPatterns;
  if (!patterns || patterns.suppressed || patterns.questions.length === 0) return;

  canvas.page(C.paper);
  canvas.section(
    "Question intelligence",
    "What are learners answering consistently?",
    "This section combines only questions that BIS has approved for structured group analysis. Private free-text answers are not read or shown, and small answer groups remain hidden."
  );

  canvas.metricCards(
    [
      {
        label: "Questions reported",
        value: String(patterns.questions.length),
        detail: "structured questions",
        tone: "teal",
      },
      {
        label: "Participants",
        value: String(patterns.participantCount),
        detail: "programme group",
        tone: "teal",
      },
    ],
    2
  );

  patterns.questions.slice(0, 8).forEach((question) => {
    const evidenceLabel = question.evidenceClass.toLowerCase().replaceAll("_", " ");
    const coverage = fixed(question.coverageRate) + "% coverage";

    if (question.summary.type === "NUMERIC") {
      canvas.callout(
        question.label,
        "Group average: " +
          fixed(question.summary.average, 2) +
          " · " +
          String(question.respondents) +
          " responses · " +
          coverage +
          " · " +
          evidenceLabel,
        "teal"
      );
      return;
    }

    const categories = question.summary.categories
      .slice(0, 5)
      .map(
        (category) =>
          category.value +
          ": " +
          String(category.participants) +
          " (" +
          fixed(category.shareOfRespondents) +
          "%)"
      )
      .join(" · ");

    canvas.callout(
      question.label,
      (categories || "No answer group is large enough to display safely.") +
        " · " +
        String(question.respondents) +
        " responses · " +
        coverage +
        " · " +
        evidenceLabel,
      "teal"
    );
  });

  canvas.callout(
    "Privacy boundary",
    patterns.privacyNote ||
      "Only governed structured questions are included. Free-text and high-sensitivity answers remain excluded, and very small answer groups are hidden.",
    "dark"
  );
}

function drawOrganisationalLearning(canvas: ReportCanvas, outcome: Outcome) {
  const learning = outcome.organisationLearning;
  if (!learning || learning.suppressed || !learning.transition || !learning.supportResponse || !learning.adaptation || !learning.comparison) return;

  canvas.page(C.paper);
  canvas.section(
    "What the programme can learn",
    "What should the team learn from this programme?",
    "These results highlight questions the team may want to explore next. They show patterns, not proof of why a result happened."
  );

  const transition = learning.transition;
  canvas.metricCards([
    { label: "Participants", value: String(transition.participants), tone: "dark" },
    { label: "Started real-world test", value: String(transition.startedExperiment), tone: "teal" },
    { label: "Repeat situations", value: String(transition.repeatSituationParticipants), tone: "plain" },
    { label: "Completed", value: String(transition.completed), tone: "warm" },
  ]);

  const support = learning.supportResponse;
  const adaptation = learning.adaptation;
  canvas.twoColumnCards([
    {
      kicker: "Where participation drops",
      title: "Where are people dropping off before action?",
      body:
        String(transition.reachedExperimentStage) +
        " reached the real-world test, " +
        String(transition.startedExperiment) +
        " started, and " +
        String(transition.repeatSituationParticipants) +
        " encountered at least two comparable situations.",
    },
    {
      kicker: "Support follow-up",
      title: support.requests === 0 ? "No support requests are recorded" : "What happened after learners asked for help?",
      body:
        support.requests === 0
          ? "There are no learner support requests to review for this group."
          : String(support.requests) +
            " support requests are recorded; " +
            String(support.acknowledged) +
            " acknowledgements and " +
            String(support.resolved) +
            " resolutions are recorded. If a response is not recorded in BIS, that does not mean support did not happen.",
    },
    {
      kicker: "Adaptation",
      title: adaptation.checkpointParticipants === 0 ? "We do not yet know how learners adjusted" : "Did learners change their approach after seeing what happened?",
      body:
        adaptation.checkpointParticipants === 0
          ? "No Day 3 adjustment decisions are available yet. BIS leaves this question open instead of treating missing information as failure."
          : String(adaptation.checkpointParticipants) +
            " learners reached the Day 3 check-in; " +
            String(adaptation.adjustedParticipants) +
            " adjusted the method and " +
            String(adaptation.keptPlanParticipants) +
            " kept the original plan.",
    },
    {
      kicker: "Next programme",
      title: learning.comparison.baselineOnly ? "Use this group as the starting point" : "A comparison with another similar group is possible",
      body:
        learning.comparison.baselineOnly
          ? "Keep this group as the starting point. When the next similar group completes the programme, check whether the pattern changed after the team made a deliberate programme change."
          : String(learning.comparison.comparableCohorts) +
            " other similar group(s) are available. A comparison can show whether the pattern changed, but it does not prove what caused the change.",
    },
  ]);

  canvas.callout(
    "Learning for the next programme",
    "Look at the group results. Try one clear programme change. Check the next similar group. Keep conclusions in line with the amount of information available.",
    "dark"
  );
}

function drawProgrammeDecisionRegister(canvas: ReportCanvas, outcome: Outcome) {
  const decisions = outcome.decisionRegister?.decisions ?? [];
  canvas.page(C.paper);
  canvas.section(
    "Programme decisions",
    "What did the organisation decide to change?",
    "This section records what the team decided to change, what it hoped to see next, and what happened when the decision was reviewed."
  );

  if (!decisions.length) {
    canvas.callout(
      "No programme decision has been recorded yet",
      "The current findings remain useful observations until the team records what, if anything, it will change and what it hopes to see next.",
      "warm"
    );
    return;
  }

  for (const decision of decisions.slice(0, 8)) {
    canvas.ensure(160);
    canvas.text(decision.sourceSignal.replaceAll("_", " "), {
      size: 8,
      bold: true,
      color: C.teal,
      uppercase: true,
      gapAfter: 4,
    });
    canvas.text(decision.sourceTitle, {
      size: 15,
      bold: true,
      serif: true,
      color: C.ink,
      lineHeight: 18,
      gapAfter: 8,
    });
    canvas.callout("What we saw", decision.sourceEvidence, "teal");
    canvas.twoColumnCards([
      {
        kicker: "Programme decision",
        title: decision.ownerLabel ? "Owned by " + decision.ownerLabel : "Recorded programme change",
        body: decision.decisionText,
      },
      {
        kicker: "What we expect next",
        title: decision.reviewOn ? "Review on " + decision.reviewOn : "Review date not set",
        body: decision.expectedOutcome,
      },
    ]);
    if (decision.status !== "OPEN") {
      canvas.callout(
        "Review - " + (decision.reviewOutcome ?? "recorded").replaceAll("_", " ").toLowerCase(),
        decision.reviewNote ?? "A review outcome has been recorded without an additional note.",
        "dark"
      );
    }
    canvas.rule(10);
  }

  canvas.callout(
    "Interpretation boundary",
    "This records the team’s choices and later review. It does not prove that the programme change caused the result.",
    "dark"
  );
}

function drawActionPlan(canvas: ReportCanvas, outcome: Outcome) {
  canvas.page(C.paper);
  canvas.section(
    "Action plan",
    "What may be worth exploring next",
    "Recommendations are tied to observed group evidence. They are prompts for programme and organisational improvement, not diagnoses."
  );

  const actions = recommendationItems(outcome);
  actions.forEach((action, index) => {
    canvas.ensure(86);
    const h = 76;
    const y = canvas.y - h;

    canvas.rect(
      MARGIN,
      y,
      CONTENT_W,
      h,
      index % 2 === 0 ? C.white : C.tealSoft,
      C.line
    );
    canvas.textAt(MARGIN + 14, y + h - 19, "0" + String(index + 1), 9, true, C.terracotta);
    canvas.textAt(MARGIN + 42, y + h - 19, action.title, 11, true, C.ink, true);
    canvas.textAt(MARGIN + 42, y + h - 36, action.source, 7.5, true, C.teal);

    let ty = y + h - 53;
    for (const line of wrap(action.body, CONTENT_W - 70, 9)) {
      canvas.textAt(MARGIN + 42, ty, line, 9, false, C.muted);
      ty -= 11;
    }

    canvas.y = y - 9;
  });

  canvas.rule(12);
  canvas.text("REPORTING NOTES", {
    size: 8.5,
    bold: true,
    color: C.teal,
    gapAfter: 8,
  });

  canvas.twoColumnCards([
    {
      kicker: "Evidence",
      title: "What this report uses",
      body: "Programme activity, learning check-ins, before-and-after measures, real-world observations, BIS calculations and group-level support information.",
    },
    {
      kicker: "Interpretation",
      title: "What this report does not claim",
      body: "The report does not diagnose or rank learners, prove what caused a result, or treat one successful attempt as lasting change.",
    },
    {
      kicker: "Privacy",
      title: "What remains private",
      body: "Individual reflections, private test wording, support messages and other sensitive learner content stay private.",
    },
    {
      kicker: "Small groups",
      title: "When BIS withholds detail",
      body:
        "Groups below " +
        String(outcome.minimumReportableCohortSize) +
        " are not shown in detail, and very small patterns may be hidden when they could point back to one person.",
    },
  ]);

  canvas.text("Generated by BIS Programme Results", {
    size: 8,
    bold: true,
    color: C.muted,
    gapAfter: 2,
  });
  canvas.text(
    "Behaviour Intelligence Series is designed to connect learning with observable real-world behaviour while preserving learner privacy.",
    { size: 8.5, color: C.muted, lineHeight: 12 }
  );
}

export function renderProgrammeOutcomePdf(outcome: Outcome, generatedAt = new Date()) {
  const canvas = new ReportCanvas();
  drawCover(canvas, outcome, generatedAt);

  if (outcome.suppressed || !outcome.metrics) {
    canvas.page(C.paper);
    canvas.section(
      "Privacy threshold",
      "This group is too small for behavioural reporting"
    );
    canvas.callout(
      "Report withheld",
      "Programme Results requires at least " +
        String(outcome.minimumReportableCohortSize) +
        " participants before group-level behavioural findings are shown.",
      "warm"
    );
    return canvas.finish();
  }

  drawExecutiveSummary(canvas, outcome);
  drawLearningJourney(canvas, outcome);
  drawLearningChecks(canvas, outcome);
  drawQuestionPatterns(canvas, outcome);
  drawBehaviourEvidence(canvas, outcome);
  drawExperimentLandscape(canvas, outcome);
  drawOrganisationalLearning(canvas, outcome);
  drawProgrammeDecisionRegister(canvas, outcome);
  drawActionPlan(canvas, outcome);

  return canvas.finish();
}

function buildPdf(pageStreams: string[]) {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>";
  objects[6] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>";

  const pageIds: number[] = [];
  for (let index = 0; index < pageStreams.length; index += 1) {
    const pageId = 7 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const stream = pageStreams[index];

    objects[pageId] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents " +
      String(contentId) +
      " 0 R >>";

    objects[contentId] =
      "<< /Length " +
      String(Buffer.byteLength(stream, "latin1")) +
      " >>\nstream\n" +
      stream +
      "\nendstream";
  }

  objects[2] =
    "<< /Type /Pages /Count " +
    String(pageIds.length) +
    " /Kids [" +
    pageIds.map((id) => String(id) + " 0 R").join(" ") +
    "] >>";

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

  pdf +=
    "trailer\n<< /Size " +
    String(maxId + 1) +
    " /Root 1 0 R >>\n";
  pdf += "startxref\n" + String(xrefOffset) + "\n%%EOF";

  return new TextEncoder().encode(pdf);
}

export function programmeReportFilename(name: string) {
  const safe = ascii(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (safe || "bis-programme-results") + ".pdf";
}
