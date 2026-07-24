#!/usr/bin/env python3
"""Static repository contract checks that never contact runtime or network."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable

try:
    import tomllib
except ModuleNotFoundError:
    import _toml_compat as tomllib

from _contract import (
    MINIMUM_REQUIRED_PATHS,
    REQUIRED_POLICY_SECTIONS,
    REQUIRED_RUNTIME_OPERATIONS,
    probe_errors,
    repository_contract_errors,
    safe_relative_path,
    strict_json_object,
)
from _project_config import project_config_errors


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK = re.compile(r"\[[^]]+\]\(([^)]+)\)")
FENCED_BLOCK = re.compile(r"```.*?```", re.DOTALL)
UNRESOLVED_TOKEN = re.compile(r"__[A-Z][A-Z0-9_]*__")
SECRET_NAME = re.compile(
    r"(?:password|passwd|secret|token|credential|private[_-]?key|api[_-]?key)",
    re.IGNORECASE,
)
FORBIDDEN_SUFFIXES = {".pem", ".key", ".p12", ".pfx"}
FORBIDDEN_DIRECTORIES = {".docker", "credentials", "secrets"}
FORBIDDEN_EXACT_NAMES = {".netrc", ".pypirc"}
SENSITIVE_FILE_NAME = re.compile(
    r"(?:^|[._-])(?:passwords?|passwds?|secrets?|tokens?|credentials?|"
    r"private[_-]?keys?|api[_-]?keys?)(?:[._-]|$)",
    re.IGNORECASE,
)
SENSITIVE_FILE_SUFFIXES = {
    "",
    ".cfg",
    ".conf",
    ".ini",
    ".json",
    ".key",
    ".txt",
    ".toml",
    ".yaml",
    ".yml",
}
IGNORED_PARTS = {
    ".git",
    ".screenshots",
    "__pycache__",
    "dist",
    "node_modules",
}
EMBEDDED_URL_CREDENTIALS = re.compile(
    r"\b[a-z][a-z0-9+.-]*://[^\s/@]+@",
    re.IGNORECASE,
)
PRIVATE_KEY_HEADER = re.compile(
    r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
)
QUERY_SECRET = re.compile(
    r"[?&](?:access_token|auth_token|api[_-]?key|password|secret|token)="
    r"(?!<|\$|\{|changeme\b|redacted\b)[^&#\s]+",
    re.IGNORECASE,
)
NPM_AUTH_TOKEN = re.compile(
    r"_authToken\s*=\s*"
    r"(?!<|\$|\{|changeme\b|redacted\b)[^\s#]+",
    re.IGNORECASE,
)
NETRC_PASSWORD = re.compile(
    r"\bmachine\b[^\r\n]{0,200}\bpassword\s+"
    r"(?!<|\$|\{|changeme\b|redacted\b)[^\s#]+",
    re.IGNORECASE,
)
REAL_TOKEN_PATTERNS = (
    (
        "GitHub token",
        re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})"),
    ),
    ("GitLab token", re.compile(r"glpat-[A-Za-z0-9_-]{20,}")),
    ("AWS access key", re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}")),
    ("Slack token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    (
        "Stripe live key",
        re.compile(r"(?:sk_live_|rk_live_)[A-Za-z0-9_-]{16,}"),
    ),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{30,}")),
    ("secret key token", re.compile(r"sk-(?:proj-)?[A-Za-z0-9_-]{24,}")),
    (
        "JSON Web Token",
        re.compile(
            r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\."
            r"[A-Za-z0-9_-]{10,}"
        ),
    ),
)
SECRET_ASSIGNMENT = re.compile(
    r"""(?im)^[ \t]*(?:[-*+][ \t]+)?(?:export[ \t]+)?
    (?:[A-Za-z0-9_-]+[ \t]+)?["']?
    (?P<key>[A-Za-z0-9_-]*(?:passwords?|passwds?|secrets?|tokens?|credentials?|
    private[_-]?keys?|api[_-]?keys?)[A-Za-z0-9_-]*)
    ["']?[ \t]*[:=][ \t]*(?P<value>[^\r\n]*?)[ \t]*(?:[,;][ \t]*)?$""",
    re.VERBOSE,
)
INLINE_SECRET_ASSIGNMENT = re.compile(
    r"""(?im)\b
    (?P<key>[A-Za-z0-9_-]*(?:passwords?|passwds?|secrets?|tokens?|credentials?|
    private[_-]?keys?|api[_-]?keys?)[A-Za-z0-9_-]*)
    [ \t]*[:=][ \t]*
    (?P<value>"[^"\r\n]+"|'[^'\r\n]+'|[^\s,;#]+)""",
    re.VERBOSE,
)
SECRET_SCAN_EXCLUDED = {
    "scripts/check_repository.py",
    "tests/test_security_scanner.py",
}
SECRET_ASSIGNMENT_SUFFIXES = {
    ".cfg",
    ".conf",
    ".env",
    ".ini",
    ".properties",
    ".toml",
    ".yaml",
    ".yml",
}
SAFE_PLACEHOLDER_VALUES = {
    "",
    "changeme",
    "change-me",
    "dummy",
    "example",
    "example-only",
    "masked",
    "none",
    "not configured",
    "not-configured",
    "null",
    "placeholder",
    "redacted",
    "replace-me",
    "replace_me",
    "test",
    "unconfigured",
    "unset",
}
SHA256 = re.compile(r"^[a-f0-9]{64}$")
SEMVER = re.compile(
    r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)


def load_toml(path: Path) -> dict[str, Any]:
    return tomllib.loads(path.read_text(encoding="utf-8"))


def iter_files(root: Path = ROOT) -> Iterable[Path]:
    for path in root.rglob("*"):
        if any(part in IGNORED_PARTS for part in path.relative_to(root).parts):
            continue
        if path.is_file() or path.is_symlink():
            yield path


def contract_required_paths(contract: Any) -> set[str]:
    paths = set(MINIMUM_REQUIRED_PATHS)
    if isinstance(contract, dict) and isinstance(contract.get("required_paths"), list):
        paths.update(
            path
            for path in contract["required_paths"]
            if isinstance(path, str) and safe_relative_path(path)
        )
    return paths


def check_required(contract: Any) -> list[str]:
    return sorted(
        path
        for path in contract_required_paths(contract)
        if not (ROOT / path).is_file()
    )


def check_policy_sections(contract: Any) -> list[str]:
    sections = set(REQUIRED_POLICY_SECTIONS)
    if isinstance(contract, dict) and isinstance(
        contract.get("required_policy_sections"), list
    ):
        sections.update(
            section
            for section in contract["required_policy_sections"]
            if isinstance(section, str) and section.strip()
        )
    policy_path = ROOT / "AGENTS.md"
    if not policy_path.is_file():
        return sorted(sections)
    policy = policy_path.read_text(encoding="utf-8")
    return sorted(section for section in sections if section not in policy)


def check_symlinks() -> list[str]:
    return [
        str(path.relative_to(ROOT))
        for path in iter_files()
        if path.is_symlink()
    ]


def check_tokens() -> list[str]:
    failures = []
    for path in iter_files():
        if path.is_symlink():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if UNRESOLVED_TOKEN.search(text):
            failures.append(str(path.relative_to(ROOT)))
    return failures


def check_markdown_links() -> list[str]:
    failures = []
    for document in ROOT.rglob("*.md"):
        if any(part in IGNORED_PARTS for part in document.relative_to(ROOT).parts):
            continue
        text = FENCED_BLOCK.sub("", document.read_text(encoding="utf-8"))
        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip().strip("<>").split("#", 1)[0]
            if (
                not target
                or "://" in target
                or target.startswith(("mailto:", "tel:", "/"))
            ):
                continue
            resolved = (document.parent / target).resolve()
            try:
                resolved.relative_to(ROOT)
            except ValueError:
                failures.append(
                    f"{document.relative_to(ROOT)} -> {raw_target} (outside root)"
                )
                continue
            if not resolved.exists():
                failures.append(f"{document.relative_to(ROOT)} -> {raw_target}")
    return failures


def forbidden_path_reason(relative: Path) -> str:
    lower_parts = {part.lower() for part in relative.parts[:-1]}
    if lower_parts & FORBIDDEN_DIRECTORIES:
        return "credentials/secrets directory"
    name = relative.name
    lower_name = name.lower()
    if lower_name in FORBIDDEN_EXACT_NAMES:
        return "credential configuration file"
    if lower_name != ".env.example" and (
        lower_name == ".env" or lower_name.startswith(".env.")
    ):
        return "environment file"
    if relative.suffix.lower() in FORBIDDEN_SUFFIXES:
        return "private key/certificate container"
    if (
        SENSITIVE_FILE_NAME.search(name)
        and relative.suffix.lower() in SENSITIVE_FILE_SUFFIXES
    ):
        return "secret-like key file"
    return ""


def check_forbidden_paths() -> list[str]:
    failures = []
    for path in iter_files():
        reason = forbidden_path_reason(path.relative_to(ROOT))
        if reason:
            failures.append(f"{path.relative_to(ROOT)} ({reason})")
    try:
        tracked = subprocess.run(
            ["git", "ls-files", "--", "."],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        ).stdout.splitlines()
    except (FileNotFoundError, subprocess.SubprocessError):
        tracked = []
    for raw in tracked:
        reason = forbidden_path_reason(Path(raw))
        if reason:
            failures.append(f"tracked: {raw} ({reason})")
    return sorted(set(failures))


def is_placeholder_secret(value: str) -> bool:
    cleaned = value.strip().rstrip(",;").strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in "\"'":
        cleaned = cleaned[1:-1].strip()
    lowered = cleaned.casefold()
    if lowered in SAFE_PLACEHOLDER_VALUES:
        return True
    if cleaned in {"True", "False"} or cleaned.startswith(
        ("re.compile(", "os.environ", "getenv(", "settings.", "config.")
    ):
        return True
    if (
        (cleaned.startswith("<") and cleaned.endswith(">"))
        or (cleaned.startswith("${") and cleaned.endswith("}"))
        or (cleaned.startswith("{{") and cleaned.endswith("}}"))
        or (cleaned.startswith("__") and cleaned.endswith("__"))
        or (cleaned.startswith("$") and cleaned[1:].replace("_", "").isalnum())
        or (cleaned and set(cleaned) <= {"*", "x", "X"})
    ):
        return True
    return False


def secret_text_findings(
    relative: Path,
    text: str,
    *,
    scan_assignments: bool = True,
) -> list[str]:
    failures = []
    for label, pattern in (
        ("embedded URL credentials", EMBEDDED_URL_CREDENTIALS),
        ("private-key header", PRIVATE_KEY_HEADER),
        ("credential query parameter", QUERY_SECRET),
        ("npm authentication token", NPM_AUTH_TOKEN),
        ("netrc password", NETRC_PASSWORD),
        *REAL_TOKEN_PATTERNS,
    ):
        for match in pattern.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            failures.append(f"{relative}:{line}: {label}")
    if scan_assignments:
        for match in SECRET_ASSIGNMENT.finditer(text):
            if (
                match.group("key").casefold() != "contains_secrets"
                and not is_placeholder_secret(match.group("value"))
            ):
                line = text.count("\n", 0, match.start()) + 1
                failures.append(f"{relative}:{line}: secret-like assignment")
        for match in INLINE_SECRET_ASSIGNMENT.finditer(text):
            if (
                match.group("key").casefold() != "contains_secrets"
                and not is_placeholder_secret(match.group("value"))
            ):
                line = text.count("\n", 0, match.start()) + 1
                finding = f"{relative}:{line}: inline secret-like assignment"
                if finding not in failures:
                    failures.append(finding)
    return failures


def check_embedded_secrets() -> list[str]:
    failures = []
    for path in iter_files():
        if path.is_symlink():
            continue
        relative = path.relative_to(ROOT)
        if relative.as_posix() in SECRET_SCAN_EXCLUDED:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        failures.extend(
            secret_text_findings(
                relative,
                text,
                scan_assignments=(
                    relative.suffix.casefold() in SECRET_ASSIGNMENT_SUFFIXES
                    or relative.name.startswith(".env")
                ),
            )
        )
    return failures


def check_env_example() -> list[str]:
    failures = []
    path = ROOT / ".env.example"
    if not path.is_file():
        return failures
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if SECRET_NAME.search(key) and not is_placeholder_secret(value):
            failures.append(f".env.example:{line_number} contains a secret-like value")
    return failures


def strict_json_value(text: str) -> Any:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    return json.loads(text, object_pairs_hook=reject_duplicates)


def check_syntax() -> list[str]:
    failures = []
    for path in iter_files():
        if path.is_symlink():
            continue
        try:
            if path.suffix == ".py":
                compile(path.read_text(encoding="utf-8"), str(path), "exec")
            elif path.suffix == ".json":
                strict_json_value(path.read_text(encoding="utf-8"))
            elif path.suffix == ".toml":
                load_toml(path)
        except (
            SyntaxError,
            UnicodeError,
            ValueError,
            json.JSONDecodeError,
            tomllib.TOMLDecodeError,
        ) as exc:
            failures.append(f"{path.relative_to(ROOT)}: {exc}")
    return failures


def workflow_yaml_syntax_errors(text: str) -> list[str]:
    """Reject clear YAML lexical errors without pretending to be a YAML parser."""

    failures = []
    flow_stack: list[tuple[str, int, int]] = []
    matching = {"]": "[", "}": "{"}

    for line_number, line in enumerate(text.splitlines(), 1):
        indentation = line[: len(line) - len(line.lstrip(" \t"))]
        if "\t" in indentation:
            failures.append(f"line {line_number}: tab used for indentation")

        quote = ""
        escaped = False
        index = 0
        while index < len(line):
            character = line[index]
            column = index + 1

            if quote == '"':
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == '"':
                    quote = ""
                index += 1
                continue

            if quote == "'":
                if character == "'":
                    if index + 1 < len(line) and line[index + 1] == "'":
                        index += 2
                        continue
                    quote = ""
                index += 1
                continue

            if character in {'"', "'"}:
                quote = character
            elif character == "#" and (
                index == 0 or line[index - 1].isspace()
            ):
                break
            elif character in "[{":
                flow_stack.append((character, line_number, column))
            elif character in "]}":
                expected = matching[character]
                if not flow_stack:
                    failures.append(
                        f"line {line_number}, column {column}: "
                        f"unexpected closing {character}"
                    )
                elif flow_stack[-1][0] != expected:
                    opener, open_line, open_column = flow_stack.pop()
                    failures.append(
                        f"line {line_number}, column {column}: closing "
                        f"{character} does not match {opener} opened at "
                        f"line {open_line}, column {open_column}"
                    )
                else:
                    flow_stack.pop()
            index += 1

    for opener, line_number, column in flow_stack:
        failures.append(
            f"line {line_number}, column {column}: unclosed flow {opener}"
        )
    return failures


def check_workflows(root: Path = ROOT) -> list[str]:
    failures = []
    workflow_root = root / ".github" / "workflows"
    paths = sorted(
        {
            *workflow_root.glob("*.yml"),
            *workflow_root.glob("*.yaml"),
        }
    )
    for path in paths:
        text = path.read_text(encoding="utf-8")
        failures.extend(
            f"{path.relative_to(root)}: {failure}"
            for failure in workflow_yaml_syntax_errors(text)
        )
        for required in ("name:", "on:", "jobs:", "permissions:", "contents: read"):
            if required not in text:
                failures.append(f"{path.relative_to(root)} missing {required}")
        for match in re.finditer(
            r"(?m)^\s*(?:-\s*)?uses:\s*([^\s#]+)",
            text,
        ):
            reference = match.group(1).strip("\"'")
            if not action_reference_is_pinned(reference):
                failures.append(
                    f"{path.relative_to(root)} action is not pinned to a "
                    f"40-character commit SHA: {reference}"
                )
    return failures


def action_reference_is_pinned(reference: str) -> bool:
    return reference.startswith("./") or bool(
        re.fullmatch(r"[^@\s]+@[0-9a-fA-F]{40}", reference)
    )


def manifest_data_errors(manifest: Any) -> list[str]:
    if not isinstance(manifest, dict):
        return ["manifest must be a JSON object"]
    errors = []
    if set(manifest) != {"schema_version", "template_version", "files"}:
        errors.append(
            "manifest keys must be exactly schema_version, template_version, files"
        )
    if type(manifest.get("schema_version")) is not int or manifest.get(
        "schema_version"
    ) != 1:
        errors.append("manifest schema_version must be integer 1")
    version = manifest.get("template_version")
    if not isinstance(version, str) or not SEMVER.fullmatch(version):
        errors.append("manifest template_version must be a semantic version")
    files = manifest.get("files")
    if not isinstance(files, dict) or not files:
        errors.append("manifest files must be a non-empty object")
        return errors
    unsafe = []
    invalid_hashes = []
    for path, digest in files.items():
        if not safe_relative_path(path) or path == ".template-manifest.json":
            unsafe.append(str(path))
        if not isinstance(digest, str) or not SHA256.fullmatch(digest):
            invalid_hashes.append(str(path))
    if unsafe:
        errors.append(f"manifest contains unsafe file paths: {', '.join(sorted(unsafe))}")
    if invalid_hashes:
        errors.append(
            f"manifest contains invalid SHA-256 values: "
            f"{', '.join(sorted(invalid_hashes))}"
        )
    baseline = set(MINIMUM_REQUIRED_PATHS) - {".template-manifest.json"}
    missing = sorted(baseline - set(files))
    if missing:
        errors.append(
            f"manifest is missing baseline provenance entries: {', '.join(missing)}"
        )
    return errors


def check_template_manifest() -> list[str]:
    path = ROOT / ".template-manifest.json"
    if not path.is_file():
        return [".template-manifest.json is missing"]
    try:
        manifest = strict_json_object(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        return [f".template-manifest.json cannot be loaded: {exc}"]
    return manifest_data_errors(manifest)


def check_runtime_contract(config: Any) -> list[str]:
    failures = []
    state = (
        config.get("automation", {}).get("state")
        if isinstance(config, dict)
        and isinstance(config.get("automation"), dict)
        else None
    )
    if state not in {"scaffold", "configured"}:
        return ["automation.state must be scaffold or configured"]
    expected_configured = state == "configured"
    for operation in REQUIRED_RUNTIME_OPERATIONS:
        script = ROOT / "scripts" / f"{operation}.py"
        if not script.is_file():
            failures.append(f"missing runtime operation script: {operation}")
            continue
        try:
            result = subprocess.run(
                [sys.executable, str(script), "--contract-probe"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            failures.append(f"{operation}: probe failed to execute: {exc}")
            continue
        failures.extend(
            probe_errors(
                operation,
                result.returncode,
                result.stdout,
                result.stderr,
                expected_configured=expected_configured,
            )
        )
    return failures


def main() -> int:
    try:
        config = load_toml(ROOT / "project.toml")
        contract = load_toml(ROOT / "repository-contract.toml")
    except (OSError, UnicodeError, tomllib.TOMLDecodeError) as exc:
        print(f"repository contract cannot be loaded: {exc}")
        return 1
    problems = {
        "repository contract errors": repository_contract_errors(contract),
        "project configuration errors": project_config_errors(config),
        "missing required paths": check_required(contract),
        "missing AGENTS policy sections": check_policy_sections(contract),
        "template manifest errors": check_template_manifest(),
        "symlinks are forbidden": check_symlinks(),
        "unresolved template tokens": check_tokens(),
        "broken Markdown links": check_markdown_links(),
        "forbidden secret paths": check_forbidden_paths(),
        "embedded secret material": check_embedded_secrets(),
        "unsafe .env.example values": check_env_example(),
        "syntax errors": check_syntax(),
        "unsafe CI workflows": check_workflows(),
        "runtime contract errors": check_runtime_contract(config),
    }
    failed = False
    for title, items in problems.items():
        if items:
            failed = True
            print(f"{title}:")
            for item in items:
                print(f"  - {item}")
    if failed:
        return 1
    print("Repository checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
