"use client";
import {DevelopmentReviewControl,DevelopmentReportingPermission} from '../../../../../app/development-review-controls';
import {DevelopmentIntelligencePanel} from '../../../../../app/development-intelligence-panel';
import type {EvidenceSubmission} from '../../../../../lib/evidence-engine';
const submission={id:'shared-task',user_id:'learner',cohort_id:'group',title:'Shared task',current:true,revoked_at:null,created_at:'2026-10-01',evidence:[{id:'evidence',semantic_field_id:'TASK.EXPLAIN'}],reviews:[{id:'human-assessment',disposition:'REVIEWED'}]} as unknown as EvidenceSubmission;
export default function Page(){return <main><DevelopmentReviewControl cohortId="group" submission={submission}/><DevelopmentReportingPermission submissionId="shared-task"/><DevelopmentIntelligencePanel audience="learner"/></main>;}
