import * as CBOR from 'cbor-web';
import { SCROLL_TYPES, REGISTRY } from './scrolls.js';

export class RegistryResolver {
    constructor() {
        this._headTxIn = REGISTRY.public_head_txin;
    }

    // Main entry point: returns discovered scroll array (empty on failure)
    async resolve(client) {
        try {
            const headData = await this._fetchHead(client);
            const listData = await this._fetchRegistryList(client, headData);
            if (!listData || !Array.isArray(listData.entries)) {
                console.warn('[Registry] No entries array in registry list');
                return [];
            }
            const discovered = [];
            for (const entry of listData.entries) {
                try {
                    const scroll = this._entryToScroll(entry);
                    if (scroll) discovered.push(scroll);
                } catch (e) {
                    console.warn(`[Registry] Skipping entry "${entry.name}":`, e.message);
                }
            }
            return discovered;
        } catch (e) {
            console.warn('[Registry] Resolution failed (graceful degradation):', e.message);
            return [];
        }
    }

    // Merge discovered scrolls with hardcoded list; hardcoded takes precedence on id collision
    mergeScrolls(discovered, hardcoded) {
        const hardcodedIds = new Set(hardcoded.map(s => s.id));
        const merged = [...hardcoded];
        for (const scroll of discovered) {
            if (!hardcodedIds.has(scroll.id)) {
                merged.push(scroll);
            }
        }
        return merged;
    }

    async _fetchHead(client) {
        const [txHash, txIndexStr] = this._headTxIn.split('#');
        const txIndex = parseInt(txIndexStr, 10);
        const utxo = await client.queryUtxoByTxIn(txHash, txIndex);
        if (!utxo || !utxo.inline_datum) {
            throw new Error(`Head UTxO has no inline datum: ${this._headTxIn}`);
        }
        const json = this._datumToJson(utxo.inline_datum);
        if (json.format !== 'ledger-scrolls-registry-head') {
            throw new Error(`Unexpected head format: ${json.format}`);
        }
        return json;
    }

    async _fetchRegistryList(client, headData) {
        const ptr = headData.registryList;
        if (!ptr || !ptr.kind) throw new Error('Head has no registryList pointer');

        if (ptr.kind === 'url') {
            const resp = await fetch(ptr.url);
            if (!resp.ok) throw new Error(`Failed to fetch registry list from URL: ${ptr.url} (${resp.status})`);
            return resp.json();
        }

        if (ptr.kind === 'utxo-inline-datum-bytes-v1') {
            const utxo = await client.queryUtxoByTxIn(ptr.txHash, ptr.txIx);
            if (!utxo || !utxo.inline_datum) {
                throw new Error(`Registry list UTxO has no inline datum: ${ptr.txHash}#${ptr.txIx}`);
            }
            return this._datumToJson(utxo.inline_datum);
        }

        throw new Error(`Unsupported registryList pointer kind: ${ptr.kind}`);
    }

    _entryToScroll(entry) {
        if (!entry.name || !entry.pointer) return null;

        const type = this._mapPointerKind(entry.pointer.kind);
        if (!type) return null; // url pointers not renderable by current pipeline

        return {
            id: entry.name,
            title: entry.description || this._toTitleCase(entry.name),
            description: entry.description || '',
            icon: this._iconForContentType(entry.contentType),
            category: this._categoryForContentType(entry.contentType),
            type,
            pointer: this._mapPointerFields(entry.pointer, entry),
            metadata: {
                size: entry.sizeBytes ? this._formatSize(entry.sizeBytes) : null,
                sha256: entry.sha256 || null,
                source: 'registry',
                registeredAt: entry.createdAt || null
            }
        };
    }

    // Parse inline datum (CBOR hex or object) → JSON object
    _datumToJson(datum) {
        if (typeof datum === 'string') {
            // Try CBOR decode: inline_datum is hex CBOR PlutusData wrapping bytes
            try {
                const cborBytes = this._hexToBytes(datum);
                const decoded = CBOR.decode(cborBytes.buffer);

                let rawBytes = null;

                // PlutusData constructor tag: [tag, [field0, ...]]
                if (Array.isArray(decoded) && decoded.length >= 2) {
                    const fields = decoded[1];
                    if (Array.isArray(fields) && fields.length > 0) {
                        const first = fields[0];
                        if (first instanceof Uint8Array) rawBytes = first;
                    }
                }

                if (!rawBytes && decoded instanceof Uint8Array) rawBytes = decoded;

                if (rawBytes) {
                    return JSON.parse(new TextDecoder().decode(rawBytes));
                }
            } catch (_) { /* fall through */ }

            // Maybe the bytes are just hex-encoded UTF-8 JSON (no CBOR wrapper)
            try {
                const bytes = this._hexToBytes(datum);
                return JSON.parse(new TextDecoder().decode(bytes));
            } catch (_) { /* fall through */ }

            // Maybe it's a raw JSON string
            return JSON.parse(datum);
        }

        // Object datum formats (Blockfrost style)
        if (typeof datum === 'object' && datum !== null) {
            let hexStr = null;
            if (datum.bytes) hexStr = datum.bytes;
            else if (datum.value?.fields?.[0]?.bytes) hexStr = datum.value.fields[0].bytes;
            else if (datum.value?.bytes) hexStr = datum.value.bytes;
            else if (datum.fields?.[0]?.bytes) hexStr = datum.fields[0].bytes;

            if (hexStr) {
                const bytes = this._hexToBytes(hexStr);
                return JSON.parse(new TextDecoder().decode(bytes));
            }
        }

        throw new Error(`Cannot parse datum as JSON: ${typeof datum}`);
    }

    _mapPointerKind(kind) {
        if (kind === 'utxo-inline-datum-bytes-v1') return SCROLL_TYPES.STANDARD;
        if (kind === 'cip25-pages-v1') return SCROLL_TYPES.LEGACY;
        return null;
    }

    _mapPointerFields(pointer, entry) {
        if (pointer.kind === 'utxo-inline-datum-bytes-v1') {
            return {
                lock_address: null,
                lock_txin: `${pointer.txHash}#${pointer.txIx}`,
                content_type: entry.contentType || 'application/octet-stream',
                codec: 'none',
                sha256: entry.sha256 || null
            };
        }
        if (pointer.kind === 'cip25-pages-v1') {
            return {
                policy_id: pointer.policyId,
                manifest_asset_name: pointer.manifestAsset,
                manifest_tx_hash: pointer.manifestTx || null,
                manifest_slot: pointer.manifestSlot != null ? String(pointer.manifestSlot) : null,
                content_type: entry.contentType || 'application/octet-stream',
                codec: 'none',
                sha256_original: entry.sha256 || null
            };
        }
        return {};
    }

    _toTitleCase(name) {
        return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    _iconForContentType(contentType) {
        if (!contentType) return '📜';
        if (contentType.startsWith('image/')) return '🖼️';
        if (contentType.startsWith('video/')) return '🎬';
        if (contentType === 'text/html' || contentType === 'application/pdf') return '📄';
        return '📜';
    }

    _categoryForContentType(contentType) {
        if (!contentType) return 'historical';
        if (contentType.startsWith('image/')) return 'images';
        if (contentType === 'text/html' || contentType === 'application/pdf') return 'documents';
        return 'historical';
    }

    _formatSize(bytes) {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)}KB`;
        return `~${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    _hexToBytes(hex) {
        hex = hex.replace(/^0x/i, '').replace(/\s/g, '');
        if (hex.length % 2 !== 0) throw new Error(`Invalid hex length: ${hex.length}`);
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
}
