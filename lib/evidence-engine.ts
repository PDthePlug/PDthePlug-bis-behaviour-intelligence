export type EvidenceRecord = {
 id: string; lab_code: string; lab_version: string; enrolment_id: string | null;
 investigation_id: string; semantic_field_id: string; source_object_type: string; source_object_id: string;
 provenance: string; value_type: string; value: string | null; status: string; sensitivity: string;
 occurred_at: string; recorded_at: string; supersedes_response_id?: string | null;
 prompt_label?: string | null; task_id?: string | null; evidence_class?: string | null;
 portfolio_purpose?: string | null; outcome?: string | null; competency?: string | null; classification_status?: string | null;
};
export type CriterionRating = {criterionId: string; score: number; rationale: string};
export type RubricVersion = {
 id: string; lab_code: string; lab_version: string; title: string; task_id: string; source_reference: string;
 semantic_field_ids: string[]; criteria: Array<{id: string; label: string}>; scale_min: number; scale_max: number; authored_total: boolean;
};
export type AssessmentReview = {
 id: string; rubric_version_id: string | null; assessor_email: string; disposition: string; feedback: string;
 criterion_scores: CriterionRating[]; supersedes_id: string | null; created_at: string;
};
export type EvidenceSubmission = {
 id: string; user_id: string; cohort_id: string; title: string; created_at: string; revoked_at: string | null;
 current: boolean; display_name: string; evidence: EvidenceRecord[]; reviews: AssessmentReview[];
};
export type AssessmentWorkspace = {
 groups: Array<{id: string; name: string; lab_code: string; lab_version: string}>;
 submissions: EvidenceSubmission[]; rubrics: RubricVersion[];
};
export type CurriculumMapping = {
 id: string; lab_code: string; lab_version: string; semantic_field_id: string; prompt_label: string;
 evidence_class: string; portfolio_purpose: string; outcome: string | null; competency: string | null;
 classification_status: string; source_reference: string; created_at: string;
};
export type AssessmentReport = {
 cohorts: Array<{id: string; name: string; participants: number; suppressed: boolean; reviewed_learners: number | null;
  rubrics: Array<{rubric_id: string; title: string; source_reference: string; sample: number; average_total: number | null; maximum_total: number | null}>}>;
 minimum_cohort: number; minimum_cell: number; basis: string;
};
export function evidenceWording(value: string | null) {
 if (value === null) return "No response recorded";
 try { const decoded: unknown = JSON.parse(value); return typeof decoded === "string" ? decoded : JSON.stringify(decoded, null, 2); }
 catch { return value; }
}
export function authoredTotal(review: AssessmentReview, rubric: RubricVersion | undefined) {
 return rubric?.authored_total && review.criterion_scores.length === rubric.criteria.length
  ? review.criterion_scores.reduce((sum, entry) => sum + entry.score, 0) : null;
}
export function evidenceTitle(record: Pick<EvidenceRecord,"prompt_label"|"semantic_field_id"|"provenance"|"investigation_id">) {
 if(record.prompt_label && record.prompt_label !== record.semantic_field_id) return record.prompt_label;
 const day=record.investigation_id?.match(/\.PROGRAMME\.DAY(\d+)$/)?.[1];
 if(record.provenance==="LR") return day?`Day ${day} handbook response`:"Handbook response";
 return "Recorded Lab evidence";
}
export type MeasurementHistoryRecord={id:string;measurement_id:string;enrolment_id:string|null;lab_code:string|null;lab_version:string|null;code:string;label:string;value:string|null;status:string;evidence_strength:string;formula_version:string;source_snapshot:Array<{type:string;id:string;role:string;value:string|null}>;source_state:string;calculated_at:string;recorded_at:string};
