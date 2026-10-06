import PDFDocument from "pdfkit";
import type { ProgrammeEvidenceFlow } from "./programme-evidence-flow";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { buildProgrammeReport, type ProgrammeReport, type ReportChart, type ReportInsight } from "./programme-intelligence.mjs";
import { sponsorFindings } from "./experience/programme-experience.mjs";

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
  evidenceFlow?: ProgrammeEvidenceFlow | null;
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

// Fonts are bundled with the server function; no network fetch during export.
const fontRoot = process.env.BIS_REPORT_FONT_ROOT ?? join(process.cwd(), "assets/report-fonts");
const fonts = {
  body: readFileSync(join(fontRoot, "DejaVuSans.ttf")),
  bold: readFileSync(join(fontRoot, "DejaVuSans-Bold.ttf")),
  heading: readFileSync(join(fontRoot, "DejaVuSerif-Bold.ttf")),
};
const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 48, WIDTH = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 72;
const C = { ink: "#193038", blue: "#315d82", muted: "#51616b", line: "#dce2e4", pale: "#edf2f5", secondary: "#91aec4" };
const domainLabels: Record<string, string> = { application: "Real-world practice", engagement: "Learning journey", understanding: "Participant-reported understanding", behaviour: "Behaviour in practice", support: "Human support", capability: "Reviewed task evidence", coverage: "How much information we have", context: "Programme context", delivery: "What the programme can learn" };

class ReportDocument {
  readonly doc: PDFKit.PDFDocument;
  y = MARGIN;
  private readonly chunks: Buffer[] = [];
  private readonly result: Promise<Uint8Array<ArrayBuffer>>;
  private sectionTitle = "Programme Results";
  private readonly pageSections: string[] = [];

  constructor(private readonly report: ProgrammeReport, private readonly illustrative: boolean, generatedAt: Date) {
    this.doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, size: "A4", margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 72 }, font: join(fontRoot, "DejaVuSans.ttf"),
      info: { Title: `${report.profile.name} - Programme Results Report`, Author: "Applied Commerce®", Subject: illustrative ? "Illustrative simulation - fictional data" : "Aggregate programme evidence", CreationDate: generatedAt } });
    this.doc.registerFont("body", fonts.body).registerFont("bold", fonts.bold).registerFont("heading", fonts.heading);
    this.result = new Promise((resolve, reject) => {
      this.doc.on("data", (chunk: Buffer) => this.chunks.push(chunk));
      this.doc.on("end", () => resolve(new Uint8Array(Buffer.concat(this.chunks))));
      this.doc.on("error", reject);
    });
  }

  page() {
    this.doc.addPage(); this.y = MARGIN;
    this.pageSections.push(this.sectionTitle);
  }
  ensure(height: number) { if (this.y + height > BOTTOM) this.page(); }
  measure(text: string, width = WIDTH, size = 10, font = "body") {
    this.doc.font(font).fontSize(size);
    return this.doc.heightOfString(text, { width, lineGap: 3 });
  }
  paragraph(text: string, options: { size?: number; font?: string; color?: string; gap?: number; indent?: number } = {}) {
    const size = options.size ?? 10, font = options.font ?? "body", indent = options.indent ?? 0;
    const width = WIDTH - indent;
    // PDFKit measures and wraps actual glyphs, including a single long word.
    // Split exceptionally long paragraphs at measured line boundaries so every
    // page respects our header/footer, rather than clipping a fixed rectangle.
    const words = text.split(/\s+/u), lines: string[] = [];
    let line = "";
    this.doc.font(font).fontSize(size);
    for (const word of words) {
      if (this.doc.widthOfString(word) > width) {
        if (line) { lines.push(line); line = ""; }
        let fragment = "";
        for (const char of word) {
          if (fragment && this.doc.widthOfString(fragment + char) > width) { lines.push(fragment); fragment = ""; }
          fragment += char;
        }
        line = fragment;
      } else if (line && this.doc.widthOfString(line + " " + word) > width) { lines.push(line); line = word; }
      else line += (line ? " " : "") + word;
    }
    if (line) lines.push(line);
    const lineH = this.measure("Ag", width, size, font);
    for (const value of lines) {
      this.ensure(lineH);
      this.doc.font(font).fontSize(size).fillColor(options.color ?? C.ink).text(value, MARGIN + indent, this.y, { width, lineBreak: false });
      this.y += lineH;
    }
    this.y += options.gap ?? 8;
  }
  section(label: string, title: string, subtitle?: string, fresh = true) {
    this.sectionTitle = label;
    if (fresh) this.page();
    this.ensure(this.measure(title, WIDTH, 21, "heading") + (subtitle ? this.measure(subtitle) : 0) + 80);
    this.paragraph(label.toUpperCase(), { size: 8, font: "bold", color: C.blue, gap: 8 });
    this.paragraph(title, { size: 21, font: "heading", gap: 12 });
    if (subtitle) this.paragraph(subtitle, { color: C.muted, gap: 18 });
  }
  findingHeight(insight: ReportInsight, brief = false) {
    return this.measure(insight.title, WIDTH, 12, "bold") + this.measure(insight.observation) + this.measure(insight.interpretation) + this.measure(`Interpretation limit: ${insight.boundary}`, WIDTH, 9) + (brief ? 0 : this.measure(`Context: ${insight.context}`) + this.measure(`Evidence basis: ${insight.evidence.basis}. ${insight.evidence.coverage}`, WIDTH, 9) + this.measure(`Suggested next step: ${insight.action}`, WIDTH, 10, "bold")) + 72;
  }
  finding(insight: ReportInsight, brief = false) {
    this.ensure(Math.min(this.findingHeight(insight, brief), BOTTOM - MARGIN));
    this.paragraph(insight.title, { size: 12, font: "bold", gap: 8 });
    this.paragraph(insight.observation);
    this.paragraph(insight.interpretation);
    if (!brief) {
      this.paragraph(`Context: ${insight.context}`, { color: C.muted });
      this.paragraph(`Evidence basis: ${insight.evidence.basis}. ${insight.evidence.coverage}`, { size: 9, color: C.muted });
      this.paragraph(`Suggested next step: ${insight.action}`, { font: "bold" });
    }
    this.paragraph(`Interpretation limit: ${insight.boundary}`, { size: 9, color: C.muted, gap: 18 });
  }
  chart(chart: ReportChart) {
    this.ensure(this.measure(chart.title, WIDTH, 13, "bold") + this.measure(chart.note, WIDTH, 9) + 85);
    this.paragraph(chart.title, { size: 13, font: "bold" });
    this.paragraph(chart.note, { size: 9, color: C.muted });
    const max = Math.max(1, ...chart.rows.flatMap(row => [row.denominator ?? 0, row.value ?? 0, row.secondaryValue ?? 0]));
    const fmt = (v: number | null | undefined) => v == null ? "Unavailable" : String(Number(v.toFixed(2)));
    if (chart.rows.some(row => row.secondaryLabel)) this.paragraph("Dark bars: reached the touchpoint · Light bars: activity completed. Values follow that order.", { size: 8, color: C.muted });
    for (const row of chart.rows) {
      const values = [{ value: row.value, color: C.blue }, ...(row.secondaryLabel ? [{ value: row.secondaryValue ?? null, color: C.secondary }] : [])];
      const basis = row.denominator == null ? chart.unit : `of ${row.denominator} participants`;
      const detail = `${values.map(v => fmt(v.value)).join(" / ")} · ${basis}`;
      const height = Math.max(this.measure(row.label, 200, 9, "bold") + this.measure(detail, 200, 8) + 12, 38);
      if (this.y + height > BOTTOM) { this.page(); this.paragraph(`${chart.title} (continued)`, { size: 11, font: "bold" }); }
      const top = this.y;
      this.doc.font("bold").fontSize(9).fillColor(C.ink).text(row.label, MARGIN, top, { width: 200, lineGap: 3 });
      const labelH = this.measure(row.label, 200, 9, "bold");
      this.doc.font("body").fontSize(8).fillColor(C.muted).text(detail, MARGIN, top + labelH + 3, { width: 200 });
      const barX = MARGIN + 218, barW = WIDTH - 218;
      values.forEach((item, index) => {
        const y = top + 4 + index * 14;
        if (item.value !== null) {
          this.doc.rect(barX, y, barW, 9).fill(C.pale);
          if (item.value > 0) this.doc.rect(barX, y, barW * Math.min(1, item.value / max), 9).fill(item.color);
        } else this.doc.font("body").fontSize(8).fillColor(C.muted).text("Information not available", barX, y - 2, { width: barW });
      });
      this.y = top + height;
    }
    this.y += 14;
  }
  table(headers: string[], rows: string[][]) {
    const widths = headers.length === 2 ? [WIDTH * .36, WIDTH * .64] : headers.map(() => WIDTH / headers.length);
    const draw = (cells: string[], header = false) => {
      const height = Math.max(...cells.map((c, i) => this.measure(c, widths[i] - 16, 9, header ? "bold" : "body"))) + 16;
      if (this.y + height > BOTTOM) { this.page(); if (!header) draw(headers, true); }
      // Oversized rows flow as labelled paragraphs rather than an over-page box.
      if (height > BOTTOM - MARGIN - 80) {
        cells.forEach((cell, i) => this.paragraph(`${headers[i]}: ${cell}`, { size: 9 })); return;
      }
      const top = this.y;
      if (header) this.doc.rect(MARGIN, top, WIDTH, height).fill(C.pale);
      let x = MARGIN;
      cells.forEach((cell, i) => { this.doc.font(header ? "bold" : "body").fontSize(9).fillColor(C.ink).text(cell, x + 8, top + 8, { width: widths[i] - 16, lineGap: 3 }); x += widths[i]; });
      this.doc.moveTo(MARGIN, top + height).lineTo(PAGE_W - MARGIN, top + height).strokeColor(C.line).stroke();
      this.y = top + height;
    };
    const firstRowHeight = rows[0] ? Math.max(...rows[0].map((cell, i) => this.measure(cell, widths[i] - 16, 9))) + 16 : 0;
    this.ensure(Math.min(45 + firstRowHeight, BOTTOM - MARGIN)); draw(headers, true); rows.forEach(row => draw(row)); this.y += 18;
  }
  finish() {
    const range = this.doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(i);
      this.doc.page.margins.bottom = 0;
      // Footer text is outside the content area, with automatic page flow disabled.
      this.doc.font("body").fontSize(7).fillColor(C.muted).text(`${this.pageSections[i]} · ${i + 1} / ${range.count}`, MARGIN, PAGE_H - 38, { width: WIDTH, lineBreak: false });
      if (this.illustrative) this.doc.font("bold").fontSize(6.5).fillColor(C.blue).text("ILLUSTRATIVE SIMULATION - FICTIONAL DATA - NOT MEASURED PROGRAMME RESULTS", MARGIN, PAGE_H - 53, { width: WIDTH, lineBreak: false });
    }
    this.doc.end(); return this.result;
  }
}

export async function renderProgrammeOutcomePdf(outcome: Outcome, generatedAt = new Date(), options: { illustrative?: boolean; leap9Experience?: boolean } = {}) {
  const report = buildProgrammeReport(outcome);
  const canvas = new ReportDocument(report, options.illustrative === true, generatedAt);
  canvas.section("Behaviour Intelligence Series™", "Programme Results Report", report.profile.name);
  if (options.illustrative) canvas.paragraph("ILLUSTRATIVE SIMULATION - FICTIONAL DATA - NOT MEASURED PROGRAMME RESULTS", { font: "bold", color: C.blue });
  canvas.table(["Programme profile", "Reporting context"], [
    ["Programme group", report.profile.name], ["Lab", `${report.profile.labCode} · ${report.profile.labVersion}`],
    ["Programme period", `${report.period.startsOn ?? "Start date not recorded"} - ${report.period.endsOn ?? "End date not recorded"}`],
    ["Report date", generatedAt.toISOString().slice(0, 10)], ["Eligible participants", String(report.participantCount ?? "Unavailable")],
    ["Facilitated programme", "Ten purposeful facilitated touchpoints. Page activity is reported separately from attendance; held-session totals are not supplied in this report."],
    ["Audience", "Programme owners and authorised reporting viewers"],
  ]);
  canvas.paragraph("Applied Commerce® · GROUP-LEVEL REPORT", { font: "bold" });
  canvas.paragraph(report.boundary, { color: C.muted });
  if (report.status === "SUPPRESSED") {
    canvas.section("Privacy", "Report withheld", `At least ${report.minimumReportableCohortSize} eligible participants are required. Findings and chart values are withheld when the group is too small or the underlying report is restricted.`);
    return canvas.finish();
  }
  // The public experience uses its own fixed sample and a concise sponsor view.
  // Live reports continue to use authorised aggregates and privacy gates above.
  if (options.illustrative && options.leap9Experience) {
    canvas.section("Programme outcomes", "From intention to follow-through", "What Leap9 can learn from the example, and what BIS should check next.");
    for (const item of sponsorFindings()) {
      canvas.ensure(180);
      canvas.paragraph(item.title, { size: 13, font: "bold" });
      canvas.paragraph(item.observation, { font: "bold" });
      canvas.paragraph(item.meaning);
      canvas.paragraph(`Next step: ${item.action}`);
      canvas.paragraph(`Evidence: ${item.basis}`, { size: 9, color: C.muted });
      canvas.paragraph(item.limit, { size: 9, color: C.muted, gap: 20 });
    }
    canvas.section("Supporting evidence", "What was observed", "Programme totals support the findings; they do not replace them.");
    const repeat = report.charts.find(item => item.id === "repeat-response");
    if (repeat) canvas.chart(repeat);
    const paired = report.insights.find(item => item.id.startsWith("paired-"));
    if (paired) {
      canvas.paragraph("How participants feel about managing their habit", { font: "bold" });
      canvas.paragraph(paired.observation);
      canvas.paragraph("This comparison uses the same question before and after, for the participants with both answers. A rise means they report feeling more in control; it does not certify competence or job readiness.");
    }
    canvas.paragraph("What to check next", { font: "bold" });
    canvas.paragraph("BIS should review a relevant practical task with an agreed assessment rubric, then follow up to see whether the behaviour holds in a new situation. Leap9 can provide the practice opportunity; programme design and evidence quality remain BIS’s responsibility.");
    canvas.paragraph("How the example was prepared", { font: "bold" });
    canvas.paragraph("Twenty varied fictional participant records supply the page and report. Some show more frequent use of the plan, some less, and some too few observations. Visitor practice answers do not change these cohort records. No private learner reflection appears in this report.");
    canvas.paragraph("Prepared by P.D. · Applied Commerce®", { color: C.muted });
    return canvas.finish();
  }
  canvas.section("Executive summary", "What the programme results are showing", "KEY FINDINGS · Recorded participation, practice and evidence, with questions for programme review.");
  for (const item of report.insights.slice(0, 3)) canvas.finding(item, true);
  if (!report.insights.length) canvas.paragraph("No reportable finding is available yet. Review the permitted records and delivery calendar before drawing a conclusion.");
  canvas.paragraph(report.boundary, { color: C.muted });
  canvas.section("Progress and programme context", "Participation and recorded activity", "Each graphic answers a programme question. Counts describe recorded milestones rather than a verified nested funnel.");
  for (const chart of report.charts) canvas.chart(chart);
  const unavailable: string[] = [];
  canvas.page();
  for (const domain of ["engagement", "understanding", "application", "behaviour", "capability", "support", "context", "coverage", "delivery"]) {
    const items = report.insights.filter(item => item.domain === domain);
    if (!items.length) { unavailable.push(domainLabels[domain]); continue; }
    canvas.y += 18;
    canvas.ensure(Math.min(150 + canvas.findingHeight(items[0]), BOTTOM - MARGIN));
    canvas.section(domainLabels[domain], domainLabels[domain], undefined, false);
    items.forEach(item => canvas.finding(item));
  }
  canvas.section("Programme review", "What may be worth exploring next", "These evidence-linked questions and follow-ups support your team's review. They do not prescribe programme changes and remain separate from your saved decisions.");
  canvas.table(["Finding and responsible team", "Question or follow-up"], report.insights.map(item => [`${item.title} · ${item.owner}`, `${item.action} Basis: ${item.observation}`]));
  if (report.decisions.length) canvas.section("Programme decisions", "What did the organisation decide to change?", "Recorded team decisions and their next review.");
  else canvas.paragraph("Programme decisions: No programme decision is recorded in this report.", { color: C.muted });
  for (const decision of report.decisions) {
    canvas.ensure(80); canvas.paragraph(decision.title, { font: "bold" });
    canvas.paragraph(decision.decision);
    canvas.paragraph(`Expected observation: ${decision.expectedOutcome}`);
    canvas.paragraph(`Responsible person or team: ${decision.owner} · Review date: ${decision.reviewOn ?? "Not recorded"}`);
    if (decision.reviewOutcome) canvas.paragraph(`Recorded review outcome: ${decision.reviewOutcome.toLowerCase().replaceAll("_", " ")}`);
    canvas.paragraph(`Status: ${decision.status === "REVIEWED" ? "Reviewed" : "Awaiting review"}${decision.reviewNote ? ` · ${decision.reviewNote}` : ""}`);
  }
  canvas.section("Methodology and limitations", "How to read this report", "REPORTING NOTES · Descriptive evidence, reporting coverage and privacy.");
  if (unavailable.length) canvas.paragraph(`Where the programme picture is still building: No reportable finding is supplied for ${unavailable.join(", ").toLowerCase()}. Information may be unrecorded, unsupported by this Lab's measures, or withheld for privacy. This is not a zero result.`);
  canvas.paragraph("What this report uses", { font: "bold" });
  canvas.paragraph("Authorised group aggregates of recorded programme activity, structured participant check-ins, real-world observations where defined by the Lab, and saved facilitator assessments of currently shared task evidence. The same report model supplies dashboard findings and PDF findings.");
  canvas.paragraph("In-session learning checks", { font: "bold" });
  canvas.paragraph("Learning checks describe participants' own understanding, not test marks, observed behaviour or proof of mastery. Percentages use recorded check responses, not the number of participants; one participant can answer at several sessions. Missing responses do not show whether someone understands. Starting-point and later comparisons use only the paired records supplied by the programme measure.");
  canvas.paragraph("What remains private", { font: "bold" });
  canvas.paragraph("Individual answers, private reflections, personal experiment wording, support messages and Companion conversations are excluded. Small groups and unavailable values stay hidden; unavailable values are not zero. No hidden value is reconstructed by subtraction.");
  canvas.paragraph("What this report does not claim", { font: "bold" });
  canvas.paragraph(report.boundary + " Coverage is not improvement. A reviewed task does not prove newly acquired or lasting capability, and a missing record does not explain a participant's reasons.");
  canvas.paragraph(`Report model: ${report.modelVersion} · Minimum group: ${report.minimumReportableCohortSize}`, { size: 8, color: C.muted });
  return canvas.finish();
}

export function programmeReportFilename(name: string) {
  const safe = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (safe || "bis-programme-results") + ".pdf";
}
