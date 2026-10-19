# BIS Development Model

Reporting follows evidence → capability → change → transfer → outcome. A Lab is an evidence source, not a developmental outcome. Completion, attendance and exposure belong to programme implementation.

The source of dimension definitions remains `content/curriculum/applied-commerce/competency-framework.json` (15 existing competencies). `lab-ancestry.json` traces all 34 catalogue Labs to that curriculum. Ancestry is not an assessment contract: the source audit currently verifies 32 authored Labs, and a shelf without authored assessment evidence cannot certify a capability. The owner’s proposed dimensions guide source review; they are not new automatic labels or a clinical model.

## Four reporting products

| Product | Decision it supports | Evidence presentation |
| --- | --- | --- |
| My Development Portfolio | How am I changing? | Capability fingerprint, comparable dated trajectory, practical acquisition, next practice and original evidence links |
| Learner Development Intelligence | Where does this learner need support? | Strengths, priority, coverage, consistency, watch indicators and relevant approved activities; private reflection excluded |
| Cohort Development Report | What is happening across these learners? | Capability distribution and cohort heatmap, support priorities and programme intervention |
| Programme Outcomes & Impact Report | What development is evidenced, for whom and how strongly? | Assessed growth, continued needs, transfer, exposure, reportable denominators, recommendation and limits |

## Claims and their evidence

| Claim | Required basis |
| --- | --- |
| Participated | Operational participation record; never substituted for capability |
| Understood | Reviewed learning task against its approved criteria; an account remains an account |
| Applied | Matching reviewed rubric plus checked action/work in the optional practical workflow |
| Tested and revised | Dated plan before observation, reviewed observation, comparison and justified adjustment |
| Repeated | Independent assessed use on at least three different evidence days in one comparable source family |
| Transferred | Independent reviewed adaptation in a different context, following earlier independent checked application; distinct work, current source and consent |
| Sustained use | Independent use again after a separately authored follow-up period; absence of a configured period cannot establish this |
| Self-perception alignment | Same source-approved construct and stage scale for rating and reviewed work; no rescaling private answers or personality inference |
| Programme causation | Requires an appropriate evaluation design; these descriptive reports alone cannot establish it |

## Assessment configuration in this release

`practical-assessment-v1.json` adds three optional, separate tasks for **AC-C03: Evidence and accurate thinking** to published exact Lab editions. This is a common investigation-method assessment, supported by the existing framework and authored practical/revision/second-context method. It does not certify every Lab’s subject capability, self-awareness, agency or work readiness automatically. Other capabilities require their own approved source questions, task criteria and reviewed work. Private workbook questions retain their original classification and privacy boundary.

Only this identical pack’s reviewed source hash creates a common comparison family across Labs and editions. All other criteria retain their existing comparison families. A shared capability label alone never establishes measurement equivalence. Reports combine evidence within the learner’s authorised scope; programme reporting deduplicates learners per capability within a group’s explicit multi-Lab plan. Counts across groups or capabilities must not be added because learners overlap.

Learner sharing and programme reporting permission are separate. Facilitators review selected work and enter a basis of direct observation or checked artefact. Simulations, missing opportunities and incomplete criteria cannot become independent practical or transfer evidence. Revoking first-context evidence, superseding its assessment, withdrawing consent/enrolment or retiring its source invalidates dependent transfer at read time without editing history.

The live audit before this release found no assessed application/transfer contracts, and approved question contracts mostly supported self-report at recognition/explanation. The configured method assessment closes one concrete gap. It does not turn that initial dataset into a validated model of every proposed developmental domain.

## Verification

`tests/sql/practical-assessment-staging.sql` runs the actual plan → sharing → rubric → checked stage → learner report → separately permitted programme report across two planned Lab editions, entirely in a rollback transaction against prepared synthetic staging identities. It exercises unsafe claims, wrong-user/group access, revocation and dependent transfer suppression. Never run it on production.

Native PostgreSQL regression tests cover comparison equivalence, exact editions, ownership, consent, enrolment and transfer dependency. Browser tests cover the learner’s saved plan, refresh, explicit sharing, failed-write recovery and the facilitator’s rubric-to-verification journey at 360px, 430px and 1280px.
