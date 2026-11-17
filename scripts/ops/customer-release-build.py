"""Build unique website images from a clean pushed commit with exact CI evidence."""
import argparse
import datetime
import hashlib
import gzip
import json
from pathlib import Path
import posixpath
import re
import subprocess
import tarfile

parser = argparse.ArgumentParser()
parser.add_argument("--source-sha", required=True)
parser.add_argument("--ci-receipt", required=True)
args = parser.parse_args()
assert re.fullmatch(r"[a-f0-9]{40}", args.source_sha)
source = Path("/home/csrss/releases/gl-website-20261117-source")
assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip() == args.source_sha
assert not subprocess.check_output(["git", "status", "--porcelain"], cwd=source, text=True).strip()
assert subprocess.check_output(["git", "ls-remote", "origin", "refs/heads/main"], cwd=source, text=True).split()[0] == args.source_sha
assert not (source / ".env").exists()
ci = json.loads(Path(args.ci_receipt).read_text())
assert ci["headSha"] == args.source_sha and ci["conclusion"] == "success" and ci.get("url")
root = Path("/home/csrss/releases/gl-website-customer-20261117-build-" + args.source_sha[:12])
root.mkdir(mode=0o700)
images = {}

def hash_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def preserve_image(name, image_id):
    archive = root / (name + "-" + image_id.removeprefix("sha256:") + ".tar.gz")
    with archive.open("xb") as target, (root / (name + "-save.log")).open("xb") as errors:
        process = subprocess.Popen(["docker", "save", image_id], stdout=subprocess.PIPE, stderr=errors)
        with gzip.GzipFile(filename="", fileobj=target, mode="wb", compresslevel=1) as zipped:
            for chunk in iter(lambda: process.stdout.read(1024 * 1024), b""):
                zipped.write(chunk)
        process.stdout.close()
        assert process.wait() == 0, "Image archive export failed"
    archive.chmod(0o600)
    with gzip.open(archive, "rb") as handle:
        while handle.read(1024 * 1024):
            pass
    with tarfile.open(archive, "r:gz") as bundle:
        manifest = json.load(bundle.extractfile("manifest.json"))
        assert len(manifest) == 1
        manifest = manifest[0]
        config = bundle.extractfile(manifest["Config"]).read()
        assert "sha256:" + hashlib.sha256(config).hexdigest() == image_id
        diff_ids = json.loads(config)["rootfs"]["diff_ids"]
        assert len(diff_ids) == len(manifest["Layers"])
        for layer, diff_id in zip(manifest["Layers"], diff_ids):
            member = bundle.getmember(layer)
            for _ in range(8):
                if not member.issym() and not member.islnk():
                    break
                name = posixpath.normpath(posixpath.join(posixpath.dirname(member.name), member.linkname) if member.issym() else member.linkname)
                assert not name.startswith(("../", "/"))
                member = bundle.getmember(name)
            assert member.isfile()
            digest = hashlib.sha256()
            handle = bundle.extractfile(member)
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
            assert "sha256:" + digest.hexdigest() == diff_id, "Image layer digest mismatch"
    return {"image": image_id, "archive": str(archive), "sha256": hash_file(archive), "bytes": archive.stat().st_size, "gzip_verified": True, "config_digest_verified": True, "image_layer_content_digests_verified": True, "layer_count": len(diff_ids), "docker_load_verified": False}

builds = [
    ("api", "Dockerfile.api", []),
    ("web", "Dockerfile", ["--build-arg", "PUBLIC_SITE_URL=https://testing.greenleafpacific.com", "--build-arg", "SITE_INDEXING_ENABLED=false"]),
]
for name, dockerfile, extra in builds:
    tag = "greenleaf-website-" + name + ":customer-20261117-" + args.source_sha[:12]
    assert subprocess.run(["docker", "image", "inspect", tag], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0
    log = root / (name + ".log")
    with log.open("xb") as output:
        result = subprocess.run(["docker", "build", "--label", "org.opencontainers.image.revision=" + args.source_sha, "--label", "org.opencontainers.image.source=https://github.com/nwcfollowthewhiterabbit/GL-website", "-t", tag, "-f", dockerfile, *extra, "."], cwd=source, stdout=output, stderr=subprocess.STDOUT)
    assert result.returncode == 0, "Website build failed: " + name
    info = json.loads(subprocess.check_output(["docker", "image", "inspect", tag]))[0]
    images[name] = {"tag": tag, "id": info["Id"], "bytes": info["Size"], "source_sha": args.source_sha, "log_sha256": hashlib.sha256(log.read_bytes()).hexdigest()}
    images[name]["recovery_archive"] = preserve_image(name, info["Id"])
    print(json.dumps({"built": name, "id": info["Id"]}), flush=True)
receipt = {"completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "source_sha": args.source_sha, "ci": ci, "images": images}
(root / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps(receipt))
