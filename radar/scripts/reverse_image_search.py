#!/usr/bin/env python3
"""Run Google Lens Pro manually for a known image URL or local image file."""
from __future__ import annotations

import argparse
import ipaddress
import os
import socket
import subprocess
import sys
import urllib.parse
from pathlib import Path

MAX_BYTES = 15 * 1024 * 1024

def validate_public_https_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value.strip())
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Remote images must use a public HTTPS URL without embedded credentials.")
    host = parsed.hostname.lower().rstrip(".")
    if host in {"localhost", "0.0.0.0"} or host.endswith((".localhost", ".local", ".internal", ".test")):
        raise ValueError("Private/local host names are not allowed.")
    try:
        port = parsed.port
    except ValueError:
        raise ValueError("Image URL port is invalid.")
    if port not in (None, 443):
        raise ValueError("Non-standard ports are not allowed.")
    try:
        address = ipaddress.ip_address(host)
        if not address.is_global:
            raise ValueError("Private or reserved IP addresses are not allowed.")
    except ValueError as exc:
        if "not allowed" in str(exc):
            raise
    try:
        addresses = socket.getaddrinfo(host, port or 443, type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ValueError(f"Could not resolve image host for safety check: {exc.__class__.__name__}") from exc
    for item in addresses:
        try:
            address = ipaddress.ip_address(item[4][0])
        except ValueError:
            raise ValueError("Unable to validate the resolved image host.")
        if not address.is_global:
            raise ValueError("Image host resolves to a private or reserved IP address.")
    return value.strip()

def prepare_image_source(value: str) -> str:
    if value.startswith("https://") or value.startswith("http://"):
        return validate_public_https_url(value)
    path = Path(value).expanduser().resolve()
    if not path.is_file():
        raise ValueError("Input must be an existing local image file or a public HTTPS image URL.")
    if path.stat().st_size <= 0 or path.stat().st_size > MAX_BYTES:
        raise ValueError("Local image must be between 1 byte and 15 MiB.")
    return str(path)

def main() -> int:
    parser = argparse.ArgumentParser(description="Reverse-search an image or extract its text with Google Lens Pro.")
    parser.add_argument("image", help="Public HTTPS image URL or local image path")
    parser.add_argument("--ocr-only", action="store_true", help="Run OCR only without browser-backed visual matching")
    parser.add_argument("--max-results", type=int, default=8, help="Maximum visual matches to request (1-20)")
    args = parser.parse_args()
    if not 1 <= args.max_results <= 20:
        parser.error("--max-results must be from 1 to 20")
    try:
        source = prepare_image_source(args.image)
    except ValueError as exc:
        print(f"Input validation failed: {exc}", file=sys.stderr)
        return 2
    binary = os.environ.get("GOOGLE_LENS_BIN", "google-lens")
    command = [binary, "search", source, "--json-output", "--max-results", str(args.max_results)]
    if args.ocr_only:
        command.append("--ocr-only")
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True, timeout=120)
    except FileNotFoundError:
        print("Google Lens Pro CLI not installed. Setup: pip install google-lens-pro && patchright install chromium", file=sys.stderr)
        return 127
    except subprocess.TimeoutExpired:
        print("Google Lens Pro search timed out after 120 seconds.", file=sys.stderr)
        return 124
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.returncode != 0 and result.stderr:
        print(result.stderr[:1500], file=sys.stderr)
    return result.returncode

if __name__ == "__main__":
    raise SystemExit(main())
