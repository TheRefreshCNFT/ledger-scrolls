/**
 * Ledger Scrolls v2.0 - Scroll Reconstruction Engine
 * 
 * Reconstructs scroll content from on-chain data.
 * Supports both Standard (locked UTxO) and Legacy (CIP-25 pages) scrolls.
 */

class ScrollReconstructor {
    constructor(client) {
        this.client = client;
        this.progressCallback = null;
        this.aborted = false;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    abort() {
        this.aborted = true;
    }

    _progress(message, percent = null) {
        if (this.progressCallback) {
            this.progressCallback(message, percent);
        }
    }

    /**
     * Reconstruct a scroll based on its type
     */
    async reconstruct(scroll) {
        this.aborted = false;

        if (scroll.type === window.ScrollLibrary.SCROLL_TYPES.STANDARD) {
            return this.reconstructStandard(scroll);
        } else if (scroll.type === window.ScrollLibrary.SCROLL_TYPES.LEGACY) {
            return this.reconstructLegacy(scroll);
        } else {
            throw new Error(`Unknown scroll type: ${scroll.type}`);
        }
    }

    /**
     * Reconstruct a Standard Scroll from locked UTxO datum
     */
    async reconstructStandard(scroll) {
        const pointer = scroll.pointer;
        
        this._progress('🔍 Querying locked UTxO...', 10);

        // Parse txin
        const [txHash, txIndexStr] = pointer.lock_txin.split('#');
        const txIndex = parseInt(txIndexStr);

        // Query the specific UTxO
        let utxo;
        try {
            utxo = await this.client.queryUtxoByTxIn(txHash, txIndex);
        } catch (e) {
            // Fallback: query all UTxOs at address and find it
            this._progress('📍 Querying lock address...', 15);
            const utxos = await this.client.queryUtxosAtAddress(pointer.lock_address);
            utxo = utxos.find(u => 
                u.tx_hash === txHash && u.output_index === txIndex
            );
        }

        if (!utxo) {
            throw new Error(`UTxO not found: ${pointer.lock_txin}`);
        }

        this._progress('✓ UTxO found, extracting datum...', 30);

        // Extract inline datum (fallback to direct UTxO query if missing)
        let inlineDatum = utxo.inline_datum;
        let datumHash = utxo.datum_hash;
        if (!inlineDatum) {
            const fresh = await this.client.queryUtxoByTxIn(txHash, txIndex);
            inlineDatum = fresh.inline_datum;
            datumHash = datumHash || fresh.datum_hash;
        }
        if (!inlineDatum && datumHash && this.client.queryDatumByHash) {
            const datumInfo = await this.client.queryDatumByHash(datumHash);
            inlineDatum = datumInfo?.value?.fields?.[0]?.bytes || datumInfo?.value?.bytes || datumInfo?.bytes || null;
        }
        if (!inlineDatum) {
            throw new Error('UTxO does not contain inline datum');
        }

        this._progress('📦 Decoding datum bytes...', 50);

        // Decode the datum to get raw bytes
        const hexData = this._extractBytesFromDatum(inlineDatum);
        
        this._progress('🔄 Converting to binary...', 70);
        
        let rawBytes = this._hexToBytes(hexData);

        // Decompress if needed
        if (pointer.codec === 'gzip') {
            this._progress('📂 Decompressing (gzip)...', 80);
            rawBytes = pako.inflate(rawBytes);
        }

        this._progress('🔐 Verifying integrity...', 90);

        // Verify hash if provided
        if (pointer.sha256) {
            const computedHash = await this._sha256(rawBytes);
            if (computedHash !== pointer.sha256.toLowerCase()) {
                throw new Error(`Hash mismatch!\nExpected: ${pointer.sha256}\nGot: ${computedHash}`);
            }
        }

        this._progress('✅ Reconstruction complete!', 100);

        return {
            data: rawBytes,
            contentType: pointer.content_type,
            size: rawBytes.length,
            hash: pointer.sha256 || await this._sha256(rawBytes),
            method: 'Standard Scroll (Locked UTxO)'
        };
    }

    /**
     * Reconstruct a Legacy Scroll from CIP-25 page NFTs
     */
    async reconstructLegacy(scroll) {
        const pointer = scroll.pointer;
        
        this._progress('🔍 Scanning policy assets...', 5);

        if (this.aborted) throw new Error('Aborted');

        // Get all assets under the policy
        const assets = await this.client.queryPolicyAssets(
            pointer.policy_id,
            (msg) => this._progress(msg, 10)
        );

        if (!assets || assets.length === 0) {
            throw new Error('No assets found under this policy');
        }

        this._progress(`✓ Found ${assets.length} assets, fetching metadata...`, 20);

        // Fetch metadata for each asset and find pages
        const pages = [];
        const total = assets.length;

        for (let i = 0; i < assets.length; i++) {
            if (this.aborted) throw new Error('Aborted');

            const asset = assets[i];
            const assetId = asset.asset || asset;
            const progress = 20 + Math.floor((i / total) * 50);
            
            this._progress(`📄 Processing asset ${i + 1}/${total}...`, progress);

            try {
                const assetNameHex = assetId.substring(56);
                const assetNameAscii = this._hexToAscii(assetNameHex);

                // Get asset info with on-chain metadata
                const assetInfo = await this.client.queryAssetInfo(assetId);
                
                // Try to find metadata
                let meta = assetInfo.onchain_metadata;
                
                // If not found directly, try fetching from mint tx
                if (!meta && assetInfo.initial_mint_tx_hash) {
                    // Check asset history for latest mint
                    const history = await this.client.queryAssetHistory(assetId);
                    const latestMint = history.find(h => h.action === 'minted');
                    const mintTx = latestMint?.tx_hash || assetInfo.initial_mint_tx_hash;
                    
                    if (mintTx) {
                        const txMeta = await this.client.queryTxMetadata(mintTx);
                        // CIP-25 metadata is under label 721
                        const cip25 = txMeta.find(m => m.label === '721');
                        if (cip25) {
                            const policyMeta = cip25.json_metadata?.[pointer.policy_id];
                            if (policyMeta) {
                                // Find the asset in the policy metadata
                                meta = policyMeta[assetNameAscii] || policyMeta[assetNameHex];
                            }
                        }
                    }
                }

                if (!meta) continue;

                // Check if this is a manifest (skip it)
                const isManifest = (
                    meta.role === 'manifest' ||
                    assetId.toLowerCase().includes('manifest') ||
                    (meta.pages && Array.isArray(meta.pages))
                );
                if (isManifest) continue;

                // Check if this is a page with payload and index
                if (meta.payload !== undefined && meta.i !== undefined) {
                    // If manifest_asset provided, filter pages to matching prefix
                    if (pointer.manifest_asset) {
                        const pagePrefix = pointer.manifest_asset.replace(/_MANIFEST$/i, '_PAGE');
                        const assetName = assetNameAscii;
                        if (!assetName || !assetName.startsWith(pagePrefix)) {
                            continue;
                        }
                    }
                    pages.push({
                        index: parseInt(meta.i),
                        payload: meta.payload,
                        assetId: assetId
                    });
                }

            } catch (e) {
                console.warn(`Failed to process asset ${assetId}:`, e);
                continue;
            }
        }

        if (pages.length === 0) {
            throw new Error('No page NFTs found with payload and index fields');
        }

        this._progress(`✓ Found ${pages.length} pages, reconstructing...`, 75);

        // Sort pages by index
        pages.sort((a, b) => a.index - b.index);

        // Concatenate all payloads
        this._progress('🔗 Concatenating page payloads...', 80);
        
        let allHex = '';
        for (const page of pages) {
            const pageHex = this._extractPayloadHex(page.payload);
            allHex += pageHex;
        }

        this._progress('🔄 Converting to binary...', 85);
        
        let rawBytes = this._hexToBytes(allHex);

        // Auto-detect gzip or use specified codec
        const isGzipped = rawBytes.length >= 2 && rawBytes[0] === 0x1f && rawBytes[1] === 0x8b;
        
        if (pointer.codec === 'gzip' || (pointer.codec === 'auto' && isGzipped)) {
            this._progress('📂 Decompressing (gzip detected)...', 90);
            try {
                rawBytes = pako.inflate(rawBytes);
            } catch (e) {
                console.warn('Decompression failed, using raw bytes:', e);
            }
        }

        // Auto-detect content type if HTML
        let contentType = pointer.content_type;
        const textPreview = new TextDecoder().decode(rawBytes.slice(0, 100)).toLowerCase();
        if (textPreview.includes('<!doctype') || textPreview.includes('<html')) {
            contentType = 'text/html';
        }

        this._progress('🔐 Computing integrity hash...', 95);

        const hash = await this._sha256(rawBytes);

        // Verify hash if provided
        if (pointer.sha256_original) {
            if (hash !== pointer.sha256_original.toLowerCase()) {
                console.warn(`Hash mismatch!\nExpected: ${pointer.sha256_original}\nGot: ${hash}`);
            }
        }

        this._progress('✅ Reconstruction complete!', 100);

        return {
            data: rawBytes,
            contentType: contentType,
            size: rawBytes.length,
            hash: hash,
            pages: pages.length,
            method: 'Legacy Scroll (CIP-25 Pages)'
        };
    }

    /**
     * Extract hex bytes from inline datum (handles CBOR encoding)
     */
    _extractBytesFromDatum(datum) {
        // If it's a hex string (CBOR encoded from Blockfrost)
        if (typeof datum === 'string') {
            try {
                // Decode CBOR
                const cborBytes = this._hexToBytes(datum);
                const decoded = CBOR.decode(cborBytes.buffer);
                
                // Handle Plutus data structure: [constructor, [fields...]]
                if (Array.isArray(decoded) && decoded.length >= 2) {
                    const fields = decoded[1];
                    if (Array.isArray(fields) && fields.length > 0) {
                        const firstField = fields[0];
                        if (firstField instanceof Uint8Array) {
                            return this._bytesToHex(firstField);
                        } else if (typeof firstField === 'string') {
                            return firstField;
                        }
                    }
                }
                
                // Direct bytes
                if (decoded instanceof Uint8Array) {
                    return this._bytesToHex(decoded);
                }
                
                throw new Error('Unexpected CBOR datum structure');
            } catch (e) {
                // Maybe it's not CBOR, try as raw hex
                console.warn('CBOR decode failed, trying raw hex:', e);
                return datum;
            }
        }

        // Koios datum_info style objects and already-parsed dicts
        if (typeof datum === 'object' && datum !== null) {
            if (datum.bytes) return datum.bytes;
            if (datum.value?.fields?.[0]?.bytes) return datum.value.fields[0].bytes;
            if (datum.value?.bytes) return datum.value.bytes;
            if (datum.fields && Array.isArray(datum.fields)) {
                const bytesField = datum.fields[0]?.bytes;
                if (bytesField) return bytesField;
            }
        }
        
        throw new Error(`Cannot extract bytes from datum: ${typeof datum}`);
    }

    /**
     * Extract hex from payload (handles various CIP-25 formats)
     */
    _extractPayloadHex(payload) {
        let hex = '';
        
        if (Array.isArray(payload)) {
            for (const entry of payload) {
                if (typeof entry === 'object' && entry.bytes) {
                    hex += entry.bytes.replace(/^0x/i, '');
                } else if (typeof entry === 'string') {
                    hex += entry.replace(/^0x/i, '');
                }
            }
        } else if (typeof payload === 'string') {
            hex = payload.replace(/^0x/i, '');
        }
        
        // Clean up any whitespace
        return hex.replace(/\s/g, '');
    }

    /**
     * Convert hex string to Uint8Array
     */
    _hexToBytes(hex) {
        // Remove 0x prefix and any whitespace
        hex = hex.replace(/^0x/i, '').replace(/\s/g, '');
        
        // Ensure even length
        if (hex.length % 2 !== 0) {
            throw new Error(`Invalid hex string length: ${hex.length}`);
        }
        
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    /**
     * Convert Uint8Array to hex string
     */
    _bytesToHex(bytes) {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Convert hex to ASCII
     */
    _hexToAscii(hex) {
        let str = '';
        for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return str;
    }

    /**
     * Compute SHA-256 hash
     */
    async _sha256(data) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

// Export for use in other modules
window.ScrollReconstructor = ScrollReconstructor;
