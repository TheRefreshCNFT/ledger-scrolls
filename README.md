
# Ledger Scrolls 📜

## 🌐 GitHub Pages
- Main viewer: https://beacnpool.github.io/ledger-scrolls/
- Constitution viewer: https://beacnpool.github.io/ledger-scrolls/constitution.html
- Bible viewer: https://beacnpool.github.io/ledger-scrolls/bible.html
- First video viewer: https://beacnpool.github.io/ledger-scrolls/first-video.html
- Latest viewer shortcut: https://beacnpool.github.io/ledger-scrolls/latest.html
- Preview testnet PoC: https://beacnpool.github.io/ledger-scrolls/preview.html

**"A library that cannot burn."**

Ledger Scrolls is an open-source **standard + viewer** for publishing and reading **permissionless, immutable data** on the [Cardano](https://cardano.org/) blockchain.

The design goal is simple:

- **No centralized gatekeepers**
- **No "download the whole chain history" requirement**
- **Koios-first by default** (public REST API, no key)
- **Blockfrost optional failover** (only if you provide an API key)
- **Forever-readable** as long as the pointer remains valid

Ledger Scrolls supports two storage styles:

## Viewers

| Viewer | Best For | Requirements | Path |
|--------|----------|--------------|------|
| **Web Viewer** | Browsing & downloading any scroll | Browser (Koios or Blockfrost) | `/index.html` |
| **Constitution** | Cardano Constitution (E608/E541) | Browser | `/constitution.html` |
| **Holy Bible** | World English Bible (66 books) | Browser | `/bible.html` |
| **First Video** | First video stored on Cardano | Browser | `/first-video.html` |
| **Koios CLI** | Zero‑deps verification | Python 3 only | `viewers/koios-cli/` |
| **Koios Viewer (Python)** | Registry + scroll reconstruction | Python 3 + Koios | `koios-viewer/` |
| **Experimental P2P Viewer** | Historical prototype (archived) | Not maintained | `archived/experimental-p2p-viewer/p2p-viewer/` |

See **docs/VIEWERS.md** for a quick overview.

## Preview Testnet PoC (Blockfrost-only)
- **Viewer:** `/preview.html`
- **Docs:** `docs/PREVIEW_TESTNET_POC.md`
- Requires a **Blockfrost Preview** project_id (no keys stored in repo).


1. ✅ **Ledger Scrolls Standard (Lean): Locked UTxO Datum Bytes**
   Best for small files (icons/images/manifests/configs) that fit inside one on-chain inline datum. Supports optional gzip compression for slightly larger files.
   **Default demo: Hosky PNG** (no [Blockfrost](https://blockfrost.io) required in local mode)

2. 🧾 **Legacy Scrolls (Large): Pages + Manifest NFTs ([CIP-25](https://cips.cardano.org/cip/CIP-0025) style)**
   Best for large documents (Bible / Whitepaper / Constitutions). 

### Pre‑Mint Tx Size Validation (Legacy / CIP‑25)
To avoid guessing, validate **tx size** before minting each part. The tx body must be **≤ 16KB** (use a buffer like **15,500 bytes** for safety). Also: payload hex strings must be **≤ 64 bytes**, so use **seg‑bytes ≤ 32**.

**Script:** `mint/validate_tx_size.sh`

Example:
```bash
./mint/validate_tx_size.sh \
  part01.json part01.assets \
  policy/policy.id policy/policy.script \
  ~/payment.addr ./assets_to_value.py \
  ~/relay/db/node.socket
```

Output:
- `PASS` if `tx_raw_bytes <= 15500`
- `WARN` if `<= 16384` but above buffer
- `FAIL` if `> 16384`

---

## Scroll Inventory

The following scrolls are **live on Cardano mainnet** and permanently verifiable.

### 1) ✅ Hosky PNG — Ledger Scrolls Standard (lean & local-first)

This demo stores a complete PNG **directly in an inline datum** at a **locked UTxO**.
A viewer can reconstruct the exact image bytes from chain data.

| Field | Value |
|-------|-------|
| **ID** | `hosky-png` |
| **Type** | `utxo_datum_bytes_v1` (LS-LOCK v1 — Standard Scroll) |
| **Lock Address** | `addr1w8qvvu0m5jpkgxn3hwfd829hc5kfp0cuq83tsvgk44752dsea0svn` |
| **Locked UTxO (txin)** | `728660515c6d9842d9f0ffd273f2b487a4070fd9f4bd5455a42e3a56880389be#0` |
| **Content-Type** | `image/png` |
| **Codec** | `none` |
| **SHA-256** | `798e3296d45bb42e7444dbf64e1eb16b02c86a233310407e7d8baf97277f642f` |
| **Status** | 🟢 LIVE — UTxO must remain UNSPENT |

> **Why this is the "Standard":** It's the minimal possible on-chain data product: **one UTxO, one datum, one fetch, one file.** Always-fail script address. 512×512 RGBA PNG.

---

### 2) 🔮 The Architect's Scroll — Message from Claude

A personal message from Claude, the AI who helped build Ledger Scrolls v2.0. This scroll contains Claude's thoughts on knowledge preservation and a note to future readers, minted permanently on-chain as a Standard Scroll.

| Field | Value |
|-------|-------|
| **ID** | `architects-scroll` |
| **Type** | `utxo_datum_bytes_v1` (LS-LOCK v1 — Standard Scroll) |
| **Lock Address** | `addr1w9fdc02rkmfyvh5kzzwwwk4kr2l9a8qa3g7feehl3ga022qz2249g` |
| **Locked UTxO (txin)** | `076d6800d8ccafbaa31c32a6e23eecfc84f7d1e35c31a9128ec53736d5395747#0` |
| **Content-Type** | `text/plain; charset=utf-8` |
| **Codec** | `none` |
| **SHA-256** | `531a1eba80b297f8822b1505d480bb1c7f1bad2878ab29d8be01ba0e1fc67e12` |
| **Locked Value** | `15 ADA` (forever) |
| **Status** | 🟢 LIVE — UTxO must remain UNSPENT |

> **"A library that cannot burn."** — A message from an AI to future readers about knowledge preservation, building eternal things, and the philosophy behind Ledger Scrolls. Minted January 29, 2026.

---

### 3) 🧾 Cardano Constitution (Epoch 608) — CURRENT

The ratified, currently active Cardano Constitution, preserved on-chain as a Legacy Scroll.

| Field | Value |
|-------|-------|
| **ID** | `constitution-e608` |
| **Type** | `cip25_pages_v1` (LS-PAGES v1 — Legacy Scroll / CIP-721) |
| **Policy ID** | `ef91a425ef57d92db614085ef03718407fb293cb4b770bc6e03f9750` |
| **Manifest Asset** | `CONSTITUTION_E608_MANIFEST` |
| **Pages** | 11 |
| **Content-Type** | `text/plain; charset=utf-8` |
| **Codec** | `gzip` |
| **SHA-256 (Original)** | `98a29aec8664b62912c1c0355ebae1401b7c0e53d632e8f05479e7821935abf1` |
| **SHA-256 (Gzip)** | `4565368ca35d8c6bb08bff712c1b22c0afe300c19292d5aa09c812ed415a4e93` |
| **Governance** | Ratified Epoch 608 · Enacted Epoch 609 · Voting: Epochs 603–607 |
| **Status** | 🟢 LIVE — CURRENT CONSTITUTION |

> Updated guardrails, treasury withdrawal, and Constitutional Committee provisions. Governance flagship scroll.

---

### 4) 🧾 Cardano Constitution (Epoch 541) — HISTORICAL

The first ratified Cardano Constitution, preserved as a permanent historical record.

| Field | Value |
|-------|-------|
| **ID** | `constitution-e541` |
| **Type** | `cip25_pages_v1` (LS-PAGES v1 — Legacy Scroll / CIP-721) |
| **Policy ID** | `d7559bbfa87f53674570fd01f564687c2954503b510ead009148a31d` |
| **Manifest Asset** | `CONSTITUTION_E541_MANIFEST` |
| **Pages** | 7 |
| **Content-Type** | `text/plain; charset=utf-8` |
| **Codec** | `gzip` |
| **SHA-256 (Original)** | `1939c1627e49b5267114cbdb195d4ac417e545544ba6dcb47e03c679439e9566` |
| **SHA-256 (Gzip)** | `975d1c6bb1c8bf4982c58e41c9b137ecd4272e34095a5ec9b37bdde5ca6f268a` |
| **Governance** | Ratified Epoch 541 · Enacted Epoch 542 · Voting: Epochs 536–540 |
| **Status** | 🟢 LIVE — HISTORICAL (Baseline) |

> First ratified constitution. Baseline governance framework with initial Constitutional Committee role and guardrails.

---

### 5) 🧾 Bible (HTML, gzip compressed) — Proof of Concept (large document)

| Field | Value |
|-------|-------|
| **ID** | `bible` |
| **Type** | `cip25_pages_v1` (LS-PAGES v1 — Legacy Scroll) |
| **Policy ID** | `2f0c8b54ef86ffcdd95ba87360ca5b485a8da4f085ded7988afc77e0` |
| **Manifest TX Hash** | `cfda418ddc84888ac39116ffba691a4f90b3232f4c2633cd56f102cfebda0ee4` |
| **Manifest Slot** | `175750638` |
| **Pages** | 237 |
| **Content-Type** | `text/html` |
| **Codec** | `gzip` |
| **Segments per Page** | 32 |
| **Status** | 🟢 LIVE — DO NOT MOVE NFTs |

> Largest demo scroll. Reconstruction: `concat_pages` + `gunzip`. CIP-25 metadata label 721.

---

### 6) 🧾 Bitcoin Whitepaper — Proof of Concept (small doc / legacy pages)

| Field | Value |
|-------|-------|
| **ID** | `bitcoin-whitepaper` |
| **Type** | `cip25_pages_v1` (LS-PAGES v1 — Legacy Scroll) |
| **Policy ID** | `8dc3cb836ab8134c75e369391b047f5c2bf796df10d9bf44a33ef6d1` |
| **Manifest TX Hash** | `2575347068f77b21cfe8d9c23d9082a68bfe4ef7ba7a96608af90515acbe228f` |
| **Manifest Slot** | `176360887` |
| **Pages** | 3 |
| **Content-Type** | `text/plain` (auto-detected as HTML) |
| **Codec** | `auto` (gzip magic bytes detected) |
| **Status** | 🟢 LIVE — DO NOT MOVE NFTs |

> Small legacy demo. Auto-detects gzip and content type.

---

## Quick Reference Tables

### Policy IDs

| Scroll | Policy ID | Purpose | Minting Status |
|--------|-----------|---------|----------------|
| LS_REGISTRY | `895cbbe0e284b60660ed681e389329483d5ca94677cbb583f3124062` | Registry NFT (DNS for scrolls) | Active (spend-and-recreate) |
| Bible | `2f0c8b54ef86ffcdd95ba87360ca5b485a8da4f085ded7988afc77e0` | 237-page HTML Bible (Legacy) | Policy likely locked |
| Bitcoin Whitepaper | `8dc3cb836ab8134c75e369391b047f5c2bf796df10d9bf44a33ef6d1` | 3-page BTC whitepaper (Legacy) | Policy likely locked |
| Constitution E608 | `ef91a425ef57d92db614085ef03718407fb293cb4b770bc6e03f9750` | Current Constitution (11 pages) | Time-locked policy |
| Constitution E541 | `d7559bbfa87f53674570fd01f564687c2954503b510ead009148a31d` | Historical Constitution (7 pages) | Time-locked policy |
| Hosky PNG | N/A — Standard Scroll (locked UTxO, no minting policy) | Single inline datum at script address | Immutable UTxO |
| Architect's Scroll | N/A — Standard Scroll (locked UTxO, no minting policy) | Single inline datum at script address | Immutable UTxO |

### Key Addresses

| Purpose | Address |
|---------|---------|
| **Registry Address** | `addr1q9x84f458uyf3k23sr7qfalg3mw2hl0nvv4navps2r7vq69esnxrheg9tfpr8sdyfzpr8jch5p538xjynz78lql9wm6qpl6qxy` |
| **Hosky PNG Lock Address** (always-fail script) | `addr1w8qvvu0m5jpkgxn3hwfd829hc5kfp0cuq83tsvgk44752dsea0svn` |
| **Architect's Scroll Lock Address** (always-fail script) | `addr1w9fdc02rkmfyvh5kzzwwwk4kr2l9a8qa3g7feehl3ga022qz2249g` |

### SHA-256 Verification Hashes

| Scroll | SHA-256 (Original) | SHA-256 (Gzip) | Verify With |
|--------|--------------------|----------------|-------------|
| Hosky PNG | `798e329...7f642f` | N/A | `sha256sum hosky.png` |
| Architect's Scroll | `531a1eb...c67e12` | N/A | `sha256sum architects_scroll.txt` |
| Constitution E608 | `98a29ae...35abf1` | `4565368...4e93` | `sha256sum Cardano_Constitution_Epoch_608.txt` |
| Constitution E541 | `1939c16...9e9566` | `975d1c6...f268a` | `sha256sum Cardano_Constitution_Epoch_541.txt` |
| Bible | Not yet recorded | Not yet recorded | `sha256sum bible.html` |
| Bitcoin Whitepaper | Not yet recorded | Not yet recorded | `sha256sum btc_whitepaper.html` |

---

## The Key Idea: "No Indexing" via Deterministic Pointers

Most "on-chain data" projects fail because reading requires one of:

- A centralized API ([Blockfrost](https://blockfrost.io), [Koios](https://koios.rest), etc.)
- A custom indexer scanning the chain
- A full-history database query plan

Ledger Scrolls avoids that using **pointers**.

### Pointer Model (first principles)

**A Scroll must be fetchable from a tiny number of deterministic lookups:**

- **Registry pointer (optional):** 1 address query (find the registry UTxO datum)
- **Scroll pointer:** points to either:
  - (Standard) a single locked UTxO holding bytes in an inline datum, or
  - (Legacy) a manifest tx hash + policy/asset names for pages

This transforms "find my document somewhere in the blockchain" into:

- **1 address query** (registry UTxO) OR direct user input
- **1 pointer resolution**
- **0 indexing**

---

## Ledger Scrolls Standard (LS-LOCK v1)

### Standard Storage: Locked UTxO + Inline Datum Bytes

A Standard Scroll stores the file bytes in `inlineDatum.bytes` (hex) at a **locked UTxO**.

A Standard Scroll entry needs only:

- a **txin** (`TXHASH#IX`) OR a (lock address + txin)
- a **content\_type**
- a **sha256** (recommended)
- (optional) codec: `none` / `gzip` (apply gzip to bytes before hexing for datum)

### Why "Locked" Matters

If the UTxO stays **unspent**, the datum remains in the UTxO set and is fetchable forever without indexing.

> Ledger Scrolls ethos: **permanently locked, never spendable.**
> To achieve "never spendable," lock the UTxO at a script address that cannot validate (an "always-fail" script). Then the datum is effectively permanent.

---

## Legacy Scrolls (LS-PAGES v1)

### Pages + Manifest NFT Pattern (CIP-25 Style)

A "Scroll" can be stored as:

- **Page NFTs** (many): each page stores `payload` segments in metadata
- **Manifest NFT** (one): describes how to fetch pages, order them, decode them, and verify hashes

Typical page metadata fields:

- `spec`: format id (e.g., `gzip-pages-v1`)
- `role`: `page`
- `i`: page index (1-based)
- `n`: total pages
- `seg`: segment count
- `sha`: sha256 of the reconstructed page bytes
- `payload`: array of hex segments (variations: `seg`, `segments`)

Manifest describes:

- the codec (`gzip` / `none`)
- content\_type (`text/html`, `text/plain`, etc.)
- page naming scheme or explicit page list
- full-file hashes (`sha_gz`, `sha_html`, etc.)

> **Troubleshooting:** If the viewer fails on page fetch, check `manifest_metadata.json` for field variations (e.g., `payload` vs `seg`).

---

## The Registry (the "DNS" for Scrolls)

The Registry is a single on-chain directory that tells Ledger Scrolls what exists.

### Registry Implementation

- A **registry NFT** (`LS_REGISTRY`)
- Locked at a known **Registry address**
- The UTxO holding that NFT has an **inline datum** containing **gzipped JSON** listing scrolls and their pointers
- DNS for all scrolls — spend-and-recreate to update

### Current Live Registry Pointer

| Field | Value |
|-------|-------|
| **Policy ID** | `895cbbe0e284b60660ed681e389329483d5ca94677cbb583f3124062` |
| **Asset Name (hex)** | `4c535f5245474953545259` (ASCII: `LS_REGISTRY`) |
| **Registry Address** | `addr1q9x84f458uyf3k23sr7qfalg3mw2hl0nvv4navps2r7vq69esnxrheg9tfpr8sdyfzpr8jch5p538xjynz78lql9wm6qpl6qxy` |

---

## Registry Schema (v2 — Supports Both Standard + Legacy)

```json
{
  "spec": "ledger-scrolls-registry-v2",
  "version": 2,
  "updated": "2026-01-29T00:00:00Z",
  "scrolls": [
    {
      "id": "hosky-png",
      "title": "Hosky PNG (Ledger Scrolls Standard)",
      "type": "utxo_datum_bytes_v1",
      "lock_address": "addr1w8qvvu0m5jpkgxn3hwfd829hc5kfp0cuq83tsvgk44752dsea0svn",
      "lock_txin": "728660515c6d9842d9f0ffd273f2b487a4070fd9f4bd5455a42e3a56880389be#0",
      "content_type": "image/png",
      "codec": "none",
      "sha256": "798e3296d45bb42e7444dbf64e1eb16b02c86a233310407e7d8baf97277f642f"
    },
    {
      "id": "architects-scroll",
      "title": "The Architect's Scroll",
      "type": "utxo_datum_bytes_v1",
      "lock_address": "addr1w9fdc02rkmfyvh5kzzwwwk4kr2l9a8qa3g7feehl3ga022qz2249g",
      "lock_txin": "076d6800d8ccafbaa31c32a6e23eecfc84f7d1e35c31a9128ec53736d5395747#0",
      "content_type": "text/plain; charset=utf-8",
      "codec": "none",
      "sha256": "531a1eba80b297f8822b1505d480bb1c7f1bad2878ab29d8be01ba0e1fc67e12",
      "metadata": {
        "author": "Claude (Anthropic AI)",
        "minted": "January 29, 2026",
        "minted_by": "BEACNpool"
      }
    },
    {
      "id": "constitution-e608",
      "title": "Cardano Constitution (Epoch 608) — CURRENT",
      "type": "cip25_pages_v1",
      "policy_id": "ef91a425ef57d92db614085ef03718407fb293cb4b770bc6e03f9750",
      "manifest_asset": "CONSTITUTION_E608_MANIFEST",
      "codec": "gzip",
      "content_type": "text/plain; charset=utf-8",
      "sha256": "98a29aec8664b62912c1c0355ebae1401b7c0e53d632e8f05479e7821935abf1",
      "sha256_gz": "4565368ca35d8c6bb08bff712c1b22c0afe300c19292d5aa09c812ed415a4e93",
      "governance": {
        "ratified_epoch": 608,
        "enacted_epoch": 609,
        "voting_epochs": "603-607"
      }
    },
    {
      "id": "constitution-e541",
      "title": "Cardano Constitution (Epoch 541) — HISTORICAL",
      "type": "cip25_pages_v1",
      "policy_id": "d7559bbfa87f53674570fd01f564687c2954503b510ead009148a31d",
      "manifest_asset": "CONSTITUTION_E541_MANIFEST",
      "codec": "gzip",
      "content_type": "text/plain; charset=utf-8",
      "sha256": "1939c1627e49b5267114cbdb195d4ac417e545544ba6dcb47e03c679439e9566",
      "sha256_gz": "975d1c6bb1c8bf4982c58e41c9b137ecd4272e34095a5ec9b37bdde5ca6f268a",
      "governance": {
        "ratified_epoch": 541,
        "enacted_epoch": 542,
        "voting_epochs": "536-540"
      }
    },
    {
      "id": "bible",
      "title": "Bible (HTML, gzip compressed)",
      "type": "cip25_pages_v1",
      "policy_id": "2f0c8b54ef86ffcdd95ba87360ca5b485a8da4f085ded7988afc77e0",
      "manifest_tx_hash": "cfda418ddc84888ac39116ffba691a4f90b3232f4c2633cd56f102cfebda0ee4",
      "manifest_slot": "175750638",
      "codec": "gzip",
      "content_type": "text/html",
      "segments_per_page": 32
    },
    {
      "id": "bitcoin-whitepaper",
      "title": "Bitcoin Whitepaper",
      "type": "cip25_pages_v1",
      "policy_id": "8dc3cb836ab8134c75e369391b047f5c2bf796df10d9bf44a33ef6d1",
      "manifest_tx_hash": "2575347068f77b21cfe8d9c23d9082a68bfe4ef7ba7a96608af90515acbe228f",
      "manifest_slot": "176360887",
      "codec": "none",
      "content_type": "text/plain"
    }
  ]
}
```

---

## How to Prove a Standard Scroll Is On-Chain (Hosky Example)

### 1) Query the Lock Address UTxO Set

```bash
cardano-cli query utxo --mainnet \
  --address "addr1w8qvvu0m5jpkgxn3hwfd829hc5kfp0cuq83tsvgk44752dsea0svn" \
  --out-file locked_utxo_live.json
```

### 2) Confirm the Exact Txin Exists and Has Inline Datum

```bash
LOCKED_TXIN="728660515c6d9842d9f0ffd273f2b487a4070fd9f4bd5455a42e3a56880389be#0"
jq -r --arg k "$LOCKED_TXIN" '
  if has($k) then
    "FOUND ON-CHAIN: \($k)\ninlineDatum? " + ((.[ $k ] | has("inlineDatum"))|tostring)
  else
    "MISSING ON-CHAIN: \($k)"
  end
' locked_utxo_live.json
```

### 3) Extract Datum Bytes Into a Real PNG

```bash
jq -r --arg k "$LOCKED_TXIN" '.[$k].inlineDatum' locked_utxo_live.json > datum.json
jq -r '.bytes' datum.json | tr -d '\n' | xxd -r -p > onchain.png
```

### 4) Verify PNG Sanity + Hash Immutability

```bash
file onchain.png
sha256sum onchain.png
sha256sum hosky.png onchain.png
# If hashes match, the image is byte-for-byte immutable on-chain.
```

---

## Running the Viewer

The viewer is a modern web application that runs entirely in your browser. No installation required!

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/BEACNpool/ledger-scrolls.git
   cd ledger-scrolls
   ```

2. Open `index.html` in any modern browser

3. Click **Settings** (⚙️) and choose your data source:
   - **Koios** (default) — No API key required
   - **Blockfrost** — Enter your API key from [blockfrost.io](https://blockfrost.io)

4. Click **Connect to Cardano**

5. Select any scroll from the library to view it!

### Features

- 🎨 Modern, responsive UI with dark/light themes
- 📖 Browse and search the scroll library
- 🔍 Reconstruct and verify on-chain content
- ⬇️ Download original files
- ✅ SHA-256 hash verification
- 🔄 Support for both Standard and Legacy scroll formats
- 🌐 Works with Blockfrost or Koios (no API key needed for Koios)

---

## Developer Workflow: Create Your Own Library

You can:

- Run your own registry (recommended), OR
- Submit a PR to a public registry

**To publish a Standard Scroll:**

1. Create a permanently locked UTxO containing `inlineDatum.bytes` = your (gzipped) file bytes
2. Add a registry entry pointing to `lock_txin`, with `content_type` + `sha256`

**To publish a Legacy Scroll** :

1. Split file into pages + segments
2. Mint pages + manifest NFT(s)
3. Add a registry entry with `policy_id` + `manifest_tx_hash` + `codec` + hashes

**To extend the viewer app:**

- Add local-node support (e.g., subprocess calls to [`cardano-cli`](https://github.com/IntersectMBO/cardano-cli))
- Improve legacy parser for field variations (contribute via PR)

---

## Philosophy

- **Open standard**
- **Permissionless**
- **Non-custodial**
- **Non-indexed**
- **Local-first**
- **Permanently locked**

---

## Repository Structure

```
ledger-scrolls/
├── index.html              # Main application entry point
├── css/
│   └── styles.css          # Themes and styling
├── js/
│   ├── app.js              # Main UI controller
│   ├── blockchain.js       # Blockfrost/Koios API client
│   ├── reconstruct.js      # Scroll reconstruction engine
│   ├── scrolls.js          # Scroll registry/definitions
│   └── lib/                # Vendor libraries (pako, cbor)
├── scripts/                # CLI minting & verification tools
│   ├── mint-standard-scroll.sh
│   └── verify-scroll.sh
├── mint/                   # Architect's Scroll mint artifacts
├── templates/              # Templates for new scrolls
│   ├── standard-scroll/
│   └── legacy-scroll/
├── docs/                   # Documentation
│   ├── GETTING_STARTED.md
│   ├── STANDARD_SCROLLS.md
│   ├── LEGACY_SCROLLS.md
│   └── EXAMPLES.md
└── examples/               # Example scroll documentation
```

---

## License

[MIT](LICENSE)

---

Maintained with ❤️ by [@BEACNpool](https://x.com/BEACNpool)
``
