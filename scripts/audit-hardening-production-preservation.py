"""Compare original production rows with the pre-QA aggregate baseline.

Read-only management queries return only counts and aggregate fingerprints.
Exclude only the user-authorised QA account identities/cohort/email marker.
Never return original learner values or use staging data as an expected result.
"""
import datetime
import json
import os
import pathlib
import re
import urllib.request

if os.environ.get("BIS_HARDENING_ALLOW_PRODUCTION_CHECKS") != "true":
    raise SystemExit("Explicit production verification acknowledgement required.")
fixture = json.loads(pathlib.Path(os.environ["BIS_PRODUCTION_HARDENING_CREDENTIAL_FILE"]).read_text())
group = json.loads(pathlib.Path("/tmp/bis-production-takeover-group.json").read_text())
if fixture["projectRef"] != "swmhsqivqaqwovojbceo" or not group["name"].startswith("BIS verification only 20261007"):
    raise SystemExit("The isolated production QA fixture is required.")
ids = [row["id"] for row in fixture["accounts"]] + [group["id"]]
if not all(re.fullmatch(r"[a-f0-9-]{36}", value) for value in ids):
    raise SystemExit("Invalid QA identity selector.")
baseline = json.loads(pathlib.Path("docs/hardening/production-takeover-record-baseline.json").read_text())
selectors = "array[" + ",".join("'%" + value + "%'" for value in ids) + ",'%takeover-20261007-%']::text[]"
queries = []
for row in baseline["tables"]:
    name = row["relation"]
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", name):
        raise SystemExit("Invalid baseline relation.")
    queries.append(f"select '{name}' as relation, count(*)::integer as records, md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.\"{name}\" t where not (to_jsonb(t)::text like any({selectors}))")
request = urllib.request.Request(
    "https://api.supabase.com/v1/projects/swmhsqivqaqwovojbceo/database/query",
    data=json.dumps({"query": " union all ".join(queries), "read_only": True}).encode(),
    headers={"Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json"},
)
with urllib.request.urlopen(request, timeout=60) as response:
    current = json.load(response)
expected = {row["relation"]: row for row in baseline["tables"]}
changes = [row for row in current if row != expected[row["relation"]]]
report = {"observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "projectRef": fixture["projectRef"], "baseline": "production-takeover-record-baseline.json",
          "comparedTables": len(current), "excluded": "11 newly created QA account UUIDs, the synthetic cohort UUID, and its exact email prefix",
          "result": "PASS" if not changes and len(current) == len(expected) else "REVIEW_REQUIRED",
          "originalRowsReturned": False, "changes": changes, "tables": current}
pathlib.Path("docs/hardening/production-takeover-record-preservation.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: report[key] for key in ["comparedTables", "result", "originalRowsReturned"]}))
if changes:
    print("Changed relations: " + ", ".join(row["relation"] for row in changes))
    raise SystemExit(1)
