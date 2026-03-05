# Ledger Scrolls Repository Review & Strategic Recommendations (March 2026)

## Executive Summary

Ledger Scrolls already has a compelling core: **immutable bytes anchored on Cardano, deterministic reconstruction, and multiple reader paths** (web + Python + CLI). The project is directionally strong for the “library that cannot burn” mission.

The highest-leverage next step is to tighten the boundary between:

1. **Protocol/spec truth** (canonical wire format and verification rules), and
2. **Viewer/tooling implementations** (which currently mix legacy and newer naming conventions).

If this boundary is hardened, Ledger Scrolls can become a durable archival primitive instead of only a successful demo system.

---

## What Is Already Strong

- **Clear dual model**: Standard (single UTxO inline datum) for small immutable artifacts, and Legacy (CIP-25 paged) for large content.
- **Hash-first verification mindset** throughout docs and code.
- **Multiple independent readers** (browser + Python scripts), which is good for trust minimization.
- **Registry fork model** that explicitly treats reader trust anchors as the defense line.

These are excellent foundations for an on-chain media permanence standard.

---

## Critical Recommendations (P0)

## 1) Freeze and version the canonical pointer vocabulary

### Why this matters
Current docs/spec text and JSON schemas/tooling use different pointer kind names and field shapes in places. This risks ecosystem fragmentation where different clients resolve different objects.

### Recommendation
- Publish one canonical **Pointer Kinds Matrix** in spec (v0 frozen, v1 draft):
  - kind string
  - required fields
  - optional fields
  - deterministic byte reconstruction algorithm
  - failure semantics
- Add a compatibility table mapping legacy aliases to canonical names.
- Add deprecation windows and explicit sunset dates for old names in tooling.

### Outcome
A third-party client can implement Ledger Scrolls without reverse-engineering repo history.

---

## 2) Define “immutability classes” explicitly

### Why this matters
“Fully on-chain immutable media” must be precise about what is immutable:
- bytes,
- pointer,
- name-to-pointer mapping,
- or canonical head selection.

### Recommendation
Document and enforce 3 classes:
- **Class A**: Immutable bytes + immutable pointer (e.g., locked datum UTxO).
- **Class B**: Immutable bytes + mutable name routing (registry heads).
- **Class C**: Mutable mirrors with immutable checksum commitment.

Require each registry entry to declare immutability class.

### Outcome
Users understand exactly what guarantee they receive when loading a scroll.

---

## 3) Add mandatory “trust profile” metadata for every viewer mode

### Why this matters
A user’s trust surface changes based on data source (Koios, Blockfrost, local node, P2P). That should be explicit in UX and docs.

### Recommendation
Every client mode should output a standard trust profile block:
- Data source(s)
- Proof model (indexer trust vs chain witness)
- Hash verification scope
- Failure behavior

### Outcome
Strong transparency without sacrificing usability.

---

## 4) Build conformance tests as the protocol contract

### Why this matters
Specs and implementations drift unless there is a shared test corpus.

### Recommendation
Create `conformance/` fixtures with:
- canonical heads/lists/entries
- valid and invalid pointer examples
- compressed + uncompressed payload vectors
- expected resolved bytes SHA-256

Run in CI for JS viewer + Python tooling.

### Outcome
Protocol reliability scales beyond current maintainers.

---

## High-Value Recommendations (P1)

## 5) Ship signed head verification (v1) with key rotation policy

- Define signature envelope format and canonicalization rules.
- Support multi-sig threshold signers for canonical line.
- Add `nextKeys`/rotation statement semantics.

This turns “canonical registry” governance from social convention into cryptographic policy.

## 6) Harden content safety boundary in web viewer

Even with hash-valid content, rendering HTML is a separate security domain.

- Default-render text/media safely.
- For HTML, render in sandboxed iframe with strict CSP and no script by default.
- Add “raw bytes only” mode for maximal safety.

## 7) Introduce deterministic packaging profile for large media

For page-based legacy data, define stable chunking profile:
- chunk size rules,
- ordering rules,
- compression profile,
- manifest canonical fields.

This avoids irreversible incompatibility between minting pipelines.

## 8) Formalize permanence SLOs and observability

Track:
- resolution success rate by scroll and provider,
- hash mismatch incidents,
- median reconstruction latency,
- provider divergence alerts.

Publish a public status page for credibility.

---

## Medium-Term Recommendations (P2)

## 9) Add registry anti-equivocation heuristics

For canonical lines, monitor for conflicting heads in overlapping slot windows and surface warnings.

## 10) Build migration guides between legacy and standard forms

Document deterministic migration path (legacy pages → standard datum where size allows) while preserving historical references.

## 11) Create archival replication playbook

Define how community operators can replicate canonical artifacts, verify hashes, and host mirror indexes without becoming trust bottlenecks.

---

## Suggested 90-Day Execution Plan

### Phase 1 (Weeks 1–3)
- Freeze pointer vocabulary and publish compatibility table.
- Add conformance fixture corpus skeleton.
- Add viewer trust-profile output block.

### Phase 2 (Weeks 4–7)
- Implement signed heads prototype with one keyset.
- Add strict HTML sandbox behavior.
- Add CI conformance checks across JS + Python paths.

### Phase 3 (Weeks 8–12)
- Launch observability dashboard and integrity incident runbook.
- Publish operator replication guide.
- Announce v1 candidate with migration guidance.

---

## “Do Not Break” Principles for Ledger Scrolls

1. **Hash verification is non-negotiable** before canonical render.
2. **Resolver behavior must be deterministic** given same trust anchors.
3. **Protocol naming stability beats convenience refactors**.
4. **Viewer ergonomics must not hide trust assumptions**.
5. **Forkability stays open; canonicality stays explicit**.

If these principles remain intact, Ledger Scrolls can credibly claim long-horizon permanence on Cardano while still evolving safely.
