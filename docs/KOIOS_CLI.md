# Koios CLI (Zero-Dependency)

```bash
python3 viewers/koios-cli/read_constitution.py           # Epoch 608 (current), preview
python3 viewers/koios-cli/read_constitution.py 541       # Epoch 541 (historical)
python3 viewers/koios-cli/read_constitution.py 608 --save
python3 viewers/koios-cli/read_constitution.py 608 --verify

python3 viewers/koios-cli/read_scroll.py --list
python3 viewers/koios-cli/read_scroll.py constitution-e608 --save
python3 viewers/koios-cli/read_scroll.py --all --save --output-dir ./downloads --json-report ./downloads/report.json
```

## Notes

- `read_scroll.py` verifies SHA-256 when expected hashes are provided in the built-in catalog.
- `--all` + `--save` is the easiest way to build a downloadable local bundle for sharing.
- You can switch Koios endpoint using `--koios` or `KOIOS_API`.
