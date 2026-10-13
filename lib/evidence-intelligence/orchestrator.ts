import type {
  EvidenceContext,
  LongitudinalSynthesis,
  ProgrammeAggregate,
  ProgrammeInsight,
} from "./contracts";
import {
  runEvidenceClassificationAgent,
  runLongitudinalSynthesisAgent,
  runProgrammeInsightAgent,
  runQualityContradictionAgent,
  runResponseInterpretationAgent,
} from "./agents";
import { humanReviewRequired, stableEvidenceFingerprint } from "./core.mjs";

export type EvidenceAnalysisResult = {
  fingerprint: string;
  interpretation: Awaited<ReturnType<typeof runResponseInterpretationAgent>>;
  classification: Awaited<ReturnType<typeof runEvidenceClassificationAgent>>;
  quality: Awaited<ReturnType<typeof runQualityContradictionAgent>>;
  disposition: "NOT_AVAILABLE" | "NOT_SUPPORTED" | "PROPOSED" | "REVIEW_REQUIRED";
};

export async function analyseEvidence(args: {
  context: EvidenceContext;
  priorEvidence?: unknown[];
}): Promise<EvidenceAnalysisResult> {
  const fingerprint = stableEvidenceFingerprint({
    evidenceId: args.context.evidenceId,
    labCode: args.context.labCode,
    labVersion: args.context.labVersion,
    semanticFieldId: args.context.semanticFieldId,
    occurredAt: args.context.occurredAt,
  });

  const interpretation = await runResponseInterpretationAgent(args.context);
  if (!interpretation) {
    return {
      fingerprint,
      interpretation: null,
      classification: null,
      quality: null,
      disposition: "NOT_AVAILABLE",
    };
  }

  const classification = await runEvidenceClassificationAgent({
    context: args.context,
    interpretation: interpretation.output,
  });
  if (!classification) {
    return {
      fingerprint,
      interpretation,
      classification: null,
      quality: null,
      disposition: "NOT_AVAILABLE",
    };
  }

  if (classification.output.claimStatus === "NOT_SUPPORTED") {
    return {
      fingerprint,
      interpretation,
      classification,
      quality: null,
      disposition: "NOT_SUPPORTED",
    };
  }

  const quality = await runQualityContradictionAgent({
    context: args.context,
    interpretation: interpretation.output,
    classification: classification.output,
    priorEvidence: args.priorEvidence ?? [],
  });
  if (!quality) {
    return {
      fingerprint,
      interpretation,
      classification,
      quality: null,
      disposition: "NOT_AVAILABLE",
    };
  }

  const reviewRequired =
    classification.output.claimStatus === "REVIEW_REQUIRED" ||
    quality.output.requiresHumanReview ||
    quality.output.verdict === "CONTRADICTED" ||
    quality.output.verdict === "INSUFFICIENT" ||
    humanReviewRequired({ confidence: quality.output.adjustedConfidence });

  return {
    fingerprint,
    interpretation,
    classification,
    quality,
    disposition: reviewRequired ? "REVIEW_REQUIRED" : "PROPOSED",
  };
}

export async function synthesiseCompetencyHistory(args: {
  competencyId: string;
  competencyTitle: string;
  evidence: unknown[];
}): Promise<LongitudinalSynthesis | null> {
  const result = await runLongitudinalSynthesisAgent(args);
  return result?.output ?? null;
}

export async function generateProgrammeInsight(
  aggregate: ProgrammeAggregate,
): Promise<ProgrammeInsight | null> {
  const result = await runProgrammeInsightAgent(aggregate);
  return result?.output ?? null;
}
