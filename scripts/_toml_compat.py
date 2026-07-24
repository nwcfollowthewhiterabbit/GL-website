"""Small TOML subset reader for Python < 3.11."""

from __future__ import annotations

import ast
import re
from typing import Any


class TOMLDecodeError(ValueError):
    pass


def _strip_comment(line: str) -> str:
    quote = None
    escaped = False
    output = []
    for character in line:
        if escaped:
            output.append(character)
            escaped = False
            continue
        if character == "\\" and quote == '"':
            output.append(character)
            escaped = True
            continue
        if quote is not None:
            output.append(character)
            if character == quote:
                quote = None
            continue
        if character in {'"', "'"}:
            quote = character
            output.append(character)
            continue
        if character == "#":
            break
        output.append(character)
    return "".join(output).strip()


def _bracket_balance(value: str) -> int:
    quote = None
    escaped = False
    balance = 0
    for character in value:
        if escaped:
            escaped = False
            continue
        if character == "\\" and quote == '"':
            escaped = True
            continue
        if quote is not None:
            if character == quote:
                quote = None
            continue
        if character in {'"', "'"}:
            quote = character
        elif character in "[{":
            balance += 1
        elif character in "]}":
            balance -= 1
    return balance


def _normalize_booleans(value: str) -> str:
    """Translate booleans outside strings and preserve TOML literal strings."""

    output = []
    unquoted = []
    literal = []
    quote = None
    escaped = False

    def flush_unquoted() -> None:
        if not unquoted:
            return
        text = "".join(unquoted)
        if re.search(r"\b(?:True|False)\b", text):
            raise ValueError("TOML booleans must be lowercase")
        text = re.sub(r"\btrue\b", "True", text)
        text = re.sub(r"\bfalse\b", "False", text)
        output.append(text)
        unquoted.clear()

    for character in value:
        if quote is None:
            if character == "'":
                flush_unquoted()
                quote = character
                literal.clear()
            elif character == '"':
                flush_unquoted()
                quote = character
                output.append(character)
            else:
                unquoted.append(character)
            continue

        if quote == "'":
            if character == "'":
                output.append(repr("".join(literal)))
                literal.clear()
                quote = None
            else:
                literal.append(character)
            continue

        output.append(character)
        if escaped:
            escaped = False
        elif character == "\\" and quote == '"':
            escaped = True
        elif character == quote:
            quote = None

    flush_unquoted()
    if quote == "'":
        output.append("'" + "".join(literal))
    return "".join(output)


def _parse_value(value: str, line_number: int) -> Any:
    try:
        normalized = _normalize_booleans(value)
        parsed = ast.literal_eval(normalized)
    except (SyntaxError, ValueError) as exc:
        raise TOMLDecodeError(f"invalid value at line {line_number}") from exc
    if not isinstance(parsed, (str, int, float, bool, list)):
        raise TOMLDecodeError(f"unsupported value at line {line_number}")
    return parsed


def loads(text: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    current = result
    defined_tables = set()
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        line_number = index + 1
        line = _strip_comment(lines[index])
        index += 1
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            table_name = line[1:-1].strip()
            if not table_name or not re.fullmatch(r"[A-Za-z0-9_.-]+", table_name):
                raise TOMLDecodeError(f"invalid table at line {line_number}")
            if table_name in defined_tables:
                raise TOMLDecodeError(
                    f"duplicate table at line {line_number}: {table_name}"
                )
            defined_tables.add(table_name)
            current = result
            for part in table_name.split("."):
                child = current.setdefault(part, {})
                if not isinstance(child, dict):
                    raise TOMLDecodeError(f"table conflicts at line {line_number}")
                current = child
            continue
        if "=" not in line:
            raise TOMLDecodeError(f"expected key/value at line {line_number}")
        key, value = (part.strip() for part in line.split("=", 1))
        if not re.fullmatch(r"[A-Za-z0-9_-]+", key):
            raise TOMLDecodeError(f"invalid key at line {line_number}")
        while _bracket_balance(value) > 0 and index < len(lines):
            continuation = _strip_comment(lines[index])
            index += 1
            if continuation:
                value += "\n" + continuation
        if _bracket_balance(value) != 0:
            raise TOMLDecodeError(f"unclosed value at line {line_number}")
        if key in current:
            raise TOMLDecodeError(f"duplicate key at line {line_number}: {key}")
        current[key] = _parse_value(value, line_number)
    return result
