"""Register an exact verified staging preview callback, preserving other Auth settings."""
import datetime
import json
import os
import pathlib
import re
import urllib.request

origin = os.environ["BIS_HARDENING_PREVIEW_ORIGIN"]
if not re.fullmatch(r"https://bis-behaviour-intelligence-[a-z0-9]+\.vercel\.app", origin):
    raise SystemExit("An exact BIS deployment origin is required; no wildcard hosts.")
if os.environ.get("NEXT_PUBLIC_SUPABASE_URL") != "https://lbmhkddrkhtmkcvfmumd.supabase.co":
    raise SystemExit("Staging project binding is required.")
url = "https://api.supabase.com/v1/projects/lbmhkddrkhtmkcvfmumd/config/auth"
headers = {"Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json"}

def request(body=None):
    req = urllib.request.Request(url, headers=headers, method="PATCH" if body else "GET",
                                 data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)

before = request()
entries = [entry for entry in before.get("uri_allow_list", "").split(",") if entry]
callback = origin + "/auth/callback**"
if callback not in entries:
    request({"uri_allow_list": ",".join(entries + [callback])})
after = request()
changed = [key for key in set(before) | set(after) if before.get(key) != after.get(key)]
if any(key != "uri_allow_list" for key in changed):
    raise SystemExit("Unexpected Auth setting difference; inspect without printing secrets.")
if callback not in after["uri_allow_list"].split(",") or not set(entries).issubset(after["uri_allow_list"].split(",")):
    raise SystemExit("The callback or preserved origins did not verify.")
path = pathlib.Path("docs/hardening/takeover-preview-callback-registration.json")
history = json.loads(path.read_text()) if path.exists() else {"projectRef": "lbmhkddrkhtmkcvfmumd", "registrations": []}
history["registrations"].append({"observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "origin": origin, "callback": callback, "before": entries, "after": after["uri_allow_list"].split(","),
    "changedSettings": changed, "otherAuthSettingsPreserved": True, "productionConfigurationChanged": False,
    "deliveryVerified": False, "result": "PASS"})
path.write_text(json.dumps(history, indent=2) + "\n")
print(json.dumps({"origin": origin, "result": "PASS", "otherAuthSettingsPreserved": True}))
