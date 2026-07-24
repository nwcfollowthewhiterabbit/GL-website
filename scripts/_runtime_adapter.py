"""Configured website-only runtime operations for the Green Leaf testing stack."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "infra" / "runtime.testing.json"
CONTRACT_VERSION = "1.0"
SHA = re.compile(r"^[a-f0-9]{40}$")
RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
OPERATIONS = {
    "backup",
    "deploy_first_instance",
    "deploy_existing_instance",
    "restore",
    "validate_instance",
    "validate_domain",
    "validate_mvp_e2e",
    "validate_ui_e2e",
}


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def load_config() -> dict[str, Any]:
    value = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    required = {
        "environment",
        "target",
        "ssh_alias",
        "repository_path",
        "backup_root",
        "branch",
        "public_url",
        "compose_command",
        "compose_services",
        "containers",
    }
    if set(value) != required:
        raise ValueError("runtime config keys do not match the configured adapter")
    if value["environment"] != "testing" or value["target"] != "testing.greenleafpacific.com":
        raise ValueError("runtime adapter only permits the configured testing target")
    return value


def run(command: list[str], *, input_text: str | None = None, timeout: int = 900) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        input=input_text,
        capture_output=True,
        text=True,
        check=False,
        timeout=timeout,
    )
    if result.returncode != 0:
        detail = " ".join((result.stderr or result.stdout).strip().split())
        raise RuntimeError(f"{command[0]} failed ({result.returncode}): {detail[:500]}")
    return result.stdout.strip()


def ssh(config: dict[str, Any], script: str, *arguments: str, timeout: int = 900) -> str:
    return run(
        ["ssh", config["ssh_alias"], "bash", "-s", "--", *arguments],
        input_text=script,
        timeout=timeout,
    )


def current_revision() -> str:
    revision = run(["git", "-C", str(ROOT), "rev-parse", "HEAD"])
    if not SHA.fullmatch(revision):
        raise RuntimeError("local source revision is invalid")
    return revision


def verify_ci(expected_sha: str) -> str:
    output = run([
        "gh",
        "run",
        "list",
        "--repo",
        "nwcfollowthewhiterabbit/GL-website",
        "--workflow",
        "CI",
        "--commit",
        expected_sha,
        "--limit",
        "5",
        "--json",
        "status,conclusion,headSha,url",
    ], timeout=60)
    runs = json.loads(output)
    matching = [
        item
        for item in runs
        if item.get("headSha") == expected_sha
        and item.get("status") == "completed"
        and item.get("conclusion") == "success"
    ]
    if not matching:
        raise RuntimeError("successful CI run for expected SHA was not found")
    return matching[0]["url"]


def evidence_base(operation: str, config: dict[str, Any], run_id: str, started_at: str) -> dict[str, Any]:
    return {
        "contract_version": CONTRACT_VERSION,
        "operation": operation,
        "run_id": run_id,
        "environment": config["environment"],
        "target": config["target"],
        "source_revision": current_revision(),
        "status": "passed",
        "started_at": started_at,
        "finished_at": utc_now(),
        "checks": [{"name": "operation_contract", "status": "passed"}],
    }


def write_evidence(payload: dict[str, Any], path_value: str | None) -> None:
    text = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    if path_value:
        path = Path(path_value)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text + "\n", encoding="utf-8")
    print(text)


def artifact_digest(value: str) -> str:
    return f"sha256:{hashlib.sha256(value.encode()).hexdigest()}"


def backup_reference_for(config: dict[str, Any], value: str) -> str:
    prefix = f"{config['backup_root']}/"
    if not value.startswith(prefix) or not RUN_ID.fullmatch(value[len(prefix):]):
        raise ValueError("backup reference is outside the configured backup root")
    return value


def restore_plan_reference_for(config: dict[str, Any], value: str) -> str:
    prefix = f"{config['backup_root']}/restore-plans/"
    suffix = value[len(prefix):] if value.startswith(prefix) else ""
    run_id = suffix[:-5] if suffix.endswith(".json") else ""
    if not RUN_ID.fullmatch(run_id):
        raise ValueError("restore plan reference is outside the configured restore-plan root")
    return value


def contract_test_evidence(operation: str, config: dict[str, Any], run_id: str, started_at: str) -> dict[str, Any]:
    payload = evidence_base(operation, config, run_id, started_at)
    reference = f"contract-test/{run_id}/{operation}"
    if operation == "backup":
        payload.update(
            {
                "backup_reference": reference,
                "artifacts": [
                    {
                        "kind": "contract-test-manifest",
                        "path": "manifest.json",
                        "sha256": hashlib.sha256(reference.encode()).hexdigest(),
                        "size_bytes": len(reference),
                        "contains_secrets": False,
                        "restore_critical": True,
                    }
                ],
            }
        )
    elif operation == "deploy_first_instance":
        payload.update(
            {
                "artifact_digest": artifact_digest(reference),
                "release_reference": reference,
                "target_precondition_reference": f"{reference}/empty-target",
                "rollback_reference": f"{reference}/rollback",
            }
        )
    elif operation == "deploy_existing_instance":
        payload.update(
            {
                "artifact_digest": artifact_digest(reference),
                "release_reference": reference,
                "backup_reference": f"{reference}/backup",
                "rollback_reference": f"{reference}/rollback",
            }
        )
    elif operation == "restore":
        payload.update(
            {
                "backup_reference": f"{reference}/backup",
                "restore_plan_reference": f"{reference}/plan",
                "rollback_reference": f"{reference}/diagnostic-backup",
            }
        )
    else:
        payload["test_run_reference"] = reference
        if operation != "validate_instance":
            payload["cleanup_status"] = "not_applicable"
        if operation == "validate_ui_e2e":
            payload["tested_roles"] = ["Anonymous", "Customer"]
    return payload


BACKUP_SCRIPT = r"""
set -euo pipefail
repo="$1"
backup_root="$2"
run_id="$3"
test -d "$repo/.git"
revision="$(git -C "$repo" rev-parse HEAD)"
dest="$backup_root/$run_id"
test ! -e "$dest"
mkdir -p "$dest"
chmod 700 "$backup_root" "$dest"
files=()
test ! -f "$repo/.env" || files+=(".env")
test ! -d "$repo/public/uploads" || files+=("public/uploads")
test ! -d "$repo/uploads" || files+=("uploads")
if [ "${#files[@]}" -gt 0 ]; then
  tar -C "$repo" -czf "$dest/website-state.tar.gz" "${files[@]}"
else
  tar -C "$repo" -czf "$dest/website-state.tar.gz" --files-from /dev/null
fi
chmod 600 "$dest/website-state.tar.gz"
archive_sha="$(sha256sum "$dest/website-state.tar.gz" | awk '{print $1}')"
archive_size="$(wc -c < "$dest/website-state.tar.gz" | tr -d ' ')"
image_ids="$(docker inspect --format '{{.Name}} {{.Image}}' \
  testinggreenleafpacificcom_api_1 testinggreenleafpacificcom_web_1 \
  testinggreenleafpacificcom_monitor_1 2>/dev/null || true)"
python3 - "$dest/manifest.json" "$revision" "$archive_sha" "$archive_size" "$image_ids" <<'PY'
import json, sys
path, revision, digest, size, images = sys.argv[1:]
with open(path, "w", encoding="utf-8") as handle:
    json.dump({
        "schema_version": 1,
        "source_revision": revision,
        "archive": "website-state.tar.gz",
        "archive_sha256": digest,
        "archive_size_bytes": int(size),
        "container_images": images.splitlines()
    }, handle, sort_keys=True)
    handle.write("\n")
PY
chmod 600 "$dest/manifest.json"
manifest_sha="$(sha256sum "$dest/manifest.json" | awk '{print $1}')"
manifest_size="$(wc -c < "$dest/manifest.json" | tr -d ' ')"
printf '{"reference":"%s","revision":"%s","archive_sha":"%s","archive_size":%s,"manifest_sha":"%s","manifest_size":%s}\n' \
  "$dest" "$revision" "$archive_sha" "$archive_size" "$manifest_sha" "$manifest_size"
"""


def create_backup(config: dict[str, Any], run_id: str, started_at: str) -> dict[str, Any]:
    result = json.loads(
        ssh(config, BACKUP_SCRIPT, config["repository_path"], config["backup_root"], run_id)
    )
    payload = evidence_base("backup", config, run_id, started_at)
    payload.update(
        {
            "source_revision": result["revision"],
            "backup_reference": result["reference"],
            "artifacts": [
                {
                    "kind": "website-state",
                    "path": "website-state.tar.gz",
                    "sha256": result["archive_sha"],
                    "size_bytes": result["archive_size"],
                    "contains_secrets": True,
                    "restore_critical": True,
                },
                {
                    "kind": "backup-manifest",
                    "path": "manifest.json",
                    "sha256": result["manifest_sha"],
                    "size_bytes": result["manifest_size"],
                    "contains_secrets": False,
                    "restore_critical": True,
                },
            ],
        }
    )
    return payload


DEPLOY_SCRIPT = r"""
set -euo pipefail
repo="$1"
branch="$2"
expected="$3"
compose="$4"
migrate_schema="$5"
shift 5
test -d "$repo/.git"
test -z "$(git -C "$repo" status --porcelain)"
if [ "$(git -C "$repo" branch --show-current)" != "$branch" ]; then
  git -C "$repo" switch "$branch"
fi
git -C "$repo" fetch --quiet origin "$branch"
remote="$(git -C "$repo" rev-parse "origin/$branch")"
test "$remote" = "$expected"
git -C "$repo" merge-base --is-ancestor HEAD "$expected"
git -C "$repo" merge --ff-only "$expected"
"$compose" -f "$repo/docker-compose.yml" build "$@"
if [ "$migrate_schema" = "true" ]; then
  "$compose" -f "$repo/docker-compose.yml" run --rm -T api npm run erpnext:migrate-website
else
  "$compose" -f "$repo/docker-compose.yml" run --rm -T api npm run erpnext:check-website-migrations
fi
"$compose" -f "$repo/docker-compose.yml" up -d --no-build "$@"
test "$(git -C "$repo" rev-parse HEAD)" = "$expected"
images="$(docker inspect --format '{{.Name}} {{.Image}}' \
  testinggreenleafpacificcom_api_1 testinggreenleafpacificcom_web_1 \
  testinggreenleafpacificcom_monitor_1)"
python3 - "$expected" "$images" <<'PY'
import json, sys
revision, images = sys.argv[1:]
print(json.dumps({"revision": revision, "images": images.splitlines()}, sort_keys=True))
PY
"""

RESTORE_PLAN_SCRIPT = r"""
set -euo pipefail
backup_root="$1"
reference="$2"
run_id="$3"
token_hash="$4"
expires="$5"
case "$reference" in "$backup_root"/*) ;; *) exit 20 ;; esac
test -f "$reference/manifest.json"
test -f "$reference/website-state.tar.gz"
expected="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["archive_sha256"])' "$reference/manifest.json")"
actual="$(sha256sum "$reference/website-state.tar.gz" | awk '{print $1}')"
test "$expected" = "$actual"
plans="$backup_root/restore-plans"
mkdir -p "$plans"
chmod 700 "$plans"
python3 - "$plans/$run_id.json" "$reference" "$token_hash" "$expires" <<'PY'
import json, sys
path, reference, token_hash, expires = sys.argv[1:]
with open(path, "w", encoding="utf-8") as handle:
    json.dump({
        "backup_reference": reference,
        "confirmation_token_sha256": token_hash,
        "expires_at": expires,
        "used": False
    }, handle, sort_keys=True)
    handle.write("\n")
PY
chmod 600 "$plans/$run_id.json"
printf '%s\n' "$plans/$run_id.json"
"""

RESTORE_EXECUTE_SCRIPT = r"""
set -euo pipefail
repo="$1"
backup_root="$2"
plan="$3"
token_hash="$4"
compose="$5"
shift 5
case "$plan" in "$backup_root"/restore-plans/*) ;; *) exit 20 ;; esac
test -f "$plan"
readarray -t values < <(python3 - "$plan" "$token_hash" <<'PY'
import datetime as dt, json, sys
path, supplied = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    plan = json.load(handle)
expires = dt.datetime.fromisoformat(plan["expires_at"].replace("Z", "+00:00"))
if plan.get("used") or supplied != plan["confirmation_token_sha256"] or expires <= dt.datetime.now(dt.timezone.utc):
    raise SystemExit(21)
print(plan["backup_reference"])
PY
)
reference="${values[0]}"
case "$reference" in "$backup_root"/*) ;; *) exit 20 ;; esac
manifest="$reference/manifest.json"
archive="$reference/website-state.tar.gz"
expected="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["archive_sha256"])' "$manifest")"
actual="$(sha256sum "$archive" | awk '{print $1}')"
test "$expected" = "$actual"
revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["source_revision"])' "$manifest")"
git -C "$repo" cat-file -e "$revision^{commit}"
python3 - "$archive" <<'PY'
import pathlib, sys, tarfile
archive = sys.argv[1]
with tarfile.open(archive, "r:gz") as handle:
    for member in handle.getmembers():
        path = pathlib.PurePosixPath(member.name)
        allowed = (
            member.name == ".env"
            or member.name == "public/uploads"
            or member.name.startswith("public/uploads/")
            or member.name == "uploads"
            or member.name.startswith("uploads/")
        )
        if path.is_absolute() or ".." in path.parts or not allowed:
            raise SystemExit(22)
        if member.issym() or member.islnk() or member.isdev():
            raise SystemExit(23)
PY
git -C "$repo" switch --detach "$revision"
rm -f "$repo/.env"
rm -rf "$repo/public/uploads" "$repo/uploads"
tar -C "$repo" -xzf "$archive" --no-same-owner --no-same-permissions
"$compose" -f "$repo/docker-compose.yml" build "$@"
if node -e 'const p=require(process.argv[1]); process.exit(p.scripts?.["erpnext:check-website-migrations"] ? 0 : 1)' "$repo/package.json"; then
  "$compose" -f "$repo/docker-compose.yml" run --rm -T api npm run erpnext:check-website-migrations
fi
"$compose" -f "$repo/docker-compose.yml" up -d --no-build "$@"
python3 - "$plan" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    plan = json.load(handle)
plan["used"] = True
with open(path, "w", encoding="utf-8") as handle:
    json.dump(plan, handle, sort_keys=True)
    handle.write("\n")
PY
printf '{"revision":"%s","backup_reference":"%s"}\n' "$revision" "$reference"
"""


def validate_public(config: dict[str, Any]) -> list[dict[str, str]]:
    import time

    checks = []
    for path in ("/health", "/api/storefront/diagnostics", "/api/payments/config"):
        last_error: Exception | None = None
        for attempt in range(12):
            try:
                with urllib.request.urlopen(f"{config['public_url']}{path}", timeout=20) as response:
                    if response.status != 200:
                        raise RuntimeError(f"{path} returned HTTP {response.status}")
                    payload = json.loads(response.read())
                    if path == "/health" and payload.get("ok") is not True:
                        raise RuntimeError("health response is not healthy")
                    if path.endswith("diagnostics") and payload.get("healthy") is not True:
                        raise RuntimeError("storefront diagnostics are degraded")
                    if path.endswith("/config") and payload.get("enabled") is not False:
                        raise RuntimeError("testing payment must remain disabled before UAT activation")
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                if attempt < 11:
                    time.sleep(5)
        if last_error:
            raise last_error
        checks.append({"name": path, "status": "passed"})
    request = urllib.request.Request(config["public_url"], method="HEAD")
    with urllib.request.urlopen(request, timeout=20) as response:
        if "noindex" not in response.headers.get("x-robots-tag", ""):
            raise RuntimeError("testing noindex header is missing")
    checks.append({"name": "testing_noindex", "status": "passed"})
    return checks


def deploy_existing(
    config: dict[str, Any],
    expected_sha: str,
    run_id: str,
    started_at: str,
    migrate_schema: bool,
) -> dict[str, Any]:
    if not SHA.fullmatch(expected_sha):
        raise ValueError("expected SHA must be a full 40-character commit")
    ci_reference = verify_ci(expected_sha)
    backup = create_backup(config, f"{run_id}-backup", started_at)
    deployed = json.loads(ssh(
        config,
        DEPLOY_SCRIPT,
        config["repository_path"],
        config["branch"],
        expected_sha,
        config["compose_command"],
        "true" if migrate_schema else "false",
        *config["compose_services"],
        timeout=1800,
    ))
    checks = validate_public(config)
    payload = evidence_base("deploy_existing_instance", config, run_id, started_at)
    payload.update(
        {
            "source_revision": deployed["revision"],
            "artifact_digest": artifact_digest("\n".join(sorted(deployed["images"]))),
            "release_reference": f"git:{deployed['revision']}",
            "backup_reference": backup["backup_reference"],
            "rollback_reference": f"git:{backup['source_revision']}",
            "checks": [
                {"name": "exact_sha_ci", "status": "passed", "detail": ci_reference},
                {"name": "verified_backup", "status": "passed"},
                {
                    "name": "website_schema",
                    "status": "passed",
                    "detail": "migrated" if migrate_schema else "verified",
                },
                *checks
            ],
        }
    )
    return payload


def create_restore_plan(config: dict[str, Any], backup_reference: str, run_id: str) -> dict[str, str]:
    backup_reference = backup_reference_for(config, backup_reference)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=15)).isoformat().replace("+00:00", "Z")
    plan = ssh(
        config,
        RESTORE_PLAN_SCRIPT,
        config["backup_root"],
        backup_reference,
        run_id,
        token_hash,
        expires,
    )
    return {
        "status": "planned",
        "operation": "restore",
        "restore_plan_reference": plan,
        "backup_reference": backup_reference,
        "confirmation_token": token,
        "expires_at": expires,
    }


def execute_restore(
    config: dict[str, Any],
    plan_reference: str,
    confirmation_token: str,
    run_id: str,
    started_at: str,
) -> dict[str, Any]:
    if not plan_reference or not confirmation_token:
        raise ValueError("restore plan and confirmation token are required")
    plan_reference = restore_plan_reference_for(config, plan_reference)
    diagnostic = create_backup(config, f"{run_id}-diagnostic", started_at)
    restored = json.loads(ssh(
        config,
        RESTORE_EXECUTE_SCRIPT,
        config["repository_path"],
        config["backup_root"],
        plan_reference,
        hashlib.sha256(confirmation_token.encode()).hexdigest(),
        config["compose_command"],
        *config["compose_services"],
        timeout=1800,
    ))
    checks = validate_public(config)
    payload = evidence_base("restore", config, run_id, started_at)
    payload.update(
        {
            "source_revision": restored["revision"],
            "backup_reference": restored["backup_reference"],
            "restore_plan_reference": plan_reference,
            "rollback_reference": diagnostic["backup_reference"],
            "checks": [{"name": "diagnostic_backup", "status": "passed"}, *checks],
        }
    )
    return payload


def validation(operation: str, config: dict[str, Any], run_id: str, started_at: str) -> dict[str, Any]:
    commands = {
        "validate_domain": ["npm", "run", "test:integration"],
        "validate_mvp_e2e": ["npm", "run", "smoke"],
        "validate_ui_e2e": ["npm", "run", "visual:smoke"],
    }
    old_smoke = os.environ.get("SMOKE_BASE_URL")
    old_visual = os.environ.get("VISUAL_BASE_URL")
    os.environ["SMOKE_BASE_URL"] = config["public_url"]
    os.environ["VISUAL_BASE_URL"] = config["public_url"]
    try:
        if operation == "validate_instance":
            remote = json.loads(
                ssh(
                    config,
                    r"""
set -euo pipefail
repo="$1"
shift
revision="$(git -C "$repo" rev-parse HEAD)"
statuses="$(docker inspect --format '{{.Name}} {{.State.Status}}' "$@")"
python3 - "$revision" "$statuses" <<'PY'
import json, sys
revision, statuses = sys.argv[1:]
print(json.dumps({"revision": revision, "containers": statuses.splitlines()}, sort_keys=True))
PY
""",
                    config["repository_path"],
                    *config["containers"],
                    timeout=60,
                )
            )
            if any(not value.endswith(" running") for value in remote["containers"]):
                raise RuntimeError("one or more website containers are not running")
            checks = [
                {
                    "name": "remote_source_revision",
                    "status": "passed",
                    "detail": remote["revision"],
                },
                {"name": "website_containers", "status": "passed"},
                *validate_public(config),
            ]
        else:
            run(commands[operation], timeout=900)
            checks = [{"name": commands[operation][-1], "status": "passed"}]
    finally:
        if old_smoke is None:
            os.environ.pop("SMOKE_BASE_URL", None)
        else:
            os.environ["SMOKE_BASE_URL"] = old_smoke
        if old_visual is None:
            os.environ.pop("VISUAL_BASE_URL", None)
        else:
            os.environ["VISUAL_BASE_URL"] = old_visual
    payload = evidence_base(operation, config, run_id, started_at)
    payload["checks"] = checks
    payload["test_run_reference"] = f"runtime:{run_id}"
    if operation != "validate_instance":
        payload["cleanup_status"] = "not_applicable"
    if operation == "validate_ui_e2e":
        payload["tested_roles"] = ["Anonymous", "Customer"]
    return payload




def blocked_evidence(operation: str, config: dict[str, Any], run_id: str, started_at: str, reason: str) -> dict[str, Any]:
    payload = evidence_base(operation, config, run_id, started_at)
    payload["status"] = "blocked"
    payload["checks"] = [{"name": "preconditions", "status": "blocked", "detail": reason}]
    return payload


def parser_for(operation: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract-probe", action="store_true")
    parser.add_argument("--contract-test", action="store_true")
    parser.add_argument("--evidence")
    parser.add_argument("--run-id")
    parser.add_argument("--expected-sha")
    parser.add_argument("--migrate-schema", action="store_true")
    parser.add_argument("--backup-reference")
    parser.add_argument("--restore-plan")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--confirmation-token")
    parser.add_argument("--plan")
    return parser


def main(operation: str) -> None:
    if operation not in OPERATIONS:
        raise SystemExit(2)
    args = parser_for(operation).parse_args()
    config = load_config()
    if args.contract_probe:
        print(json.dumps({
            "contract_version": CONTRACT_VERSION,
            "operation": operation,
            "configured": True,
            "status": "ready",
        }, sort_keys=True))
        raise SystemExit(0)

    started_at = utc_now()
    run_id = (
        args.run_id
        or os.environ.get("FOUNDATION_CONTRACT_RUN_ID")
        or f"GL-WEB-{dt.datetime.now(dt.timezone.utc):%Y%m%dT%H%M%SZ}-{secrets.token_hex(4)}"
    )
    if not RUN_ID.fullmatch(run_id):
        raise SystemExit("run id must contain only letters, digits, dots, underscores, and hyphens")
    evidence_path = (
        args.evidence
        or os.environ.get("FOUNDATION_CONTRACT_EVIDENCE_PATH")
        or str(ROOT / ".evidence" / f"{operation}-{run_id}.json")
    )
    try:
        if args.contract_test:
            payload = contract_test_evidence(operation, config, run_id, started_at)
        elif operation == "restore" and not args.execute:
            print(json.dumps(create_restore_plan(config, args.backup_reference or "", run_id), sort_keys=True))
            raise SystemExit(0)
        elif not args.execute:
            payload = blocked_evidence(
                operation,
                config,
                run_id,
                started_at,
                "explicit --execute is required; no runtime action was performed",
            )
        elif operation == "backup":
            payload = create_backup(config, run_id, started_at)
        elif operation == "deploy_existing_instance":
            payload = deploy_existing(
                config,
                args.expected_sha or "",
                run_id,
                started_at,
                args.migrate_schema,
            )
        elif operation in {"validate_instance", "validate_domain", "validate_mvp_e2e", "validate_ui_e2e"}:
            payload = validation(operation, config, run_id, started_at)
        elif operation == "restore":
            payload = execute_restore(
                config,
                args.restore_plan or "",
                args.confirmation_token or "",
                run_id,
                started_at,
            )
        elif operation == "deploy_first_instance":
            payload = blocked_evidence(
                operation,
                config,
                run_id,
                started_at,
                "configured testing target already exists; use deploy_existing_instance",
            )
        write_evidence(payload, evidence_path)
        raise SystemExit(0 if payload["status"] == "passed" else 3)
    except Exception as exc:
        payload = blocked_evidence(operation, config, run_id, started_at, str(exc))
        write_evidence(payload, evidence_path)
        raise SystemExit(1)
