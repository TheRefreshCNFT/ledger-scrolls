# Koios CLI (Zero-Dependency)

Zero‑dependency command‑line readers using Koios public REST.

## Constitution Reader

```bash
python3 read_constitution.py           # Epoch 608 (current), preview
python3 read_constitution.py 541       # Epoch 541 (historical)
python3 read_constitution.py 608 --save
python3 read_constitution.py 608 --verify
```

## Universal Scroll Reader

```bash
python3 read_scroll.py --list
python3 read_scroll.py constitution-e608 --save
python3 read_scroll.py hosky-png --save
python3 read_scroll.py architects-scroll --verify
```

## Faster Distribution / Downloadable Reader Workflow

Use the universal reader to fetch verified artifacts into a folder and generate a machine-readable report:

```bash
python3 read_scroll.py --all --save --output-dir ./downloads --json-report ./downloads/report.json
```

Useful options:

- `--koios <url>`: override Koios base URL (or set `KOIOS_API` env var)
- `--output-dir <dir>`: choose where files are written
- `--all`: process every known scroll in one run
- `--json-report <path>`: emit verification/download results for automation
