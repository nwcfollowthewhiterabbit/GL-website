"""Fresh bounded recovery point for the active website update; no live writes.

SQL is a transactional InnoDB snapshot; auxiliary MyISAM has documented online
limits. Website configuration and assets are preserved; ERP attachments/images
are not modified by this release and are not recopied. This is not a restore drill.
"""
import datetime
import fcntl
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

assert os.geteuid() == 0
assert len(sys.argv) == 2 and sys.argv[1] in ("stage", "production")
target = sys.argv[1]
expected_hosts = {"production": "4cf88405bcc2", "stage": "448e7993b2e6"}
website = Path("/home/csrss/stacks/greenleaf-website-20261117" if target == "production" else "/home/csrss/stacks/gl-website-stage-20261117")
erp = Path("/home/csrss/stacks/erp-next-20261005") if target == "production" else website
project = "gl-cutover-20261005" if target == "production" else "gl-web-stage-20261117"
website_project = "gl-website-production-20261117" if target == "production" else project
database = project + "_db_1"
lock = open("/run/greenleaf-stack-backup.lock", "a")
# Shared mode excludes scheduled snapshot/prune writers while allowing the
# unrelated immutable-archive proof's shared read lock. Our own backup/migration
# operations are serialized by a separate exclusive lock across both targets.
fcntl.flock(lock, fcntl.LOCK_SH | fcntl.LOCK_NB)
release_lock = open("/run/greenleaf-website-customer-release.lock", "a")
fcntl.flock(release_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
process_names = subprocess.check_output(["ps", "-eo", "comm="], text=True).splitlines()
assert not any(name.strip() in ("mariadb-dump", "mysqldump") for name in process_names), "An existing SQL snapshot is running"
assert shutil.disk_usage("/").free > 8 * 1024**3, "Bounded backup headroom below8GiB"
info = json.loads(subprocess.check_output(["docker", "inspect", database]))[0]
assert info["Id"].startswith(expected_hosts[target]) and info["State"]["Running"]
assert info["Config"]["Labels"]["com.docker.compose.project"] == project
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
root = Path("/home/csrss/backups/website-customer-release-" + stamp + "-" + target)
root.mkdir(mode=0o700)
state = {"target": target, "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "directory": str(root), "database_hostname": expected_hosts[target], "artifacts": [], "restore_tested": False, "phase": "started", "lock_contract": "global LOCK_SH excludes scheduled writers; exclusive website-customer-release lock serializes both targets"}

def save():
    path = root / "receipt.json"
    path.write_text(json.dumps(state, indent=2) + "\n")
    path.chmod(0o600)

def record(path, kind):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    state["artifacts"].append({"path": str(path), "kind": kind, "bytes": path.stat().st_size, "sha256": digest.hexdigest()})
    save()

def archive(name, base, members):
    path = root / name
    with tarfile.open(path, "w:gz", compresslevel=1) as archive:
        for member in members:
            assert (base / member).exists(), "Expected backup source missing"
            archive.add(base / member, arcname=member, recursive=True)
    path.chmod(0o600)
    with tarfile.open(path, "r:gz") as archive:
        manifest = archive.getmembers()
        assert manifest
        for member in manifest:
            if member.isfile():
                content = archive.extractfile(member)
                while content.read(1024 * 1024):
                    pass
    record(path, "verified_website_files_tar_gzip")

try:
    save()
    spec = importlib.util.spec_from_file_location("logical_backup", "/usr/local/bin/greenleaf-erp-logical-backup.py")
    backup = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backup)
    conf = json.loads((erp / "sites/erp.greenleafpacific.com/site_config.json").read_text())
    db_name = conf["db_name"]
    query = "SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='" + db_name + "' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"
    shell = backup.CREDENTIAL_SHELL + 'exec mariadb --user=root --batch --skip-column-names --execute="$1"'
    process = subprocess.run(["docker", "exec", database, "sh", "-c", shell, "website-backup-inventory", query], capture_output=True, text=True)
    assert process.returncode == 0, "Backup engine inventory failed"
    inventory = backup.parse_inventory(process.stdout)
    dump_shell, strategy = backup.dump_shell(inventory)
    state["phase"] = "database"; save()
    sql_path = root / "erp.sql.gz"
    backup.run_backup(["docker", "exec", database, "sh", "-c", dump_shell, "website-customer-release", db_name], sql_path, inventory)
    mandatory = {"tabWebsite Customer Credential", "tabWebsite Payment Event", "tabGL Website Schema Migration", "tabCustomer", "tabContact", "tabQuotation"}
    found = set()
    with gzip.open(sql_path, "rt", encoding="utf-8", errors="strict") as source:
        for line in source:
            if line.startswith("CREATE TABLE `"):
                found.add(line.split("`", 2)[1])
    assert mandatory <= found, "Recovery SQL missing required schema"
    assert len(found) == len(inventory), "Recovery SQL table count mismatch"
    state["sql_table_count"] = len(found)
    state["required_schema_verified"] = sorted(mandatory)
    record(sql_path, "online_transactional_sql_gzip")
    record(sql_path.with_name(sql_path.name + ".metadata.json"), "logical_consistency_receipt")
    state["phase"] = "website_files"; save()
    members = [".env", "website.env", "legacy-assets", "db-access-contract.json"]
    members += ["compose.yml"] if target == "production" else ["compose.yml", "website-compose.yml"]
    archive("website-files-config.tar.gz", website, members)
    archive("erp-config.tar.gz", erp, ["sites/erp.greenleafpacific.com/site_config.json", "sites/common_site_config.json", "sites/apps.txt"])
    names = [website_project + "_" + service + "_1" for service in ("api", "web", "monitor")]
    infos = json.loads(subprocess.check_output(["docker", "inspect", *names]))
    state["runtime_images"] = {i["Name"].lstrip("/"): i["Image"] for i in infos}
    for image in set(state["runtime_images"].values()):
        subprocess.run(["docker", "image", "inspect", image], check=True, stdout=subprocess.DEVNULL)
    state["source_sha"] = subprocess.check_output(["sudo", "-u", "csrss", "git", "-C", "/home/csrss/releases/gl-website-20261117-source", "rev-parse", "HEAD"], text=True).strip()
    state["limits"] = ["Not a restore drill; SQL gzip/checksum/full table inventory verified only.", "Online InnoDB snapshot; documented auxiliary MyISAM tables are not same-time transactional.", "ERP user attachments unchanged and not recopied; existing preserved native images/attachment backups remain separate.", "Website rollback must retain post-release ERP documents and additive schema, not restore the older business database."]
    state["phase"] = "complete"
    state["completed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    save()
    print(json.dumps(state))
except Exception as error:
    state["phase"] = "failed"; state["error_type"] = type(error).__name__; save()
    raise
finally:
    fcntl.flock(release_lock, fcntl.LOCK_UN)
    fcntl.flock(lock, fcntl.LOCK_UN)
