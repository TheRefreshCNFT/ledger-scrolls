#!/usr/bin/env python3
"""
Ledger Scrolls: Zero-Dependency Scroll Reader (Koios)

- Python 3 stdlib only
- Koios public REST API (no API key)
- Supports Standard (UTxO datum) and Legacy (CIP-721 pages)
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import time
import urllib.request
from typing import Any, Dict, Iterable, List, Tuple

DEFAULT_KOIOS = "https://api.koios.rest/api/v1"

SCROLLS: Dict[str, Dict[str, Any]] = {
    "hosky-png": {
        "type": "standard",
        "title": "Hosky PNG",
        "lock_txin": "728660515c6d9842d9f0ffd273f2b487a4070fd9f4bd5455a42e3a56880389be#0",
        "content_type": "image/png",
        "sha256": "798e3296d45bb42e7444dbf64e1eb16b02c86a233310407e7d8baf97277f642f",
    },
    "architects-scroll": {
        "type": "standard",
        "title": "The Architect's Scroll",
        "lock_txin": "076d6800d8ccafbaa31c32a6e23eecfc84f7d1e35c31a9128ec53736d5395747#0",
        "content_type": "text/plain; charset=utf-8",
        "sha256": "531a1eba80b297f8822b1505d480bb1c7f1bad2878ab29d8be01ba0e1fc67e12",
    },
    "genesis-scroll": {
        "type": "standard",
        "title": "The Genesis Scroll",
        "lock_txin": "a19f64fba94abdc37b50012d5d602c75a1ca73c82520ae030fc6b4e82274ceb2#0",
        "content_type": "text/plain; charset=utf-8",
        "sha256": None,
    },
    "constitution-e608": {
        "type": "legacy",
        "title": "Cardano Constitution (Epoch 608)",
        "policy_id": "ef91a425ef57d92db614085ef03718407fb293cb4b770bc6e03f9750",
        "manifest_asset": "CONSTITUTION_E608_MANIFEST",
        "sha256": "98a29aec8664b62912c1c0355ebae1401b7c0e53d632e8f05479e7821935abf1",
    },
    "constitution-e541": {
        "type": "legacy",
        "title": "Cardano Constitution (Epoch 541)",
        "policy_id": "d7559bbfa87f53674570fd01f564687c2954503b510ead009148a31d",
        "manifest_asset": "CONSTITUTION_E541_MANIFEST",
        "sha256": "1939c1627e49b5267114cbdb195d4ac417e545544ba6dcb47e03c679439e9566",
    },
    "bible": {
        "type": "legacy",
        "title": "Bible (HTML, gzip)",
        "policy_id": "2f0c8b54ef86ffcdd95ba87360ca5b485a8da4f085ded7988afc77e0",
        "manifest_asset": None,
        "sha256": None,
    },
    "bitcoin-whitepaper": {
        "type": "legacy",
        "title": "Bitcoin Whitepaper",
        "policy_id": "8dc3cb836ab8134c75e369391b047f5c2bf796df10d9bf44a33ef6d1",
        "manifest_asset": None,
        "sha256": None,
    },
}


class KoiosError(RuntimeError):
    pass


def guess_extension(content_type: str | None) -> str:
    if not content_type:
        return ".bin"
    main = content_type.split(";", 1)[0].strip().lower()
    mapping = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "text/plain": ".txt",
        "text/html": ".html",
        "application/json": ".json",
        "application/pdf": ".pdf",
    }
    return mapping.get(main, ".bin")


def _request_json(url: str, payload: Dict[str, Any] | None = None, timeout: int = 30) -> Any:
    if payload is None:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
    else:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def koios_post(path: str, payload: Dict[str, Any], retries: int = 5, backoff: float = 0.6, koios_base: str = DEFAULT_KOIOS) -> Any:
    url = f"{koios_base.rstrip('/')}/{path.lstrip('/')}"
    for attempt in range(retries):
        try:
            return _request_json(url, payload=payload)
        except Exception as exc:
            if attempt >= retries - 1:
                raise KoiosError(str(exc)) from exc
            time.sleep(backoff * (2**attempt))
    raise KoiosError("unreachable")


def hex_to_ascii(hex_str: str) -> str:
    try:
        return bytes.fromhex(hex_str).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def batched(items: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def extract_cip721(meta: Any) -> Dict[str, Any] | None:
    if isinstance(meta, dict):
        if "721" in meta:
            return meta["721"]
        if 721 in meta:
            return meta[721]
        return None
    if isinstance(meta, list):
        for item in meta:
            if isinstance(item, dict) and str(item.get("label")) == "721":
                return item.get("json_metadata") or item.get("metadata") or item.get("value")
    return None


def fetch_policy_assets(policy_id: str, *, koios_base: str) -> List[Dict[str, Any]]:
    return koios_post("policy_asset_list", {"_policy_id": policy_id}, koios_base=koios_base) or []


def fetch_asset_info(policy_id: str, asset_name: str, *, koios_base: str) -> Dict[str, Any]:
    rows = koios_post("asset_info", {"_asset_list": [[policy_id, asset_name]]}, koios_base=koios_base)
    if not rows:
        raise KoiosError(f"asset_info empty for {policy_id}.{asset_name}")
    return rows[0]


def fetch_tx_metadata(tx_hashes: List[str], *, koios_base: str) -> Dict[str, Any]:
    rows = koios_post("tx_metadata", {"_tx_hashes": tx_hashes}, koios_base=koios_base) or []
    out: Dict[str, Any] = {}
    for row in rows:
        tx = row.get("tx_hash")
        if tx:
            out[tx] = row.get("metadata")
    return out


def fetch_utxo_datum(txin: str, *, koios_base: str) -> bytes:
    rows = koios_post("utxo_info", {"_utxo_refs": [txin]}, koios_base=koios_base)
    if not rows:
        raise KoiosError(f"UTxO not found: {txin}")
    datum = rows[0].get("inline_datum") or {}
    datum_bytes = datum.get("bytes")
    if not datum_bytes:
        raise KoiosError("No inline datum bytes found")
    return bytes.fromhex(datum_bytes)


def reconstruct_legacy(policy_id: str, manifest_asset: str | None = None, expected_sha256: str | None = None, koios_base: str = DEFAULT_KOIOS) -> Tuple[bytes, str]:
    assets = fetch_policy_assets(policy_id, koios_base=koios_base)
    if not assets:
        raise KoiosError("No assets returned for policy.")

    asset_info: Dict[str, Dict[str, Any]] = {}
    mint_txs: List[str] = []

    for a in assets:
        asset_name = a.get("asset_name")
        if not asset_name:
            continue
        info = fetch_asset_info(policy_id, asset_name, koios_base=koios_base)
        asset_ascii = info.get("asset_name_ascii") or hex_to_ascii(asset_name)
        mint_tx = info.get("minting_tx_hash")
        asset_info[asset_name] = {
            "ascii": asset_ascii,
            "mint_tx": mint_tx,
        }
        if mint_tx:
            mint_txs.append(mint_tx)
        time.sleep(0.15)

    mint_txs = sorted(set(mint_txs))

    tx_meta: Dict[str, Any] = {}
    for batch in batched(mint_txs, 5):
        tx_meta.update(fetch_tx_metadata(batch, koios_base=koios_base))
        time.sleep(0.2)

    pages: List[Tuple[int, List[str]]] = []

    for asset_name, info in asset_info.items():
        tx_hash = info.get("mint_tx")
        if not tx_hash:
            continue
        meta = tx_meta.get(tx_hash)
        cip721 = extract_cip721(meta)
        if not cip721:
            continue
        policy_meta = cip721.get(policy_id) if isinstance(cip721, dict) else None
        if not policy_meta:
            continue

        asset_ascii = info.get("ascii")
        asset_meta = policy_meta.get(asset_ascii)
        if not asset_meta:
            continue

        if (asset_ascii and "MANIFEST" in asset_ascii) or asset_meta.get("role") == "manifest":
            if manifest_asset and asset_ascii != manifest_asset:
                continue
            continue

        page_idx = asset_meta.get("i") or asset_meta.get("index")
        if page_idx is None:
            continue
        try:
            idx = int(page_idx)
        except Exception:
            continue

        payload = (
            asset_meta.get("payload")
            or asset_meta.get("segments")
            or asset_meta.get("seg")
            or []
        )
        if isinstance(payload, str):
            payload = [payload]
        if not isinstance(payload, list):
            continue
        pages.append((idx, payload))

    if not pages:
        raise KoiosError("No pages found in metadata.")

    pages.sort(key=lambda x: x[0])
    hex_blob = "".join("".join(seg for seg in payload) for _, payload in pages)
    raw = bytes.fromhex(hex_blob)

    if raw.startswith(b"\x1f\x8b"):
        raw = gzip.decompress(raw)

    sha = hashlib.sha256(raw).hexdigest()
    if expected_sha256 and sha.lower() != expected_sha256.lower():
        raise KoiosError(f"SHA-256 mismatch: got {sha} expected {expected_sha256}")

    return raw, sha


def reconstruct_standard(txin: str, expected_sha256: str | None = None, koios_base: str = DEFAULT_KOIOS) -> Tuple[bytes, str]:
    raw = fetch_utxo_datum(txin, koios_base=koios_base)
    sha = hashlib.sha256(raw).hexdigest()
    if expected_sha256 and sha.lower() != expected_sha256.lower():
        raise KoiosError(f"SHA-256 mismatch: got {sha} expected {expected_sha256}")
    return raw, sha


def list_scrolls() -> None:
    for k, v in SCROLLS.items():
        print(f"{k:<20} {v['type']:<8} {v.get('title','')}")


def resolve_output_path(scroll_id: str, out_arg: str | None, output_dir: str, content_type: str | None) -> str:
    if out_arg:
        return out_arg
    ext = guess_extension(content_type)
    return os.path.join(output_dir, f"{scroll_id}{ext}")


def read_one(scroll_id: str, info: Dict[str, Any], *, koios_base: str) -> Tuple[bytes, str]:
    if info["type"] == "standard":
        return reconstruct_standard(info["lock_txin"], info.get("sha256"), koios_base=koios_base)
    return reconstruct_legacy(
        info["policy_id"],
        manifest_asset=info.get("manifest_asset"),
        expected_sha256=info.get("sha256"),
        koios_base=koios_base,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Read Ledger Scrolls via Koios (stdlib only)")
    parser.add_argument("scroll", nargs="?", help="Scroll id (use --list to see options)")
    parser.add_argument("--list", action="store_true", help="List known scrolls")
    parser.add_argument("--all", action="store_true", help="Download/verify all known scrolls")
    parser.add_argument("--save", action="store_true", help="Write full content to file")
    parser.add_argument("--verify", action="store_true", help="Verify hash only (no output)")
    parser.add_argument("--out", help="Output file (single-scroll mode)")
    parser.add_argument("--output-dir", default=".", help="Directory for saved files (default: .)")
    parser.add_argument("--koios", default=os.environ.get("KOIOS_API", DEFAULT_KOIOS), help="Koios API base URL")
    parser.add_argument("--json-report", help="Write JSON report with hashes/status")
    args = parser.parse_args()

    if args.list:
        list_scrolls()
        return

    if not args.all and (not args.scroll or args.scroll not in SCROLLS):
        raise SystemExit("Unknown scroll. Use --list to see options.")

    if args.all and args.out:
        raise SystemExit("--out is only valid for a single scroll")

    os.makedirs(args.output_dir, exist_ok=True)

    targets = list(SCROLLS.items()) if args.all else [(args.scroll, SCROLLS[args.scroll])]
    report: List[Dict[str, Any]] = []

    for scroll_id, info in targets:
        data, sha = read_one(scroll_id, info, koios_base=args.koios)

        if args.verify:
            print(f"OK — {scroll_id} SHA-256: {sha}")
            report.append({"scroll": scroll_id, "sha256": sha, "bytes": len(data), "status": "verified"})
            continue

        if args.save:
            out = resolve_output_path(scroll_id, args.out, args.output_dir, info.get("content_type"))
            with open(out, "wb") as f:
                f.write(data)
            print(f"Reconstructed: {out}")
            print(f"Bytes: {len(data)}")
            print(f"SHA-256: {sha}")
            report.append({"scroll": scroll_id, "sha256": sha, "bytes": len(data), "status": "saved", "path": out})
            continue

        preview = data.decode("utf-8", errors="ignore").splitlines()[:30]
        print("\n".join(preview))
        print("\n---")
        print(f"Scroll: {scroll_id}")
        print(f"Bytes: {len(data)}")
        print(f"SHA-256: {sha}")
        report.append({"scroll": scroll_id, "sha256": sha, "bytes": len(data), "status": "preview"})

    if args.json_report:
        with open(args.json_report, "w", encoding="utf-8") as f:
            json.dump({"koios": args.koios, "results": report}, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except KoiosError as exc:
        raise SystemExit(f"Koios error: {exc}")
