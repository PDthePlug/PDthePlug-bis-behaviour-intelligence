"""Provision user-authorised, isolated QA accounts without exporting admin keys.

The credential file is private and outside the repository. Existing staging
fixtures may be recovered by rotating only their QA passwords; learner records
and assigned roles are retained. Production creation requires an explicit flag.
"""
import datetime
import json
import os
import pathlib
import secrets
import urllib.error
import urllib.request
import uuid

target = os.environ.get("BIS_HARDENING_ACCOUNT_TARGET", "staging")
projects = {"staging": "lbmhkddrkhtmkcvfmumd", "production": "swmhsqivqaqwovojbceo"}
if target not in projects or os.environ.get("BIS_HARDENING_ALLOW_ACCOUNT_PROVISIONING") != target:
    raise SystemExit("Explicit account provisioning acknowledgement required.")
ref = projects[target]
credential_path = pathlib.Path(os.environ["BIS_HARDENING_CREDENTIAL_OUTPUT"])
if credential_path.resolve().is_relative_to(pathlib.Path.cwd()) or credential_path.exists():
    raise SystemExit("Use a new private credential file outside the repository.")
token = os.environ["SUPABASE_ACCESS_TOKEN"]


def request(url, headers, body=None, method=None):
    req = urllib.request.Request(url, headers=headers,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Account provisioning request returned HTTP {error.code}; sensitive body omitted.") from None


management = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}


def query(sql):
    return request(f"https://api.supabase.com/v1/projects/{ref}/database/query", management, {"query": sql})


keys = request(f"https://api.supabase.com/v1/projects/{ref}/api-keys?reveal=true", management)
admin_key = next(row["api_key"] for row in keys if row["name"] == "service_role")
publishable_key = next(row["api_key"] for row in keys if row["api_key"].startswith("sb_publishable_"))
auth_headers = {"Authorization": "Bearer " + admin_key, "apikey": admin_key, "Content-Type": "application/json"}
accounts = []
credential_path.parent.mkdir(parents=True, exist_ok=True)


def persist():
    descriptor = os.open(credential_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump({"projectRef": ref, "publishableKey": publishable_key, "accounts": accounts}, output)


if target == "staging":
    fixtures = query("""select u.id, u.email,
      coalesce((select r.role from public.role_assignments r where (r.user_id=u.id::text or lower(r.principal_email)=lower(u.email)) and r.status='ACTIVE' order by r.role limit 1),'LEARNER') as role
      from auth.users u where u.email like 'fullscope-20261006-%@bis-staging.example.invalid' order by u.email""")
    if not fixtures:
        raise SystemExit("No prior dedicated staging fixtures matched; no ordinary accounts changed.")
    for fixture in fixtures:
        password = secrets.token_urlsafe(32)
        request(f"https://{ref}.supabase.co/auth/v1/admin/users/{fixture['id']}", auth_headers,
                {"password": password}, "PUT")
        accounts.append({"email": fixture["email"], "password": password, "role": fixture["role"], "id": fixture["id"]})
        persist()
else:
    roles = ["SYSTEM_ADMIN", "FACILITATOR", "SPONSOR_VIEWER", "PROGRAMME_OWNER", "SAFEGUARDING_OFFICER"] + ["LEARNER"] * 6
    for index, role in enumerate(roles):
        email = f"takeover-20261007-{index:02}-{uuid.uuid4().hex[:8]}@bis-qa.invalid"
        password = secrets.token_urlsafe(32)
        user = request(f"https://{ref}.supabase.co/auth/v1/admin/users", auth_headers,
                       {"email": email, "password": password, "email_confirm": True,
                        "user_metadata": {"full_name": f"BIS verification account {index + 1}", "qa_fixture": "takeover-20261007"}})
        accounts.append({"email": email, "password": password, "role": role, "id": user["id"]})
        persist()
        if role in ["SYSTEM_ADMIN", "FACILITATOR", "SAFEGUARDING_OFFICER"]:
            query(f"""insert into public.role_assignments
             (id,principal_email,user_id,role,scope_type,scope_id,status,assigned_by)
             values ('{uuid.uuid4()}','{email}','{user['id']}','{role}','GLOBAL','GLOBAL','ACTIVE','BIS user-authorised takeover verification 20261007')""")

record = {"observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "projectRef": ref,
          "target": target, "accountCount": len(accounts), "roles": sorted({row["role"] for row in accounts}),
          "operation": "Rotate existing dedicated QA passwords" if target == "staging" else "Create user-authorised isolated QA accounts",
          "originalLearnerEvidenceModified": False, "adminKeyPersisted": False, "credentialValuesExported": False,
          "boundary": "Account creation does not prove email delivery. Production sponsor/owner access must be assigned only to the synthetic cohort."}
pathlib.Path(f"docs/hardening/{target}-takeover-account-provisioning.json").write_text(json.dumps(record, indent=2) + "\n")
print(f"{target}: {len(accounts)} dedicated verification accounts ready; credentials private.")
