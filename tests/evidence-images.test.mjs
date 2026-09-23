import test from "node:test";
import assert from "node:assert/strict";
import { validateEvidenceImage, evidenceImageSize, nextEvidenceSlot, MAX_SOURCE_BYTES } from "../lib/evidence-images.mjs";

test("evidence images reject executable, empty and oversized files", () => {
  for (const type of ["image/svg+xml", "text/html", "application/javascript", ""]) assert.throws(() => validateEvidenceImage({ type, size: 100 }));
  assert.throws(() => validateEvidenceImage({ type: "image/jpeg", size: 0 }));
  assert.throws(() => validateEvidenceImage({ type: "image/jpeg", size: MAX_SOURCE_BYTES + 1 }));
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.doesNotThrow(() => validateEvidenceImage({ type, size: 100 }));
});
test("camera images resize without distortion or enlarging small photos", () => {
  assert.deepEqual(evidenceImageSize(4000, 3000), { width: 2048, height: 1536 });
  assert.deepEqual(evidenceImageSize(3000, 4000), { width: 1536, height: 2048 });
  assert.deepEqual(evidenceImageSize(500, 200), { width: 500, height: 200 });
  assert.throws(() => evidenceImageSize(0, 200));
  assert.throws(() => evidenceImageSize(20000, 20000));
});
test("attachment allocation cannot exceed five slots and can reuse a removed slot", () => {
  assert.equal(nextEvidenceSlot([]), "1.jpg");
  assert.equal(nextEvidenceSlot(["1.jpg", "3.jpg", "4.jpg", "5.jpg"]), "2.jpg");
  assert.throws(() => nextEvidenceSlot(["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]));
});
