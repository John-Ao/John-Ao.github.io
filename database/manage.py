#!/usr/bin/env python3
"""Interactively manage public and encrypted TSV tables for the static site."""

from __future__ import annotations

import argparse
import base64
import csv
import getpass
import gzip
import hashlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path

from argon2.low_level import ARGON2_VERSION, Type, hash_secret_raw
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "raw"
DATA_DIR = ROOT / "data"
TABLE_DIR = DATA_DIR / "tables"
MANIFEST = DATA_DIR / "manifest.json"
CONFIG = ROOT / "tables.json"
FORMAT = "john-ao-database-v1"
KDF = {"name": "argon2id", "version": ARGON2_VERSION, "memoryKiB": 65536,
       "passes": 50, "parallelism": 1, "keyBytes": 32}


def b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def table_id(name: str) -> str:
    return hashlib.sha256(name.encode("utf-8")).hexdigest()[:24]


def aad(name: str) -> bytes:
    return f"{FORMAT}\0{name}".encode("utf-8")


def validate_tsv(path: Path) -> tuple[bytes, int, int]:
    """Return canonical UTF-8 TSV bytes, row count, and column count."""
    rows: list[list[str]] = []
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            reader = csv.reader(source, dialect="excel-tab", strict=True)
            for line_number, row in enumerate(reader, 1):
                if line_number == 1:
                    if not row or any(not column for column in row):
                        raise ValueError("表头不能为空")
                    if len(set(row)) != len(row):
                        raise ValueError("表头包含重复列名")
                    width = len(row)
                elif len(row) != width:
                    raise ValueError(f"第 {line_number} 行有 {len(row)} 列，应为 {width} 列")
                rows.append(row)
    except UnicodeDecodeError as exc:
        raise ValueError("文件不是有效的 UTF-8") from exc
    except csv.Error as exc:
        raise ValueError(f"TSV 格式错误：{exc}") from exc
    if not rows:
        raise ValueError("文件为空")
    from io import StringIO
    output = StringIO(newline="")
    writer = csv.writer(output, dialect="excel-tab", lineterminator="\n")
    writer.writerows(rows)
    return output.getvalue().encode("utf-8"), len(rows) - 1, len(rows[0])


def password_for(name: str) -> bytearray:
    while True:
        first = getpass.getpass(f"{name} 密码（至少 8 个 UTF-8 字节）：").encode("utf-8")
        if len(first) < 8:
            print("密码过短，请重试。", file=sys.stderr)
            continue
        second = getpass.getpass("再次输入密码：").encode("utf-8")
        if first != second:
            print("两次密码不一致，请重试。", file=sys.stderr)
            continue
        return bytearray(first)


def encrypt_table(path: Path, password: bytearray) -> tuple[dict, bytes]:
    plain, rows, columns = validate_tsv(path)
    salt, nonce = os.urandom(16), os.urandom(12)
    started = time.perf_counter()
    key = bytearray(hash_secret_raw(bytes(password), salt, KDF["passes"], KDF["memoryKiB"],
                                    KDF["parallelism"], KDF["keyBytes"], Type.ID,
                                    version=KDF["version"]))
    kdf_seconds = time.perf_counter() - started
    compressed = gzip.compress(plain, compresslevel=9, mtime=0)
    encrypted = AESGCM(bytes(key)).encrypt(nonce, compressed, aad(path.stem))
    key[:] = b"\0" * len(key)
    entry = {
        "name": path.stem,
        "file": f"tables/{table_id(path.stem)}.bin",
        "bytes": len(encrypted),
        "salt": b64(salt),
        "nonce": b64(nonce),
        "kdf": dict(KDF),
    }
    print(f"  {path.name}: {rows:,} 行，{columns} 列，{len(encrypted):,} 字节，KDF {kdf_seconds:.2f}s")
    return entry, encrypted


def load_manifest() -> dict:
    if not MANIFEST.exists():
        return {"format": FORMAT, "tables": []}
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        return data if data.get("format") == FORMAT else {"format": FORMAT, "tables": []}
    except (OSError, json.JSONDecodeError):
        return {"format": FORMAT, "tables": []}


def load_config() -> dict[str, dict]:
    if not CONFIG.exists():
        return {}
    try:
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"无法读取 {CONFIG.name}：{exc}") from exc
    tables = data.get("tables", {})
    if not isinstance(tables, dict):
        raise ValueError(f"{CONFIG.name} 的 tables 必须是对象")
    return tables


def save_config(tables: dict[str, dict]) -> None:
    rendered = json.dumps({"tables": tables}, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=ROOT, delete=False,
                                     newline="\n") as handle:
        handle.write(rendered)
        temporary = Path(handle.name)
    os.replace(temporary, CONFIG)


def available_tables() -> dict[str, Path]:
    return {path.stem: path for path in sorted(RAW_DIR.glob("*.tsv"))}


def build_tables(names: list[str], *, full: bool = False) -> None:
    available = {path.stem: path for path in sorted(RAW_DIR.glob("*.tsv"))}
    config = load_config()
    missing = [name for name in names if name not in available]
    if missing:
        raise ValueError("找不到表：" + ", ".join(missing))
    if not names:
        raise ValueError(f"{RAW_DIR} 中没有 TSV 文件")

    old = load_manifest()
    entries = {entry["name"]: entry for entry in old.get("tables", [])}
    staged: list[tuple[dict, bytes]] = []
    print(f"Argon2id 参数：{KDF['memoryKiB'] // 1024} MiB / {KDF['passes']} 轮 / p={KDF['parallelism']}")
    for name in names:
        encrypted = config.get(name, {}).get("encrypted", True)
        if not isinstance(encrypted, bool):
            raise ValueError(f"{CONFIG.name} 中 {name}.encrypted 必须是布尔值")
        if encrypted:
            password = password_for(name)
            try:
                entry, payload = encrypt_table(available[name], password)
            finally:
                password[:] = b"\0" * len(password)
            entry["encrypted"] = True
        else:
            payload, rows, columns = validate_tsv(available[name])
            entry = {"name": name, "file": f"tables/{table_id(name)}.tsv",
                     "bytes": len(payload), "encrypted": False}
            print(f"  {available[name].name}: {rows:,} 行，{columns} 列，公开 TSV，{len(payload):,} 字节")
        staged.append((entry, payload))

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TABLE_DIR.mkdir(parents=True, exist_ok=True)
    for entry, payload in staged:
        target = DATA_DIR / entry["file"]
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as handle:
            handle.write(payload)
            temporary = Path(handle.name)
        os.replace(temporary, target)
        previous = entries.get(entry["name"])
        if previous and previous.get("file") != entry["file"]:
            obsolete = DATA_DIR / previous["file"]
            if obsolete.is_file() and obsolete.parent == TABLE_DIR:
                obsolete.unlink()
        entries[entry["name"]] = entry

    if full:  # A full build makes manifest exactly match raw/.
        entries = {name: entries[name] for name in available}
        expected = {entry["file"] for entry in entries.values()}
        for obsolete in TABLE_DIR.iterdir():
            if obsolete.is_file() and obsolete.relative_to(DATA_DIR).as_posix() not in expected:
                obsolete.unlink()

    for entry in entries.values():
        entry.setdefault("encrypted", True)
    manifest = {"format": FORMAT, "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "tables": sorted(entries.values(), key=lambda item: item["name"].casefold())}
    rendered = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=DATA_DIR, delete=False, newline="\n") as handle:
        handle.write(rendered)
        temporary = Path(handle.name)
    os.replace(temporary, MANIFEST)
    print(f"完成：{len(staged)} 张表已构建，manifest 共 {len(entries)} 张表。")


def choose_table(title: str, names: list[str]) -> str | None:
    if not names:
        print("没有可选择的数据表。")
        return None
    print(f"\n{title}")
    for index, name in enumerate(names, 1):
        print(f"  {index}. {name}")
    while True:
        answer = input("请选择序号（直接回车取消）：").strip()
        if not answer:
            return None
        if answer.isdigit() and 1 <= int(answer) <= len(names):
            return names[int(answer) - 1]
        print("输入无效，请重新选择。")


def ask_yes_no(prompt: str, *, default: bool) -> bool:
    hint = "Y/n" if default else "y/N"
    while True:
        answer = input(f"{prompt} [{hint}]：").strip().lower()
        if not answer:
            return default
        if answer in {"y", "yes"}:
            return True
        if answer in {"n", "no"}:
            return False
        print("请输入 y 或 n。")


def interactive() -> int:
    print("数据库管理工具")
    while True:
        raw = available_tables()
        manifest_names = {entry["name"] for entry in load_manifest().get("tables", [])}
        print("\n  1. 新增数据表")
        print("  2. 重新生成已有数据表 / 修改密码")
        print("  3. 退出")
        action = input("请选择操作：").strip()
        if action == "1":
            name = choose_table("尚未添加的原始数据表：", sorted(set(raw) - manifest_names))
            if name is None:
                continue
            encrypted = ask_yes_no("是否加密该表", default=True)
            config = load_config()
            config[name] = {"encrypted": encrypted}
            save_config(config)
            build_tables([name])
        elif action == "2":
            name = choose_table("已有数据表：", sorted(set(raw) & manifest_names))
            if name is None:
                continue
            entry = next(item for item in load_manifest()["tables"] if item["name"] == name)
            kind = "输入新密码并覆盖原密文" if entry.get("encrypted", True) else "覆盖公开数据文件"
            if ask_yes_no(f"将重新生成 {name}（{kind}），继续吗", default=False):
                build_tables([name])
        elif action == "3":
            return 0
        else:
            print("输入无效，请选择 1、2 或 3。")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command")
    build = subparsers.add_parser("build", help="非交互地构建指定数据表")
    build.add_argument("tables", nargs="*", help="表名，不含 .tsv")
    build.add_argument("--all", action="store_true", help="构建 raw/ 中的全部表")
    args = parser.parse_args()
    try:
        if args.command == "build":
            if args.all and args.tables:
                parser.error("--all 不能与具体表名同时使用")
            names = list(available_tables()) if args.all else args.tables
            if not names:
                parser.error("请指定至少一张表，或使用 --all")
            build_tables(names, full=args.all)
            return 0
        return interactive()
    except (EOFError, KeyboardInterrupt):
        print("\n已取消。")
        return 130
    except ValueError as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
