"""Read both BIS Auth configurations without exporting provider credentials.

Requires the cloud's SUPABASE_ACCESS_TOKEN binding. No configuration is mutated.
The current API reference is /docs/reference/api/v1-get-auth-service-config.
"""
import datetime
import json
import os
import pathlib
import re
import urllib.error
import urllib.request

token = os.environ.get("SUPABASE_ACCESS_TOKEN")
if not token:
    raise SystemExit("The running environment needs a ready SUPABASE_ACCESS_TOKEN binding.")

projects = {"staging": "lbmhkddrkhtmkcvfmumd", "production": "swmhsqivqaqwovojbceo"}
observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
configs = {}
for name, ref in projects.items():
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/config/auth",
        headers={"Authorization": "Bearer " + token},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            configs[name] = json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"{name} Auth configuration returned HTTP {error.code}; no response body or credential logged.") from None


def private_field(key, value):
    # Strings containing credentials, personal SMTP selectors and templates are
    # represented only by presence. Numeric/boolean password policy is retained.
    return isinstance(value, str) and bool(re.search(
        r"secret|password|token|api_key|private_key|smtp_(user|admin_email)|template", key, re.I
    ))


def safe_value(key, value):
    if private_field(key, value):
        return {"valueOmitted": True, "configured": bool(value)}
    if isinstance(value, dict):
        return {child: safe_value(child, item) for child, item in value.items()}
    if isinstance(value, list):
        return [safe_value(key, item) for item in value]
    return value


output = pathlib.Path("docs/hardening")
output.mkdir(parents=True, exist_ok=True)
for name, config in configs.items():
    (output / f"{name}-auth-configuration.json").write_text(json.dumps({
        "projectRef": projects[name], "observedAt": observed,
        "source": "GET /v1/projects/{ref}/config/auth",
        "configuration": {key: safe_value(key, value) for key, value in config.items()},
    }, indent=2) + "\n")

differences = []
for key in sorted(set(configs["staging"]) | set(configs["production"])):
    staging, production = configs["staging"].get(key), configs["production"].get(key)
    if staging != production:
        differences.append({"setting": key, "staging": safe_value(key, staging),
                            "production": safe_value(key, production), "valuesDiffer": True})
(output / "auth-configuration-differences.json").write_text(json.dumps({
    "observedAt": observed, "comparedSettings": len(set(configs["staging"]) | set(configs["production"])),
    "differences": differences, "configurationModified": False,
    "boundary": "Provider credentials and SMTP identities/templates omitted; comparisons performed in memory. Recovery delivery requires a real approved inbox.",
}, indent=2) + "\n")
print(f"Compared {len(configs['staging'])} staging / {len(configs['production'])} production settings; {len(differences)} differences. Secret values omitted.")
