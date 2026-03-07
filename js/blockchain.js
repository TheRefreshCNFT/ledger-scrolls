/**
 * Ledger Scrolls v2.0 - Blockchain Clients
 * 
 * Provides abstracted access to Cardano blockchain data.
 * Supports multiple backends:
 * - Blockfrost API (requires API key)
 * - Koios API (free, no key required)
 */

class BlockchainClient {
    constructor(mode = 'blockfrost', apiKey = null, koiosProxy = '') {
        this.mode = mode;
        this.apiKey = apiKey;
        this.koiosProxy = koiosProxy;
        this.baseUrl = this._getBaseUrl();
        this.koiosBaseUrls = [
            'https://api.koios.rest/api/v1',
            'https://koios.beacnpool.org/api/v1'
        ];
        this.rateLimitDelay = 100; // ms between requests
        this.lastRequest = 0;
    }

    _getBaseUrl() {
        switch (this.mode) {
            case 'blockfrost':
                return 'https://cardano-mainnet.blockfrost.io/api/v0';
            case 'blockfrost-preview':
                return 'https://cardano-preview.blockfrost.io/api/v0';
            case 'koios':
                return 'https://api.koios.rest/api/v1';
            default:
                throw new Error(`Unknown mode: ${this.mode}`);
        }
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    setMode(mode) {
        this.mode = mode;
        this.baseUrl = this._getBaseUrl();
    }

    setKoiosProxy(proxy) {
        this.koiosProxy = proxy || '';
    }

    async _rateLimitedFetch(url, options = {}, retries = 0) {
        // Enforce rate limiting
        const now = Date.now();
        const elapsed = now - this.lastRequest;
        if (elapsed < this.rateLimitDelay) {
            await new Promise(r => setTimeout(r, this.rateLimitDelay - elapsed));
        }
        this.lastRequest = Date.now();

        const response = await fetch(url, options);
        
        if (response.status === 429) {
            // Rate limited - wait and retry (max 5 retries)
            if (retries >= 5) throw new Error('Rate limit exceeded after 5 retries');
            const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            return this._rateLimitedFetch(url, options, retries + 1);
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
    }

    async _request(endpoint, options = {}) {
        const headers = { ...options.headers };

        if (this.mode.startsWith('blockfrost')) {
            const url = `${this.baseUrl}${endpoint}`;
            if (this.apiKey) {
                headers['project_id'] = this.apiKey;
            }
            return this._rateLimitedFetch(url, { ...options, headers });
        }

        if (this.mode === 'koios') {
            return this._requestKoiosWithFallback(endpoint, options, headers);
        }

        const url = `${this.baseUrl}${endpoint}`;
        return this._rateLimitedFetch(url, { ...options, headers });
    }

    async _requestKoiosWithFallback(endpoint, options = {}, headers = {}) {
        const errors = [];
        const bases = [...this.koiosBaseUrls];
        if (this.koiosProxy) {
            const trimmed = this.koiosProxy.replace(/\/$/, '');
            const withApi = trimmed.includes('/api') ? trimmed : `${trimmed}/api/v1`;
            if (!bases.includes(trimmed)) bases.unshift(trimmed);
            if (!bases.includes(withApi)) bases.unshift(withApi);
        }

        for (const base of bases) {
            try {
                const url = `${base}${endpoint}`;
                const resp = await this._rateLimitedFetch(url, {
                    ...options,
                    headers,
                    mode: 'cors',
                    credentials: 'omit'
                });
                this.baseUrl = base;
                return resp;
            } catch (e) {
                errors.push({ base, message: e.message || String(e) });
            }
        }
        throw new Error(`Koios request failed: ${errors.map(e => `${e.base} -> ${e.message}`).join(' | ')}`);
    }

    /**
     * Query UTxOs at an address
     */
    async queryUtxosAtAddress(address) {
        if (this.mode.startsWith('blockfrost')) {
            return this._blockfrostQueryUtxos(address);
        } else if (this.mode === 'koios') {
            return this._koiosQueryUtxos(address);
        }
    }

    async _blockfrostQueryUtxos(address) {
        const utxos = [];
        let page = 1;

        while (true) {
            try {
                const batch = await this._request(`/addresses/${address}/utxos?page=${page}`);
                if (!batch || batch.length === 0) break;
                utxos.push(...batch);
                if (batch.length < 100) break;
                page++;
            } catch (e) {
                if (e.message.includes('404')) break;
                throw e;
            }
        }

        return utxos;
    }

    async _koiosQueryUtxos(address) {
        const response = await this._request('/address_utxos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _addresses: [address] })
        });

        // Convert to Blockfrost-like format
        return response.map(u => ({
            tx_hash: u.tx_hash,
            tx_index: u.tx_index,
            output_index: u.tx_index,
            amount: u.value ? [
                { unit: 'lovelace', quantity: u.value },
                ...(u.asset_list || []).map(a => ({
                    unit: a.policy_id + a.asset_name,
                    quantity: a.quantity
                }))
            ] : [],
            inline_datum: u.inline_datum?.bytes || null,
            address: address
        }));
    }

    /**
     * Query specific UTxO by txin
     */
    async queryUtxoByTxIn(txHash, txIndex) {
        if (this.mode.startsWith('blockfrost')) {
            const response = await this._request(`/txs/${txHash}/utxos`);
            const utxo = response.outputs?.find(o => o.output_index === txIndex);
            if (!utxo) throw new Error(`UTxO not found: ${txHash}#${txIndex}`);
            return {
                ...utxo,
                tx_hash: txHash,
                tx_index: txIndex
            };
        } else if (this.mode === 'koios') {
            const response = await this._request('/utxo_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _utxo_refs: [`${txHash}#${txIndex}`] })
            });
            if (!response || response.length === 0) {
                throw new Error(`UTxO not found: ${txHash}#${txIndex}`);
            }
            return {
                tx_hash: txHash,
                tx_index: txIndex,
                output_index: txIndex,
                inline_datum: response[0].inline_datum?.bytes || null,
                datum_hash: response[0].datum_hash || null,
                amount: response[0].value ? [
                    { unit: 'lovelace', quantity: response[0].value }
                ] : []
            };
        }
    }

    /**
     * Query datum by hash (Koios)
     */
    async queryDatumByHash(datumHash) {
        if (this.mode !== 'koios') {
            throw new Error('datum_info is only supported in Koios mode');
        }
        const response = await this._request('/datum_info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _datum_hashes: [datumHash] })
        });
        if (!response || response.length === 0) {
            throw new Error(`Datum not found: ${datumHash}`);
        }
        return response[0];
    }

    /**
     * Query transaction metadata
     */
    async queryTxMetadata(txHash) {
        if (this.mode.startsWith('blockfrost')) {
            try {
                return await this._request(`/txs/${txHash}/metadata`);
            } catch (e) {
                if (e.message.includes('404')) return [];
                throw e;
            }
        } else if (this.mode === 'koios') {
            const response = await this._request('/tx_metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _tx_hashes: [txHash] })
            });
            return response?.[0]?.metadata || [];
        }
    }

    /**
     * Query all assets under a policy
     */
    async queryPolicyAssets(policyId, progressCallback = null) {
        if (this.mode.startsWith('blockfrost')) {
            return this._blockfrostQueryPolicyAssets(policyId, progressCallback);
        } else if (this.mode === 'koios') {
            return this._koiosQueryPolicyAssets(policyId, progressCallback);
        }
    }

    async _blockfrostQueryPolicyAssets(policyId, progressCallback) {
        const assets = [];
        let page = 1;

        while (true) {
            if (progressCallback) {
                progressCallback(`Scanning policy assets (page ${page})...`);
            }

            try {
                const batch = await this._request(`/assets/policy/${policyId}?page=${page}`);
                if (!batch || batch.length === 0) break;
                assets.push(...batch);
                if (batch.length < 100) break;
                page++;
            } catch (e) {
                if (e.message.includes('404')) break;
                throw e;
            }
        }

        return assets;
    }

    async _koiosQueryPolicyAssets(policyId, progressCallback) {
        if (progressCallback) {
            progressCallback('Querying policy assets...');
        }

        const assets = [];
        let offset = 0;
        const limit = 1000;

        while (true) {
            const response = await this._request(
                `/asset_list?policy_id=eq.${policyId}&limit=${limit}&offset=${offset}`
            );
            if (!response || response.length === 0) break;
            assets.push(...response.map(a => {
                const assetName = a.asset_name ?? '';
                return {
                    asset: policyId + assetName,
                    asset_name: assetName,
                    quantity: 1
                };
            }));
            if (response.length < limit) break;
            offset += limit;
        }

        return assets;
    }

    /**
     * Query asset info including on-chain metadata
     */
    async queryAssetInfo(assetId) {
        if (this.mode.startsWith('blockfrost')) {
            return this._request(`/assets/${assetId}`);
        } else if (this.mode === 'koios') {
            // Extract policy and asset name
            const policyId = assetId.substring(0, 56);
            const assetName = assetId.substring(56);

            const response = await this._request('/asset_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _asset_list: [[policyId, assetName]] })
            });

            if (!response || response.length === 0) {
                throw new Error(`Asset not found: ${assetId}`);
            }

            const asset = response[0];
            return {
                asset: assetId,
                asset_name: assetName,
                policy_id: policyId,
                onchain_metadata: asset.minting_tx_metadata?.[721]?.[policyId]?.[asset.asset_name_ascii] || null,
                initial_mint_tx_hash: asset.creation_time ? null : asset.minting_tx_hash
            };
        }
    }

    /**
     * Query asset history to find latest mint
     */
    async queryAssetHistory(assetId, limit = 10) {
        if (this.mode.startsWith('blockfrost')) {
            try {
                return await this._request(`/assets/${assetId}/history?order=desc&count=${limit}`);
            } catch (e) {
                if (e.message.includes('404')) return [];
                throw e;
            }
        } else if (this.mode === 'koios') {
            // Koios doesn't have direct asset history, use different approach
            const policyId = assetId.substring(0, 56);
            const assetName = assetId.substring(56);

            const response = await this._request('/asset_history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _asset_policy: policyId, _asset_name: assetName })
            });

            return (response || []).slice(0, limit).map(h => ({
                tx_hash: h.minting_txs?.[0]?.tx_hash,
                action: h.minting_txs?.[0]?.quantity > 0 ? 'minted' : 'burned'
            }));
        }
    }

    /**
     * Test connection and API key validity
     */
    async testConnection() {
        try {
            if (this.mode.startsWith('blockfrost')) {
                await this._request('/health');
            } else if (this.mode === 'koios') {
                const registryAddress = 'addr1q9x84f458uyf3k23sr7qfalg3mw2hl0nvv4navps2r7vq69esnxrheg9tfpr8sdyfzpr8jch5p538xjynz78lql9wm6qpl6qxy';
                await this._request('/address_utxos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ _addresses: [registryAddress] })
                });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Get current blockchain tip
     */
    async getTip() {
        if (this.mode.startsWith('blockfrost')) {
            return this._request('/blocks/latest');
        } else if (this.mode === 'koios') {
            const response = await this._request('/tip');
            return response?.[0] || null;
        }
    }

    // =========================================================================
    // Registry (Head → List)
    // =========================================================================

    async _getInlineDatumHexByTxIn(txHash, txIx) {
        // Koios-first: utxo_info sometimes returns inline_datum=null but provides datum_hash.
        try {
            const utxo = await this.queryUtxoByTxIn(txHash, txIx);
            if (utxo?.inline_datum) return utxo.inline_datum;

            // Koios datum fallback
            const dh = utxo?.datum_hash;
            if (dh && this.queryDatumByHash) {
                const datumInfo = await this.queryDatumByHash(dh);
                // Koios datum_info commonly returns either value.bytes (decoded bytes hex) or bytes (datum CBOR hex)
                const bytesHex = datumInfo?.value?.bytes || datumInfo?.value?.fields?.[0]?.bytes || datumInfo?.bytes || null;
                if (bytesHex) return bytesHex;
            }
        } catch (e) {
            // continue
        }

        // Optional Blockfrost fallback: only if user provided an API key.
        // We do not switch modes in the UI; this is a failover path.
        if (this.apiKey) {
            try {
                const response = await this._rateLimitedFetch(`https://cardano-mainnet.blockfrost.io/api/v0/txs/${txHash}/utxos`, {
                    headers: { project_id: this.apiKey }
                });
                const out = (response.outputs || []).find(o => o.output_index === txIx);
                const inline = out?.inline_datum;
                if (inline) return inline;
                const datumHash = out?.data_hash || out?.datum_hash;
                if (datumHash) {
                    const d = await this._rateLimitedFetch(`https://cardano-mainnet.blockfrost.io/api/v0/scripts/datum/${datumHash}/cbor`, {
                        headers: { project_id: this.apiKey }
                    });
                    if (d?.cbor) return d.cbor;
                }
            } catch (e) {
                // ignore
            }
        }

        throw new Error(`Inline datum not found for ${txHash}#${txIx}`);
    }

    _decodeRegistryDatumToJson(inlineDatumHex) {
        // inlineDatumHex is hex of datum bytes.
        const bytes = this._hexToBytes(inlineDatumHex);

        // Our registry datum is CBOR that decodes to a bytestring (JSON UTF-8).
        // If CBOR decode fails, assume raw JSON bytes.
        let payloadBytes = bytes;
        try {
            const decoded = CBOR.decode(bytes.buffer);
            if (decoded instanceof Uint8Array) payloadBytes = decoded;
        } catch {
            // ignore
        }

        const text = new TextDecoder('utf-8', { fatal: false }).decode(payloadBytes);
        return JSON.parse(text);
    }

    async loadRegistryMerged({ headTxIn, privateHeads = [] }, progressCb = null) {
        const bump = (msg, pct) => { if (progressCb) progressCb(msg, pct); };

        const [headHash, headIxStr] = headTxIn.split('#');
        const headIx = parseInt(headIxStr, 10);

        bump('Fetching public head datum (Koios)...', 10);
        const headDatumHex = await this._getInlineDatumHexByTxIn(headHash, headIx);
        const headObj = this._decodeRegistryDatumToJson(headDatumHex);

        if (headObj.format !== 'ledger-scrolls-registry-head') {
            throw new Error('Head datum format mismatch');
        }

        const listPtr = headObj.registryList;
        if (!listPtr || listPtr.kind !== 'utxo-inline-datum-bytes-v1') {
            throw new Error('Head registryList pointer missing/unsupported');
        }

        bump('Fetching public list datum...', 25);
        const listDatumHex = await this._getInlineDatumHexByTxIn(listPtr.txHash, parseInt(listPtr.txIx, 10));
        let merged = this._decodeRegistryDatumToJson(listDatumHex);

        if (merged.format !== 'ledger-scrolls-registry-list') {
            throw new Error('List datum format mismatch');
        }

        // Merge private heads (override)
        const priv = Array.isArray(privateHeads) ? privateHeads : [];
        for (let i = 0; i < priv.length; i++) {
            const txin = priv[i];
            bump(`Fetching private head ${i + 1}/${priv.length}...`, 40 + Math.floor((i / Math.max(1, priv.length)) * 30));

            const [ph, pixStr] = txin.split('#');
            const pix = parseInt(pixStr, 10);
            const pd = await this._getInlineDatumHexByTxIn(ph, pix);
            const pobj = this._decodeRegistryDatumToJson(pd);
            const pptr = pobj.registryList;
            const pListHex = await this._getInlineDatumHexByTxIn(pptr.txHash, parseInt(pptr.txIx, 10));
            const plist = this._decodeRegistryDatumToJson(pListHex);

            merged = this._mergeRegistryLists(merged, plist);
        }

        bump('Registry merged.', 80);
        return merged;
    }

    _mergeRegistryLists(base, extra) {
        const out = { ...base };
        const baseEntries = Array.isArray(base.entries) ? base.entries : [];
        const extraEntries = Array.isArray(extra.entries) ? extra.entries : [];

        const map = new Map();
        const order = [];

        for (const e of baseEntries) {
            if (!e?.name) continue;
            if (!map.has(e.name)) order.push(e.name);
            map.set(e.name, e);
        }
        for (const e of extraEntries) {
            if (!e?.name) continue;
            if (!map.has(e.name)) order.push(e.name);
            map.set(e.name, e); // override
        }

        out.entries = order.map(n => map.get(n));
        return out;
    }

    registryToScrolls(registryListObj) {
        const entries = Array.isArray(registryListObj?.entries) ? registryListObj.entries : [];
        const out = [];

        for (const e of entries) {
            if (!e?.name || !e.pointer) continue;
            const p = e.pointer;

            // Map registry entry → web viewer ScrollLibrary shape
            if (p.kind === 'utxo-inline-datum-bytes-v1') {
                out.push({
                    id: e.name,
                    title: e.name,
                    description: e.description || 'Registry entry',
                    icon: '📜',
                    category: 'all',
                    type: window.ScrollLibrary.SCROLL_TYPES.STANDARD,
                    pointer: {
                        lock_address: e.lockAddress || '',
                        lock_txin: `${p.txHash}#${p.txIx}`,
                        content_type: e.contentType || e.content_type || 'application/octet-stream',
                        codec: e.codec || 'none',
                        sha256: e.sha256 || null
                    },
                    metadata: { source: 'registry' }
                });
                continue;
            }

            if (p.kind === 'cip25-pages-v1') {
                out.push({
                    id: e.name,
                    title: e.name,
                    description: e.description || 'Registry entry',
                    icon: '📜',
                    category: 'all',
                    type: window.ScrollLibrary.SCROLL_TYPES.LEGACY,
                    pointer: {
                        policy_id: p.policyId,
                        manifest_asset: p.manifestAsset,
                        content_type: e.contentType || 'application/octet-stream',
                        codec: e.codec || 'auto',
                        sha256_original: e.sha256 || null
                    },
                    metadata: { source: 'registry' }
                });
                continue;
            }
        }

        return out;
    }

    _hexToBytes(hex) {
        hex = String(hex || '').replace(/^0x/i, '').replace(/\s/g, '');
        if (hex.length % 2 !== 0) throw new Error('Invalid hex');
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
        }
        return bytes;
    }
}

// Export for use in other modules
window.BlockchainClient = BlockchainClient;
