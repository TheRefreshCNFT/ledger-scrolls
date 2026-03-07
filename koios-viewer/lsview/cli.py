from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import cbor2

from .catalog import load_catalog
from .koios import (
    KoiosError,
    asset_info,
    get_inline_datum_hex_from_utxo_info_row,
    policy_asset_list,
    tx_metadata,
    utxo_info,
    with_retries,
)


PUBLIC_REGISTRY_HEAD_TXIN = "a9c56fb3d4d8b526fe7a0aa7c2416615154af30c2c09ce747a899a886ba8bad9#0"


class RegistryError(RuntimeError):
    pass


def sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _hex_to_ascii(hex_str: str) -> str:
    try:
        return bytes.fromhex(hex_str).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def _extract_cip721(meta: Any) -> Dict[str, Any] | None:
    # Koios tx_metadata returns different shapes; support common ones.
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


def _decode_registry_datum_to_json(datum_hex: str) -> Dict[str, Any]:
    raw = bytes.fromhex(datum_hex)

    # The standard datum encoding we minted is "CBOR bytes -> JSON bytes".
    # Koios might return either the CBOR itself or the already-decoded bytes.
    try:
        decoded = cbor2.loads(raw)
        if isinstance(decoded, (bytes, bytearray)):
            raw = bytes(decoded)
    except Exception:
        pass

    try:
        txt = raw.decode("utf-8")
    except Exception as exc:
        raise RegistryError(f"Datum is not UTF-8: {exc}") from exc

    try:
        return json.loads(txt)
    except Exception as exc:
        raise RegistryError(f"Datum is not JSON: {exc}") from exc


def read_utxo_inline_datum_json(txin: str) -> Dict[str, Any]:
    row = with_retries(lambda: utxo_info(txin))
    datum_hex = get_inline_datum_hex_from_utxo_info_row(row)
    return _decode_registry_datum_to_json(datum_hex)


def read_registry_head(txin: str) -> Dict[str, Any]:
    head = read_utxo_inline_datum_json(txin)
    if head.get("format") != "ledger-scrolls-registry-head":
        raise RegistryError("Not a registry head datum")
    return head


def read_registry_list(txin: str) -> Dict[str, Any]:
    lst = read_utxo_inline_datum_json(txin)
    if lst.get("format") != "ledger-scrolls-registry-list":
        raise RegistryError("Not a registry list datum")
    return lst


def _parse_txin(txin: str) -> Tuple[str, int]:
    if "#" not in txin:
        raise RegistryError("txin must be <txHash>#<txIx>")
    h, ix = txin.split("#", 1)
    return h, int(ix)


def reconstruct_standard_from_txin(txin: str, expected_sha256: Optional[str] = None) -> Tuple[bytes, str]:
    row = with_retries(lambda: utxo_info(txin))
    datum_hex = get_inline_datum_hex_from_utxo_info_row(row)
    raw = bytes.fromhex(datum_hex)

    # For standard scrolls, the datum bytes are typically the file bytes. No extra CBOR wrapper.
    # If CBOR-decodes to bytes, accept that too.
    try:
        decoded = cbor2.loads(raw)
        if isinstance(decoded, (bytes, bytearray)):
            raw = bytes(decoded)
    except Exception:
        pass

    sha = sha256_hex(raw)
    if expected_sha256 and sha.lower() != expected_sha256.lower():
        raise RegistryError(f"SHA-256 mismatch: got {sha} expected {expected_sha256}")
    return raw, sha


def reconstruct_legacy_cip25(policy_id: str, manifest_asset: str | None = None, expected_sha256: str | None = None) -> Tuple[bytes, str]:
    # This is the same approach as viewers/koios-cli/read_scroll.py but inside the lsview package.
    assets = with_retries(lambda: policy_asset_list(policy_id))
    if not assets:
        raise RegistryError("No assets returned for policy")

    info_map: Dict[str, Dict[str, Any]] = {}
    mint_txs: List[str] = []

    # Fetch asset info (Koios rate-limited; keep gentle)
    for a in assets:
        asset_name_hex = a.get("asset_name")
        if not asset_name_hex:
            continue
        info = with_retries(lambda h=asset_name_hex: asset_info(policy_id, h))
        asset_ascii = info.get("asset_name_ascii") or _hex_to_ascii(asset_name_hex)
        mint_tx = info.get("minting_tx_hash")
        info_map[asset_name_hex] = {"ascii": asset_ascii, "mint_tx": mint_tx}
        if mint_tx:
            mint_txs.append(str(mint_tx))

    mint_txs = sorted(set(mint_txs))

    # Fetch metadata in batches
    meta_by_tx: Dict[str, Any] = {}
    for i in range(0, len(mint_txs), 5):
        batch = mint_txs[i : i + 5]
        meta_by_tx.update(with_retries(lambda b=batch: tx_metadata(b)))

    pages: List[Tuple[int, List[str]]] = []

    for asset_hex, inf in info_map.items():
        tx_hash = inf.get("mint_tx")
        if not tx_hash:
            continue
        meta = meta_by_tx.get(str(tx_hash))
        cip721 = _extract_cip721(meta)
        if not cip721 or not isinstance(cip721, dict):
            continue
        policy_meta = cip721.get(policy_id)
        if not isinstance(policy_meta, dict):
            continue

        asset_ascii = inf.get("ascii")
        asset_meta = policy_meta.get(asset_ascii) if asset_ascii else None
        if not isinstance(asset_meta, dict):
            continue

        # Skip manifest
        is_manifest = False
        if manifest_asset and asset_ascii == manifest_asset:
            is_manifest = True
        elif any(k in asset_meta for k in ("codec", "content_type", "content-type", "sha256", "sha", "sha256_gz", "sha_gz")):
            is_manifest = True
        if is_manifest:
            continue

        idx = asset_meta.get("i") or asset_meta.get("index")
        if idx is None:
            continue
        try:
            page_idx = int(idx)
        except Exception:
            continue

        payload = asset_meta.get("payload") or asset_meta.get("segments") or asset_meta.get("seg") or []
        if isinstance(payload, str):
            payload = [payload]
        if not isinstance(payload, list):
            continue

        pages.append((page_idx, [str(x) for x in payload]))

    if not pages:
        raise RegistryError("No pages found in CIP-721 metadata")

    pages.sort(key=lambda x: x[0])
    hex_blob = "".join("".join(seg for seg in payload) for _, payload in pages)
    raw = bytes.fromhex(hex_blob)
    if raw.startswith(b"\x1f\x8b"):
        raw = gzip.decompress(raw)

    sha = sha256_hex(raw)
    if expected_sha256 and sha.lower() != expected_sha256.lower():
        raise RegistryError(f"SHA-256 mismatch: got {sha} expected {expected_sha256}")

    return raw, sha


def _merge_registry_lists(base: Dict[str, Any], extra: Dict[str, Any], *, extra_label: str) -> Dict[str, Any]:
    """Merge two registry list objects.

    Rule: later lists override earlier lists on name collisions.
    (This matches the user's explicit opt-in: private heads should override public.)
    """
    if base.get("format") != "ledger-scrolls-registry-list" or extra.get("format") != "ledger-scrolls-registry-list":
        raise RegistryError("Cannot merge: invalid registry list format")

    base_entries = base.get("entries") or []
    extra_entries = extra.get("entries") or []
    if not isinstance(base_entries, list) or not isinstance(extra_entries, list):
        raise RegistryError("Cannot merge: entries must be lists")

    out_map: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    def add_entries(entries: List[Any], label: str) -> None:
        for e in entries:
            if not isinstance(e, dict):
                continue
            name = e.get("name")
            if not isinstance(name, str) or not name:
                continue
            if name not in out_map:
                order.append(name)
            # override
            ee = dict(e)
            ee.setdefault("_source", label)
            out_map[name] = ee

    add_entries(base_entries, "base")
    add_entries(extra_entries, extra_label)

    merged = dict(base)
    merged["entries"] = [out_map[n] for n in order]
    return merged


def _registry_list_from_head_txin(head_txin: str) -> Tuple[str, Dict[str, Any]]:
    head = read_registry_head(head_txin)
    ptr = head.get("registryList")
    if not isinstance(ptr, dict) or ptr.get("kind") != "utxo-inline-datum-bytes-v1":
        raise RegistryError("Head registryList pointer missing or unsupported")

    txhash = ptr.get("txHash")
    txix = ptr.get("txIx")
    if not txhash or txix is None:
        raise RegistryError("Invalid registryList pointer")

    list_txin = f"{txhash}#{int(txix)}"
    lst = read_registry_list(list_txin)
    return list_txin, lst


def cmd_registry_dump(args) -> None:
    # public default
    head_txin = args.head or PUBLIC_REGISTRY_HEAD_TXIN

    list_txin, lst = _registry_list_from_head_txin(head_txin)

    # merge in private heads (optional)
    merged = lst
    private_lists: List[Dict[str, Any]] = []
    for i, ph in enumerate(getattr(args, "private_head", []) or []):
        p_list_txin, p_list = _registry_list_from_head_txin(ph)
        private_lists.append({"head": ph, "list_txin": p_list_txin})
        merged = _merge_registry_lists(merged, p_list, extra_label=f"private[{i}]")

    out = {
        "head": {"txin": head_txin},
        "list": {"txin": list_txin},
        "private": private_lists,
        "merged": merged,
    }

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2)
            f.write("\n")
        print(f"Wrote: {args.out}")
    else:
        print(json.dumps(out, indent=2))


def cmd_list_scrolls(args) -> None:
    catalog = load_catalog(args.catalog)
    for entry in catalog.values():
        data = entry.data
        kind = data.get("type")
        print(f"{entry.id} ({kind})")


def cmd_reconstruct_utxo(args) -> None:
    if not args.txin and args.scroll:
        catalog = load_catalog(args.catalog)
        entry = catalog.get(args.scroll)
        if not entry:
            raise SystemExit(f"Unknown scroll id: {args.scroll}")
        if entry.data.get("type") != "utxo_datum_bytes_v1":
            raise SystemExit("Selected scroll is not a Standard Scroll")
        tx_hash = entry.data.get("tx_hash")
        tx_ix = entry.data.get("tx_ix")
        if tx_hash is None or tx_ix is None:
            raise SystemExit("Catalog entry missing tx_hash/tx_ix")
        args.txin = f"{tx_hash}#{int(tx_ix)}"

    if not args.txin:
        raise SystemExit("Provide --txin <txHash#txIx> or --scroll")

    data, sha = reconstruct_standard_from_txin(args.txin)

    if args.out:
        with open(args.out, "wb") as f:
            f.write(data)
        print(f"Reconstructed: {args.out}")
    print(f"Bytes: {len(data)}")
    print(f"SHA-256: {sha}")


def cmd_reconstruct_cip25(args) -> None:
    policy = args.policy
    manifest_asset = args.manifest_asset

    if args.scroll:
        catalog = load_catalog(args.catalog)
        entry = catalog.get(args.scroll)
        if not entry:
            raise SystemExit(f"Unknown scroll id: {args.scroll}")
        if entry.data.get("type") != "cip25_pages_v1":
            raise SystemExit("Selected scroll is not a CIP-25 pages scroll")
        policy = entry.data.get("policy_id") or policy
        manifest_asset = entry.data.get("manifest_asset") or manifest_asset

    if not policy:
        raise SystemExit("Missing --policy (or use --scroll from catalog)")

    data, sha = reconstruct_legacy_cip25(policy_id=policy, manifest_asset=manifest_asset)

    if args.out:
        with open(args.out, "wb") as f:
            f.write(data)
        print(f"Reconstructed: {args.out}")
    print(f"Bytes: {len(data)}")
    print(f"SHA-256: {sha}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="lsview",
        description="Ledger Scrolls Viewer (Koios-first; Blockfrost optional fallback)",
    )

    sp = p.add_subparsers(dest="cmd", required=True)

    rg = sp.add_parser("registry-dump", help="Fetch registry head + list from on-chain inline datums")
    rg.add_argument("--head", default=PUBLIC_REGISTRY_HEAD_TXIN, help="Head txin (default: public BEACN head)")
    rg.add_argument("--private-head", action="append", default=[], help="Optional additional head txin(s) to merge (private overrides public)")
    rg.add_argument("--out", help="Write JSON output")
    rg.set_defaults(func=cmd_registry_dump)

    rc = sp.add_parser("reconstruct-cip25", help="Reconstruct CIP-25 pages scroll via Koios metadata")
    rc.add_argument("--scroll", help="Scroll id from catalog")
    rc.add_argument("--catalog", help="Path to catalog JSON (defaults to examples/scrolls.json)")
    rc.add_argument("--policy", help="Policy ID hex")
    rc.add_argument("--manifest-asset", help="Manifest asset name (optional)")
    rc.add_argument("--out", required=True, help="Output filename")
    rc.set_defaults(func=cmd_reconstruct_cip25)

    ru = sp.add_parser("reconstruct-utxo", help="Reconstruct Standard Scroll from Koios utxo_info inline datum")
    ru.add_argument("--scroll", help="Scroll id from catalog")
    ru.add_argument("--catalog", help="Path to catalog JSON (defaults to examples/scrolls.json)")
    ru.add_argument("--txin", help="TxIn as <txHash#txIx>")
    ru.add_argument("--out", required=True, help="Output filename")
    ru.set_defaults(func=cmd_reconstruct_utxo)

    ls = sp.add_parser("list-scrolls", help="List known scrolls from catalog")
    ls.add_argument("--catalog", help="Path to catalog JSON (defaults to examples/scrolls.json)")
    ls.set_defaults(func=cmd_list_scrolls)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
