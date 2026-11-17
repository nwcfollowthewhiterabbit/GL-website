"""Guarded operator for the active website targets, not legacy adapters.

Run only after owner/coordinator-approved exact-source CI and a fresh successful
backup receipt. This script contains no credentials; native mail credentials are
passed exclusively through remote subprocess memory into protected website.env.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("target", choices=["stage", "production"])
parser.add_argument("--source-sha", required=True)
parser.add_argument("--api-image", required=True)
parser.add_argument("--web-image", required=True)
parser.add_argument("--backup-receipt", required=True)
parser.add_argument("--ci-receipt", required=True)
args = parser.parse_args()
assert os.geteuid() == 0
assert re.fullmatch(r"[a-f0-9]{40}", args.source_sha)
assert all(re.fullmatch(r"sha256:[a-f0-9]{64}", value) for value in [args.api_image, args.web_image])
source = Path("/home/csrss/releases/gl-website-20261117-source")
assert subprocess.check_output(["sudo", "-u", "csrss", "git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip() == args.source_sha
assert not subprocess.check_output(["sudo", "-u", "csrss", "git", "-C", str(source), "status", "--porcelain"], text=True).strip()
remote = subprocess.check_output(["sudo", "-u", "csrss", "git", "-C", str(source), "ls-remote", "origin", "refs/heads/main"], text=True).split()
assert remote and remote[0] == args.source_sha
ci = json.loads(Path(args.ci_receipt).read_text())
assert ci["headSha"] == args.source_sha and ci["conclusion"] == "success" and ci.get("url")
backup = json.loads(Path(args.backup_receipt).read_text())
assert backup["target"] == args.target and backup["phase"] == "complete"
assert (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(backup["completed_at"])).total_seconds() < 24 * 3600
for artifact in backup["artifacts"]:
    path = Path(artifact["path"])
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    assert digest.hexdigest() == artifact["sha256"], "Backup artifact changed"
root = Path("/home/csrss/stacks/greenleaf-website-20261117" if args.target == "production" else "/home/csrss/stacks/gl-website-stage-20261117")
erp_project = "gl-cutover-20261005" if args.target == "production" else "gl-web-stage-20261117"
project = "gl-website-production-20261117" if args.target == "production" else erp_project
db_container = erp_project + "_db_1"
network = erp_project + "_isolated"
expected_host = "4cf88405bcc2" if args.target == "production" else "448e7993b2e6"
compose_name = "compose.yml" if args.target == "production" else "website-compose.yml"
compose = root / compose_name
image_env = root / ".env"
private_env = root / "website.env"
env = dict(line.split("=", 1) for line in private_env.read_text().splitlines() if "=" in line and not line.startswith("#"))
assert env["PAYMENT_ENABLED"] == "false" and env["PAYMENT_ERP_WRITE_ENABLED"] == "false"
assert env["ERPNEXT_DB_USER"] == ("gl_website_prod_20261117" if args.target == "production" else "gl_website_stage_20261117")
assert env["STORE_PUBLIC_URL"] == "https://testing.greenleafpacific.com"
assert re.fullmatch(r"[A-Za-z0-9_]+", env["ERPNEXT_DB_NAME"])
database = env["ERPNEXT_DB_NAME"]
for image in [args.api_image, args.web_image]:
    info = json.loads(subprocess.check_output(["docker", "image", "inspect", image]))[0]
    assert info["Config"]["Labels"]["org.opencontainers.image.revision"] == args.source_sha
build_root = Path("/home/csrss/releases/gl-website-customer-20261117-build-" + args.source_sha[:12])
build = json.loads((build_root / "receipt.json").read_text())
assert build["source_sha"] == args.source_sha
for name, image in [("api", args.api_image), ("web", args.web_image)]:
    item = build["images"][name]
    assert item["id"] == image
    archive = item["recovery_archive"]
    assert archive["image"] == image and archive["gzip_verified"] and archive["config_digest_verified"] and archive["image_layer_content_digests_verified"]
    path = Path(archive["archive"])
    assert path.parent == build_root and path.stat().st_size == archive["bytes"]
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    assert digest.hexdigest() == archive["sha256"]
db_info = json.loads(subprocess.check_output(["docker", "inspect", db_container]))[0]
assert db_info["Id"].startswith(expected_host) and db_info["State"]["Running"]
lock = open("/run/greenleaf-stack-backup.lock", "a")
fcntl.flock(lock, fcntl.LOCK_SH | fcntl.LOCK_NB)
release_lock = open("/run/greenleaf-website-customer-release.lock", "a")
fcntl.flock(release_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
process_names = subprocess.check_output(["ps", "-eo", "comm="], text=True).splitlines()
assert not any(name.strip() in ("mariadb-dump", "mysqldump") for name in process_names), "Refusing DDL while an SQL snapshot runs"
release = root / ("customer-release-" + args.source_sha[:12])
release.mkdir(mode=0o700)
for path in [private_env, image_env, compose, root / "db-access-contract.json"]:
    copy = release / (path.name + ".before")
    copy.write_bytes(path.read_bytes()); copy.chmod(0o600)
state = {"target": args.target, "source_sha": args.source_sha, "ci": ci, "backup_receipt": args.backup_receipt, "directory": str(release), "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "phase": "preimages", "secrets_logged": False, "lock_contract": "global LOCK_SH excludes scheduled writers; exclusive website-customer-release lock serializes both targets; no active SQL dump"}

def save():
    path = release / "receipt.json"
    path.write_text(json.dumps(state, indent=2) + "\n"); path.chmod(0o600)

def sql(statement):
    shell = 'set -eu; export MYSQL_PWD="$MARIADB_ROOT_PASSWORD"; exec mariadb --user=root --batch --skip-column-names "$1"'
    result = subprocess.run(["docker", "exec", "-i", db_container, "sh", "-c", shell, "website-customer-release", database], input=statement.encode(), capture_output=True)
    if result.returncode:
        path = release / "sql-error.private.log"
        path.write_bytes(result.stderr); path.chmod(0o600)
        raise RuntimeError("SQL operation failed; private log retained")
    return result.stdout.decode().strip()

def atomic_text(path, value, mode=0o600):
    temp = path.with_name(path.name + ".customer-release-new")
    descriptor = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY, mode)
    with os.fdopen(descriptor, "w") as handle:
        handle.write(value); handle.flush(); os.fsync(handle.fileno())
    os.replace(temp, path)

def replace_env(raw, changes):
    lines = raw.splitlines()
    result = []
    seen = set()
    for line in lines:
        key = line.partition("=")[0]
        if key in changes:
            assert key not in seen, "Duplicate environment key"
            line = key + "=" + changes[key]
            seen.add(key)
        result.append(line)
    result += [key + "=" + value for key, value in changes.items() if key not in seen]
    return "\n".join(result) + "\n"

try:
    save()
    assert sql("SELECT @@hostname;") == expected_host
    table = "tabWebsite Account Challenge"
    migrator = "gl_web_migrate_" + secrets.token_hex(5)
    migration_password = secrets.token_hex(32)
    migration_env = release / "migration.env.private"
    state["phase"] = "migration"; save()
    sql("CREATE USER '" + migrator + "'@'%' IDENTIFIED BY '" + migration_password + "';")
    try:
        for name in ["tabGL Website Schema Migration", "tabWebsite Customer Credential", "tabWebsite Payment Event", table]:
            sql("GRANT CREATE,ALTER,INDEX,SELECT,INSERT,UPDATE ON `" + database + "`.`" + name + "` TO '" + migrator + "'@'%';")
        migration_env.write_text("\n".join(["NODE_ENV=production", "ERPNEXT_DB_HOST=" + env["ERPNEXT_DB_HOST"], "ERPNEXT_DB_PORT=3306", "ERPNEXT_DB_NAME=" + database, "ERPNEXT_DB_USER=" + migrator, "ERPNEXT_DB_PASSWORD=" + migration_password]) + "\n")
        migration_env.chmod(0o600)
        with (release / "migration.log").open("xb") as log:
            result = subprocess.run(["docker", "run", "--rm", "--network", network, "--env-file", str(migration_env), args.api_image, "npm", "run", "erpnext:migrate-website"], stdout=log, stderr=subprocess.STDOUT)
        assert result.returncode == 0, "Website migration failed"
    finally:
        sql("DROP USER '" + migrator + "'@'%';")
        migration_env.unlink(missing_ok=True)
    sql("GRANT SELECT,INSERT,UPDATE ON `" + database + "`.`" + table + "` TO '" + env["ERPNEXT_DB_USER"] + "'@'%';")
    assert sql("SELECT COUNT(*) FROM `tabGL Website Schema Migration` WHERE migration_id='003-website-account-challenge';") == "1"
    contract_path = root / "db-access-contract.json"
    contract = json.loads(contract_path.read_text())
    contract["website_table_privileges"][table] = ["SELECT", "INSERT", "UPDATE"]
    atomic_text(contract_path, json.dumps(contract, indent=2) + "\n")
    state["migration_applied"] = "003-website-account-challenge"
    state["temporary_migrator_removed"] = True
    state["phase"] = "configuration"; save()
    changes = {"ACCOUNT_SELF_SERVICE_ENABLED": "true", "ACCOUNT_EMAIL_FROM": "sales@greenleafpacific.com"}
    compose_text = compose.read_text()
    if args.target == "production":
        native = '''import json,frappe
frappe.init(site="erp.greenleafpacific.com")
frappe.connect()
try:
 d=frappe.get_doc("Email Account","Sales Team")
 assert d.enable_outgoing and d.default_outgoing and d.email_id=="sales@greenleafpacific.com" and d.smtp_server=="smtp.sendgrid.net" and d.login_id=="apikey"
 key=d.get_password("password")
 assert key and "\\n" not in key and "\\r" not in key
 print(json.dumps({"sender":d.email_id,"key":key}))
finally:
 frappe.db.rollback()
 frappe.destroy()
'''
        result = subprocess.run(["docker", "exec", "-i", "-w", "/home/frappe/frappe-bench/sites", "gl-cutover-20261005_backend_1", "/home/frappe/frappe-bench/env/bin/python", "-"], input=native.encode(), capture_output=True)
        assert result.returncode == 0, "Native sender lookup failed"
        sender = json.loads(result.stdout)
        changes.update(ACCOUNT_EMAIL_TRANSPORT="sendgrid", SENDGRID_API_KEY=sender["key"])
        assert "ACCOUNT_ENVIRONMENT" not in env and "ACCOUNT_EMAIL_OUTBOX" not in env
        assert compose_text.count("networks: [isolated, erp]") == 1
        compose_text = compose_text.replace("networks: [isolated, erp]", "networks: [isolated, erp, edge]", 1)
        state["api_egress"] = "existing website edge; no API host port"
    else:
        changes.update(ACCOUNT_ENVIRONMENT="test", ACCOUNT_EMAIL_TRANSPORT="outbox", ACCOUNT_EMAIL_OUTBOX="/private/account-outbox", STORE_PUBLIC_URL="http://localhost:18494")
        assert "SENDGRID_API_KEY" not in env
        outbox = root / "account-outbox"
        outbox.mkdir(mode=0o700); os.chown(outbox, 1000, 1000)
        marker = "    env_file: [website.env]\n"
        assert compose_text.count(marker) == 1
        compose_text = compose_text.replace(marker, marker + "    volumes: [\"./account-outbox:/private/account-outbox:rw\"]\n", 1)
        state["mail_transport"] = "isolated private filesystem outbox; no SendGrid credential"
    assert all("\n" not in value and "\r" not in value for value in changes.values())
    atomic_text(private_env, replace_env(private_env.read_text(), changes))
    atomic_text(compose, compose_text)
    atomic_text(image_env, replace_env(image_env.read_text(), {"WEBSITE_API_IMAGE": args.api_image, "WEBSITE_WEB_IMAGE": args.web_image}))
    state["phase"] = "deployment"; save()
    command = ["docker-compose", "-p", project, "-f", "compose.yml"]
    if args.target == "stage":
        command += ["-f", "website-compose.yml"]
    with (release / "deploy.log").open("xb") as log:
        result = subprocess.run([*command, "up", "-d", "--no-deps", "api", "web", "monitor"], cwd=root, stdout=log, stderr=subprocess.STDOUT)
    assert result.returncode == 0, "Website deployment failed"
    port = 18594 if args.target == "production" else 18494
    for attempt in range(20):
        try:
            with urllib.request.urlopen("http://127.0.0.1:" + str(port) + "/health", timeout=3) as response:
                health = json.load(response)
            if health.get("ok"):
                break
        except Exception:
            pass
        time.sleep(1)
    else:
        raise RuntimeError("Private website health did not become ready")
    names = [project + "_" + service + "_1" for service in ("api", "web", "monitor")]
    infos = json.loads(subprocess.check_output(["docker", "inspect", *names]))
    state["runtime_images"] = {i["Name"].lstrip("/"): i["Image"] for i in infos}
    assert all(i["State"]["Running"] for i in infos)
    assert state["runtime_images"][project + "_api_1"] == args.api_image
    assert state["runtime_images"][project + "_web_1"] == args.web_image
    image_store = root / "runtime-image"
    image_store.mkdir(mode=0o700, exist_ok=True)
    manifest_path = image_store / ("manifest.json" if args.target == "production" else "website-images.json")
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if manifest_path.exists():
        prior_manifest = release / "runtime-image-manifest.before.json"
        prior_manifest.write_bytes(manifest_path.read_bytes()); prior_manifest.chmod(0o600)
    manifest_images = {}
    for name in ["api", "web"]:
        archive = dict(build["images"][name]["recovery_archive"])
        source_archive = Path(archive["archive"])
        destination = image_store / source_archive.name
        if destination.exists():
            assert os.path.samefile(destination, source_archive), "Refusing to replace recovery archive"
        else:
            os.link(source_archive, destination)
        archive["archive"] = destination.name
        manifest_images[name] = archive
    retained = previous.get("retained_previous_images", [])
    previous_images = previous.get("images", {name: previous[name] for name in ["api", "web"] if name in previous})
    for name, item in previous_images.items():
        if item.get("image") != manifest_images.get(name, {}).get("image"):
            retained.append({**item, "former_role": name, "reason": "Retained previous customer website image"})
    manifest = {"completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "source_sha": args.source_sha, "images": manifest_images, "retained_previous_images": retained, "active_container_images": state["runtime_images"], "public_origin": changes.get("STORE_PUBLIC_URL", env["STORE_PUBLIC_URL"]), "scope": "Exact current website API/web archives; no ERP image change; gzip/config/layer integrity verified, Docker load/restore not rehearsed"}
    if args.target == "stage":
        manifest.update(manifest_images)
    atomic_text(manifest_path, json.dumps(manifest, indent=2) + "\n")
    state["recovery_manifest"] = str(manifest_path)
    state["health"] = health
    state["payments_enabled"] = False
    state["phase"] = "complete"
    state["completed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat(); save()
    print(json.dumps(state))
except Exception as error:
    state["phase"] = "failed"; state["error_type"] = type(error).__name__; save()
    raise
finally:
    fcntl.flock(release_lock, fcntl.LOCK_UN)
    fcntl.flock(lock, fcntl.LOCK_UN)
