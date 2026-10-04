const STAGING_REF = "lbmhkddrkhtmkcvfmumd";
const PRODUCTION_REF = "swmhsqivqaqwovojbceo";

function projectRef(value: string) {
  return new URL(value).hostname.split(".")[0];
}

export default function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for staging certification.");
  const ref = projectRef(url);
  if (ref === PRODUCTION_REF) {
    throw new Error(`REFUSING STAGING CERTIFICATION: active backend ${ref} is BIS Production.`);
  }
  if (ref !== STAGING_REF) {
    throw new Error(`REFUSING STAGING CERTIFICATION: expected ${STAGING_REF}, received ${ref || "an invalid project reference"}.`);
  }
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "BIS_STAGING_LEARNER_EMAIL",
    "BIS_STAGING_LEARNER_PASSWORD",
    "BIS_STAGING_ADMIN_EMAIL",
    "BIS_STAGING_ADMIN_PASSWORD",
  ]) {
    if (!process.env[name]) throw new Error(`${name} is required and must be supplied outside source control.`);
  }
}
