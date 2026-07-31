#!/usr/bin/env python3
"""Non-interactive age --passphrase encrypt/decrypt via a PTY (stdlib only)."""

from __future__ import annotations

import argparse
import os
import pty
import select
import sys


def run_age_with_passphrase(
    cmd: list[str],
    passphrase: str,
    *,
    confirm: bool,
) -> int:
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(cmd[0], cmd)

    sent = 0
    buf = b""
    while True:
        ready, _, _ = select.select([fd], [], [], 30)
        if not ready:
            break
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        buf += chunk
        lower = buf.lower()
        if sent == 0 and b"passphrase" in lower:
            os.write(fd, f"{passphrase}\n".encode())
            sent = 1
            buf = b""
        elif confirm and sent == 1 and (
            b"confirm" in lower or b"passphrase" in lower
        ):
            os.write(fd, f"{passphrase}\n".encode())
            sent = 2
            buf = b""

    _, status = os.waitpid(pid, 0)
    if os.WIFEXITED(status):
        return os.WEXITSTATUS(status)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="age passphrase helper for template SOPS identity wrap/unwrap",
    )
    parser.add_argument(
        "mode",
        choices=("encrypt", "decrypt"),
        help="encrypt: age --passphrase; decrypt: age -d",
    )
    parser.add_argument("input_path")
    parser.add_argument("output_path")
    parser.add_argument(
        "--passphrase-env",
        default="SOPS_AGE_PASSPHRASE",
        help="env var holding the passphrase (default: SOPS_AGE_PASSPHRASE)",
    )
    args = parser.parse_args()

    passphrase = os.environ.get(args.passphrase_env, "")
    if not passphrase:
        print(
            f"{args.passphrase_env} is required for passphrase mode.",
            file=sys.stderr,
        )
        return 2

    if args.mode == "encrypt":
        cmd = [
            "age",
            "--passphrase",
            "--armor",
            "-o",
            args.output_path,
            args.input_path,
        ]
        return run_age_with_passphrase(cmd, passphrase, confirm=True)

    cmd = ["age", "-d", "-o", args.output_path, args.input_path]
    return run_age_with_passphrase(cmd, passphrase, confirm=False)


if __name__ == "__main__":
    raise SystemExit(main())
