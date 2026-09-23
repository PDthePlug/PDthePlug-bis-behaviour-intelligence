# Habit Lab evidence photos

Investigation 2, “Find one piece of evidence”, supports optional camera capture and image selection. Learners can attach, reopen and remove up to five images per Habit enrolment. The description and meaning fields remain separate written responses; photos do not change scoring or satisfy required text fields.

JPEG, PNG and WebP source files up to 20 MiB are decoded locally, limited to 2048 pixels on their longest edge and re-encoded as JPEG. Re-encoding removes source EXIF/location metadata. HEIC, documents and videos are not supported in this release. Stored files are limited to 3 MiB.

Files go directly from the authenticated browser to the private `bis-private-evidence` Supabase bucket. No service-role key, public URL or image CDN is involved. Paths bind the Auth user to their existing BIS learner mapping and Habit enrolment. Insert-only slots `1.jpg` through `5.jpg` enforce the cap across tabs. Existing files cannot be overwritten. Active learner-product consent is required to upload. Read/delete require ownership; staff roles do not confer photo access. Existing project buckets are unaffected.

Images save independently of written responses. During upload, or after an unconfirmed upload, Continue is disabled until success or explicit dismissal of the selected image. A reload of attachments allows checking an ambiguous network result before retrying. Previews are authenticated downloads rendered through temporary object URLs, revoked when closed/unmounted. The existing service worker bypasses external Storage requests and does not cache the images.

## Verification

- Lint and production build pass; 194 acceptance tests pass.
- `tests/sql/evidence-storage-rls.sql` passed against production in a rolled-back transaction with synthetic users. Checks owner reads, anonymous/cross-user isolation, enrollment binding, withdrawn consent, invalid paths, sixth-slot rejection, duplicate insertion and overwrite rejection. No test profiles remain.
- Bucket verified private, JPEG-only, 3 MiB limit.
- Real Android/iOS camera capture and authenticated end-to-end upload/download/removal remain to be verified on a signed-in device. Browser camera/file-picker behavior varies by device.
- Existing Supabase advisory warnings remain for intentional authenticated SECURITY DEFINER RPCs and disabled leaked-password protection. This migration creates no functions and introduced no storage advisory. References: [function execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Release and recovery

Apply the additive bucket/policy migration before deploying the UI. To roll back the UI, redeploy the previous application revision while retaining the private bucket and policies so uploaded learner files are preserved. Do not drop the bucket or delete objects as a code rollback. Account-erasure operations must also remove the account's Storage objects through the Storage API; deleting enrolment rows alone must not be treated as file erasure.
