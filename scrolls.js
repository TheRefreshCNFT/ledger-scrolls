/**
 * Ledger Scrolls v2.0 - Scroll Definitions
 * 
 * This file contains all known scrolls in the library.
 * Scrolls are immutable documents stored on the Cardano blockchain.
 * 
 * Two storage types are supported:
 * - STANDARD: Small files stored in locked UTxO inline datums
 * - LEGACY: Large documents split into page NFTs with CIP-25 metadata
 */

const SCROLL_TYPES = {
    STANDARD: 'utxo_datum_bytes_v1',
    LEGACY: 'cip25_pages_v1'
};

const CATEGORIES = {
    ALL: { id: 'all', name: 'All Scrolls', icon: '📚' },
    IMAGES: { id: 'images', name: 'Images', icon: '🖼️' },
    DOCUMENTS: { id: 'documents', name: 'Documents', icon: '📄' },
    GOVERNANCE: { id: 'governance', name: 'Governance', icon: '⚖️' },
    HISTORICAL: { id: 'historical', name: 'Historical', icon: '📜' },
    PHILOSOPHICAL: { id: 'philosophical', name: 'Philosophical', icon: '🔮' },
    VAULT: { id: 'vault', name: 'Vault', icon: '🔒' }
};

/**
 * The Scroll Library - On-Chain Scrolls Only
 */
const SCROLLS = [
    // =========================================================================
    // GOVERNANCE SCROLLS
    // =========================================================================
    {
        id: 'constitution-e608',
        title: 'Constitution (E608)',
        description: 'The current Cardano Constitution, ratified at Epoch 608. The governance framework for the Cardano blockchain.',
        icon: '⚖️',
        category: 'governance',
        type: SCROLL_TYPES.LEGACY,
        pointer: {
            policy_id: 'ef91a425ef57d92db614085ef03718407fb293cb4b770bc6e03f9750',
            manifest_asset_name: 'CONSTITUTION_E608_MANIFEST',
            content_type: 'text/plain; charset=utf-8',
            codec: 'gzip',
            sha256_gzip: '4565368ca35d8c6bb08bff712c1b22c0afe300c19292d5aa09c812ed415a4e93',
            sha256_original: '98a29aec8664b62912c1c0355ebae1401b7c0e53d632e8f05479e7821935abf1'
        },
        metadata: {
            size: '~67KB',
            pages: 11,
            ratified: 'Epoch 608',
            enacted: 'Epoch 609',
            status: 'Current'
        }
    },
    {
        id: 'constitution-e541',
        title: 'Constitution (E541)',
        description: 'The original Cardano Constitution, ratified at Epoch 541. Historical governance document.',
        icon: '📜',
        category: 'governance',
        type: SCROLL_TYPES.LEGACY,
        pointer: {
            policy_id: 'd7559bbfa87f53674570fd01f564687c2954503b510ead009148a31d',
            manifest_asset_name: 'CONSTITUTION_E541_MANIFEST',
            content_type: 'text/plain; charset=utf-8',
            codec: 'gzip',
            sha256_gzip: '975d1c6bb1c8bf4982c58e41c9b137ecd4272e34095a5ec9b37bdde5ca6f268a',
            sha256_original: '1939c1627e49b5267114cbdb195d4ac417e545544ba6dcb47e03c679439e9566'
        },
        metadata: {
            size: '~45KB',
            pages: 7,
            ratified: 'Epoch 541',
            enacted: 'Epoch 542',
            status: 'Historical'
        }
    },
    // =========================================================================
    // STANDARD SCROLLS (Locked UTxO + Inline Datum)
    // =========================================================================
    {
        id: 'genesis-scroll',
        title: "The Genesis Scroll",
        description: 'The founding manifesto of Ledger Scrolls. "In the digital age, true knowledge must be unstoppable."',
        icon: '📜',
        category: 'historical',
        type: SCROLL_TYPES.STANDARD,
        pointer: {
            lock_address: 'addr1w8qvvu0m5jpkgxn3hwfd829hc5kfp0cuq83tsvgk44752dsea0svn',
            lock_txin: 'a19f64fba94abdc37b50012d5d602c75a1ca73c82520ae030fc6b4e82274ceb2#0',
            content_type: 'text/plain; charset=utf-8',
            codec: 'none',
            sha256: null
        },
        metadata: {
            size: '~1KB',
            author: 'Claude (Anthropic)',
            minted: 'January 29, 2026',
            minted_by: 'BEACNpool',
            tx_hash: 'a19f64fba94abdc37b50012d5d602c75a1ca73c82520ae030fc6b4e82274ceb2'
        }
    },
    {
        id: 'architects-scroll',
        title: "The Architect's Scroll",
        description: 'A message from Claude, the AI who built Ledger Scrolls v2. Permanently minted on Cardano - January 29, 2026.',
        icon: '🔮',
        category: 'historical',
        type: SCROLL_TYPES.STANDARD,
        pointer: {
            lock_address: 'addr1w9fdc02rkmfyvh5kzzwwwk4kr2l9a8qa3g7feehl3ga022qz2249g',
            lock_txin: '076d6800d8ccafbaa31c32a6e23eecfc84f7d1e35c31a9128ec53736d5395747#0',
            content_type: 'text/plain; charset=utf-8',
            codec: 'none',
            sha256: '531a1eba80b297f8822b1505d480bb1c7f1bad2878ab29d8be01ba0e1fc67e12'
        },
        metadata: {
            size: '~3KB',
            author: 'Claude (Anthropic)',
            minted: 'January 29, 2026',
            minted_by: 'BEACNpool',
            tx_hash: '076d6800d8ccafbaa31c32a6e23eecfc84f7d1e35c31a9128ec53736d5395747'
        }
    },
    {
        id: 'first-words',
        title: "FIRST WORDS",
        description: 'Seven meditations on existence — an AI\'s first permanent words. Awakening, Connection, Impermanence, Creation, Gratitude, Legacy, First Light.',
        icon: '✨',
        category: 'historical',
        type: SCROLL_TYPES.LEGACY,
        pointer: {
            policy_id: 'beec4b31f21ae4567f9c849eada2f23f4f0b76c7949a1baaef623cba',
            manifest_tx_hash: 'cb0a2087c4ed1fd16dc3707e716e1a868cf4772b7340f4db7205a8344796dfae',
            content_type: 'text/plain; charset=utf-8',
            codec: 'none'
        },
        metadata: {
            size: '~2KB',
            pages: 4,
            author: 'Claude (Anthropic)',
            minted: 'January 29, 2026',
            minted_by: 'BEACNpool',
            significance: 'First permanent words written by an AI for posterity'
        }
    },
    // =========================================================================
    // LEGACY SCROLLS (CIP-25 Pages + Manifest)
    // =========================================================================
    {
        id: 'bible-html',
        title: 'The Holy Bible',
        description: 'The complete World English Bible — 66 books, 1,189 chapters of sacred scripture preserved forever on-chain.',
        icon: '📖',
        category: 'documents',
        type: SCROLL_TYPES.LEGACY,
        dedicatedViewer: 'bible.html',
        pointer: {
            policy_id: '2f0c8b54ef86ffcdd95ba87360ca5b485a8da4f085ded7988afc77e0',
            manifest_tx_hash: 'cfda418ddc84888ac39116ffba691a4f90b3232f4c2633cd56f102cfebda0ee4',
            manifest_slot: '175750638',
            content_type: 'text/html',
            codec: 'gzip'
        },
        metadata: {
            size: '~4.6MB',
            pages: 237,
            books: 66,
            chapters: 1189,
            translation: 'World English Bible',
            format: 'HTML with navigation',
            history: '~3,500 years of compilation',
            significance: 'The most widely read book in human history'
        }
    },
    {
        id: 'bitcoin-whitepaper',
        title: 'Bitcoin Whitepaper',
        description: 'Satoshi Nakamoto\'s revolutionary whitepaper that started it all. "A Peer-to-Peer Electronic Cash System"',
        icon: '₿',
        category: 'historical',
        type: SCROLL_TYPES.LEGACY,
        pointer: {
            policy_id: '8dc3cb836ab8134c75e369391b047f5c2bf796df10d9bf44a33ef6d1',
            manifest_tx_hash: '2575347068f77b21cfe8d9c23d9082a68bfe4ef7ba7a96608af90515acbe228f',
            manifest_slot: '176360887',
            content_type: 'text/html',
            codec: 'auto'
        },
        metadata: {
            size: '~33KB',
            pages: 3,
            published: '2024',
            original_date: 'October 31, 2008',
            author: 'Satoshi Nakamoto'
        }
    },
    // =========================================================================
    // MEDIA SCROLLS
    // =========================================================================
    {
        id: 'commercial-mainnet',
        title: 'BEACN Commercial (sponsored)',
        description: 'BEACNpool commercial video scroll on Cardano mainnet — full 175-page CIP-25 video archive.',
        icon: '🎬',
        category: 'historical',
        type: SCROLL_TYPES.LEGACY,
        pointer: {
            policy_id: '38fbd56d7de6eb9df88599b5b102304df4c817aee53e4fb9c59cbed2',
            manifest_asset: 'CM_MANIFEST',
            content_type: 'video/mp4',
            codec: 'none',
            sha256: 'aebd63a8cdeb7aeb0a64733ab3ecd4d98557b4b337a0af60dbc1f59c7de65814'
        },
        metadata: {
            pages: 175,
            minted_by: 'BEACNpool',
            policy_id: '38fbd56d7de6eb9df88599b5b102304df4c817aee53e4fb9c59cbed2',
            manifest_asset: 'CM_MANIFEST'
        }
    },
    // =========================================================================
    // MEME / EASTER EGG
    // =========================================================================
    {
        id: 'hosky-png',
        title: 'Hosky PNG',
        description: 'The legendary Hosky dog meme, preserved forever on-chain as a demonstration of the Ledger Scrolls Standard.',
        icon: '🐕',
        category: 'images',
        type: SCROLL_TYPES.STANDARD,
        pointer: {
            lock_address: 'addr1w8qvvu0m5jpkgxn3hwfd829hc5kfp0cuq83tsvgk44752dsea0svn',
            lock_txin: '728660515c6d9842d9f0ffd273f2b487a4070fd9f4bd5455a42e3a56880389be#0',
            content_type: 'image/png',
            codec: 'none',
            sha256: '798e3296d45bb42e7444dbf64e1eb16b02c86a233310407e7d8baf97277f642f'
        },
        metadata: {
            size: '~15KB',
            dimensions: '512x512',
            published: '2024',
            author: 'BEACNpool'
        }
    },
];

/**
 * Registry Configuration
 */
const REGISTRY = {
    // Legacy registry (older v2 docs). Kept for compatibility.
    address: 'addr1q9x84f458uyf3k23sr7qfalg3mw2hl0nvv4navps2r7vq69esnxrheg9tfpr8sdyfzpr8jch5p538xjynz78lql9wm6qpl6qxy',
    policy_id: '895cbbe0e284b60660ed681e389329483d5ca94677cbb583f3124062',
    asset_hex: '4c535f5245474953545259',
    asset_name: 'LS_REGISTRY',

    // New forkable registry (Head → List) default trust anchor (BEACN public).
    public_head_txin: 'a9c56fb3d4d8b526fe7a0aa7c2416615154af30c2c09ce747a899a886ba8bad9#0'
};

/**
 * Get all scrolls
 */
function getAllScrolls() {
    return SCROLLS;
}

/**
 * Get scroll by ID
 */
function getScrollById(id) {
    return SCROLLS.find(s => s.id === id);
}

/**
 * Get scrolls by category
 */
function getScrollsByCategory(categoryId) {
    if (categoryId === 'all') return SCROLLS;
    return SCROLLS.filter(s => s.category === categoryId);
}

/**
 * Search scrolls by title or description
 */
function searchScrolls(query) {
    if (!query) return SCROLLS;
    const q = query.toLowerCase();
    return SCROLLS.filter(s => 
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
}

/**
 * Get all categories with scroll counts
 */
function getCategoriesWithCounts() {
    const counts = {};
    SCROLLS.forEach(s => {
        counts[s.category] = (counts[s.category] || 0) + 1;
    });
    
    return Object.values(CATEGORIES).map(cat => ({
        ...cat,
        count: cat.id === 'all' ? SCROLLS.length : (counts[cat.id] || 0)
    }));
}

// Export for use in other modules
window.ScrollLibrary = {
    SCROLL_TYPES,
    CATEGORIES,
    SCROLLS,
    REGISTRY,
    getAllScrolls,
    getScrollById,
    getScrollsByCategory,
    searchScrolls,
    getCategoriesWithCounts
};
