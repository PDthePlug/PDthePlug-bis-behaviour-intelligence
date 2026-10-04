import assert from "node:assert/strict";
import test from "node:test";
import { loadContentTools } from "../scripts/lib/load-content-tools.mjs";
const tools = await loadContentTools();
test.after(() => tools.dispose());

test("structural defects cannot be waived by an editorial acknowledgement", () => {
  assert.equal(tools.editorialReviewComplete({editorialStatus:"BLOCKED"}, {editorial_review:true}, "Checked the authored content and accepted the intentional repetitions."), false);
});
test("review requires an explicit decision and meaningful notes", () => {
  const report = {editorialStatus:"REVIEW"};
  assert.equal(tools.editorialReviewComplete(report, {}, "These repeated questions measure a pre/post change."), false);
  assert.equal(tools.editorialReviewComplete(report, {editorial_review:true}, "OK"), false);
  assert.equal(tools.editorialReviewComplete(report, {editorial_review:true}, "These repeated questions measure a pre/post change."), true);
});
test("an editorial decision does not replace the six learner experience checks", () => {
  const checklist=tools.normalizeUatChecklist({editorial_review:true});
  assert.equal(tools.checklistComplete(checklist), false);
  for (const check of tools.CONTENT_UAT_CHECKS) checklist[check.id]=true;
  assert.equal(tools.checklistComplete(checklist), true);
});
test("exact artifact identity changes invalidate signoff", async () => {
  const artifacts=[{artifactKey:"lab:universal",artifactHash:"a"}];
  assert.notEqual(await tools.artifactFingerprint(artifacts),await tools.artifactFingerprint([{...artifacts[0],artifactHash:"b"}]));
});
