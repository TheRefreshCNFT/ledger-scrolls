/**
 * Ledger Scrolls - Mobile-First Application
 * "A Library That Cannot Burn"
 */

// --- Binary rendering helpers (MP4, images, PDFs, etc.) ---
let _activeObjectUrl = null;
function revokeActiveObjectUrl() {
    if (_activeObjectUrl) {
        URL.revokeObjectURL(_activeObjectUrl);
        _activeObjectUrl = null;
    }
}
function makeObjectUrl(bytes, contentType) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const blob = new Blob([u8], { type: contentType || "application/octet-stream" });
    revokeActiveObjectUrl();
    _activeObjectUrl = URL.createObjectURL(blob);
    return { blob, url: _activeObjectUrl };
}
function guessFileExtension(contentType) {
    const ct = (contentType || "").toLowerCase();
    if (ct.includes("video/mp4")) return "mp4";
    if (ct.includes("image/png")) return "png";
    if (ct.includes("image/jpeg")) return "jpg";
    if (ct.includes("application/pdf")) return "pdf";
    if (ct.includes("text/html")) return "html";
    if (ct.includes("text/plain")) return "txt";
    return "bin";
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
function renderScrollBytesIntoViewer({ bytes, contentType, filename }, viewerContentEl) {
    const ct = (contentType || "application/octet-stream").toLowerCase();
    const ext = guessFileExtension(ct);
    const finalName = filename || `ledger_scroll.${ext}`;
    const { blob, url } = makeObjectUrl(bytes, ct);

    viewerContentEl.innerHTML = "";

    if (ct.startsWith("video/") || ct.includes("video/mp4")) {
        const wrap = document.createElement("div");
        wrap.className = "video-wrap";
        const vid = document.createElement("video");
        vid.controls = true;
        vid.playsInline = true;
        vid.preload = "metadata";
        vid.src = url;
        vid.style.width = "100%";
        vid.style.maxHeight = "60vh";
        vid.style.borderRadius = "12px";
        wrap.appendChild(vid);
        viewerContentEl.appendChild(wrap);
        return { blob, url, filename: finalName, kind: "video" };
    }

    if (ct.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = finalName;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "12px";
        viewerContentEl.appendChild(img);
        return { blob, url, filename: finalName, kind: "image" };
    }

    if (ct.includes("application/pdf")) {
        const iframe = document.createElement("iframe");
        iframe.src = url;
        iframe.style.width = "100%";
        iframe.style.height = "60vh";
        iframe.style.border = "0";
        iframe.style.borderRadius = "12px";
        viewerContentEl.appendChild(iframe);
        return { blob, url, filename: finalName, kind: "pdf" };
    }

    if (ct.startsWith("text/") || ct.includes("application/json")) {
        const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(u8);
        if (ct.includes("text/html")) {
            const iframe = document.createElement("iframe");
            iframe.setAttribute("sandbox", "allow-scripts");
            iframe.style.width = "100%";
            iframe.style.height = "60vh";
            iframe.style.border = "0";
            iframe.style.borderRadius = "12px";
            viewerContentEl.appendChild(iframe);
            const doc = iframe.contentDocument;
            doc.open();
            doc.write(text);
            doc.close();
            return { blob, url, filename: finalName, kind: "html" };
        }
        const pre = document.createElement("pre");
        pre.textContent = text.length > 50000 ? text.substring(0, 50000) + "\n\n... (truncated)" : text;
        pre.style.whiteSpace = "pre-wrap";
        viewerContentEl.appendChild(pre);
        return { blob, url, filename: finalName, kind: "text" };
    }

    const p = document.createElement("p");
    p.textContent = `Binary content (${ct}). Use Download.`;
    viewerContentEl.appendChild(p);
    return { blob, url, filename: finalName, kind: "binary" };
}

class LedgerScrollsApp {
    constructor() {
        // State
        this.client = null;
        this.reconstructor = null;
        this.connected = false;
        this.currentScroll = null;
        this.currentCategory = 'all';
        this.loadedContent = null;
        this._currentBlobUrl = null;

        // Settings
        this.settings = this._loadSettings();

        // Initialize
        this._initializeUI();
        this._bindEvents();
        this._initParticles();
        this._applyTheme(this.settings.theme);
        // Default to the built-in (hardcoded) library for reliability.
        // The on-chain Registry loading is an *optional upgrade* via Settings → Confirm.
        this._renderScrollLibrary();

        // Auto-connect if we have settings
        if (this.settings.apiKey || this.settings.mode === 'koios') {
            this._connect();
        }

        console.log('[Ledger Scrolls] Mobile app initialized');
    }

    // =========================================================================
    // Settings Management
    // =========================================================================

    _loadSettings() {
        try {
            const saved = localStorage.getItem('ledgerScrollsSettings');
            const fallback = {
                mode: 'koios',
                apiKey: '',
                koiosProxy: '',
                theme: 'dark',
                registryHeadTxIn: (window.ScrollLibrary?.REGISTRY?.public_head_txin || '').trim(),
                privateHeads: []
            };
            const settings = saved ? JSON.parse(saved) : fallback;
            if (typeof settings.koiosProxy === 'undefined') {
                settings.koiosProxy = '';
            }
            const currentDefaultHead = (window.ScrollLibrary?.REGISTRY?.public_head_txin || '').trim();

            if (typeof settings.registryHeadTxIn === 'undefined') {
                settings.registryHeadTxIn = currentDefaultHead;
            }

            // Normalize private heads before migration logic.
            const privLen = Array.isArray(settings.privateHeads) ? settings.privateHeads.length : 0;
            if (!Array.isArray(settings.privateHeads)) {
                settings.privateHeads = [];
            }

            // Migration: if user never customized (no private heads) and they are still pinned
            // to the original genesis head, update to the latest shipped public head.
            const legacyGenesisHead = 'ce86a174e1b35c37dea6898ef16352d447d11833549b1f382db22c5bb6358cab#0';
            if (privLen === 0 && settings.registryHeadTxIn === legacyGenesisHead) {
                settings.registryHeadTxIn = currentDefaultHead;
            }
            if (window.LS_OVERRIDE_MODE) {
                settings.mode = window.LS_OVERRIDE_MODE;
            }
            return settings;
        } catch {
            return { mode: window.LS_DEFAULT_MODE || 'koios', apiKey: '', koiosProxy: '', theme: 'dark' };
        }
    }

    _saveSettings() {
        localStorage.setItem('ledgerScrollsSettings', JSON.stringify(this.settings));
    }

    // =========================================================================
    // UI Initialization
    // =========================================================================

    _initializeUI() {
        this.elements = {
            // Header
            connectionPill: document.getElementById('connectionPill'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            logoSection: document.getElementById('logoSection'),
            
            // Viewer
            scrollTitleBar: document.getElementById('scrollTitleBar'),
            viewerTitle: document.getElementById('viewerTitle'),
            backBtn: document.getElementById('backBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            verifyBtn: document.getElementById('verifyBtn'),
            viewerLoading: document.getElementById('viewerLoading'),
            viewerContent: document.getElementById('viewerContent'),
            loadingText: document.getElementById('loadingText'),
            scrollProgress: document.getElementById('scrollProgress'),
            progressPages: document.getElementById('progressPages'),
            progressFill: document.getElementById('progressFill'),
            progressStatus: document.getElementById('progressStatus'),
            scrollMetadata: document.getElementById('scrollMetadata'),
            metadataToggle: document.getElementById('metadataToggle'),
            metadataContent: document.getElementById('metadataContent'),
            
            // Bottom Nav
            libraryBtn: document.getElementById('libraryBtn'),
            aboutBtn: document.getElementById('aboutBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            
            // Library Drawer
            libraryDrawer: document.getElementById('libraryDrawer'),
            scrollCategories: document.getElementById('scrollCategories'),
            scrollGrid: document.getElementById('scrollGrid'),
            searchInput: document.getElementById('searchScrolls'),
            customScrollBtn: document.getElementById('customScrollBtn'),
            
            // Settings Drawer
            settingsDrawer: document.getElementById('settingsDrawer'),
            connectBtn: document.getElementById('connectBtn'),
            apiKeyInput: document.getElementById('apiKeyInput'),
            koiosProxyInput: document.getElementById('koiosProxyInput'),
            koiosProxyStatus: document.getElementById('koiosProxyStatus'),
            blockfrostSettings: document.getElementById('blockfrostSettings'),
            // Koios-only: no connection mode radios in the main web viewer.
            modeRadios: [],
            themePills: document.querySelectorAll('.theme-pill'),

            // Registry
            registryHeadInput: document.getElementById('registryHeadInput'),
            privateHeadsInput: document.getElementById('privateHeadsInput'),
            loadLibraryBtn: document.getElementById('loadLibraryBtn'),
            
            // About Drawer
            aboutDrawer: document.getElementById('aboutDrawer'),
            
            // Modals
            customScrollModal: document.getElementById('customScrollModal'),
            verifyModal: document.getElementById('verifyModal'),
            
            // Toast
            toastContainer: document.getElementById('toastContainer')
        };

        // Apply saved settings to UI
        if (this.settings.apiKey) {
            this.elements.apiKeyInput.value = this.settings.apiKey;
        }
        if (this.elements.koiosProxyInput) {
            this.elements.koiosProxyInput.value = this.settings.koiosProxy || '';
        }
        if (this.elements.koiosProxyStatus) {
            this.elements.koiosProxyStatus.textContent = `Current: ${this.settings.koiosProxy || '(none)'}`;
        }

        // Registry defaults
        if (this.elements.registryHeadInput) {
            this.elements.registryHeadInput.value = (this.settings.registryHeadTxIn || window.ScrollLibrary?.REGISTRY?.public_head_txin || '').trim();
        }
        if (this.elements.privateHeadsInput) {
            const priv = this.settings.privateHeads || [];
            this.elements.privateHeadsInput.value = Array.isArray(priv) ? priv.join('\n') : '';
        }
        
        // Koios-only: no mode radios.

        // Blockfrost failover settings are always shown (optional).
        if (this.elements.blockfrostSettings) {
            this.elements.blockfrostSettings.style.display = 'block';
        }
    }

    _bindEvents() {
        // Bottom navigation
        this.elements.libraryBtn.addEventListener('click', () => this._openDrawer('libraryDrawer'));
        this.elements.aboutBtn.addEventListener('click', () => this._openDrawer('aboutDrawer'));
        this.elements.settingsBtn.addEventListener('click', () => this._openDrawer('settingsDrawer'));
        
        // Connection pill opens settings
        this.elements.connectionPill.addEventListener('click', () => this._openDrawer('settingsDrawer'));
        
        // Logo returns to home
        this.elements.logoSection.addEventListener('click', () => this._closeViewer());
        
        // Back button
        this.elements.backBtn.addEventListener('click', () => this._closeViewer());
        
        // Download & Verify
        this.elements.downloadBtn.addEventListener('click', () => this._downloadCurrentScroll());
        this.elements.verifyBtn.addEventListener('click', () => this._verifyCurrentScroll());
        
        // Metadata toggle
        this.elements.metadataToggle.addEventListener('click', () => {
            this.elements.scrollMetadata.classList.toggle('collapsed');
        });
        
        // Library search
        this.elements.searchInput.addEventListener('input', (e) => this._onSearch(e.target.value));
        
        // Custom scroll
        this.elements.customScrollBtn.addEventListener('click', () => {
            this._closeDrawer('libraryDrawer');
            this._openModal('customScrollModal');
        });
        
        // Koios-only: connect happens automatically; no manual connect button.

        // Load library from registry
        this.elements.loadLibraryBtn?.addEventListener('click', () => this._confirmAndLoadLibrary());
        
        // Save API key
        document.getElementById('saveApiKey')?.addEventListener('click', () => this._saveApiKey());
        
        // Save Koios proxy
        document.getElementById('saveKoiosProxy')?.addEventListener('click', () => this._saveKoiosProxy());
        
        // Koios-only: no connection mode change UI.

        // Theme change
        this.elements.themePills.forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this._applyTheme(theme);
                this.settings.theme = theme;
                this._saveSettings();
            });
        });
        
        // Drawer close buttons & backdrops
        document.querySelectorAll('.drawer-backdrop, .drawer-close').forEach(el => {
            el.addEventListener('click', (e) => {
                const drawer = e.target.closest('.drawer');
                if (drawer) this._closeDrawer(drawer.id);
            });
        });
        
        // Modal close buttons & backdrops
        document.querySelectorAll('.modal-backdrop, .modal-close').forEach(el => {
            el.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) this._closeModal(modal.id);
            });
        });
        
        // Tab switching in custom scroll modal
        document.querySelector('[data-tab="standard"]')?.addEventListener('click', () => this._switchTab('standard'));
        document.querySelector('[data-tab="legacy"]')?.addEventListener('click', () => this._switchTab('legacy'));
        document.getElementById('loadCustomScroll')?.addEventListener('click', () => this._loadCustomScroll());
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.drawer.active').forEach(d => this._closeDrawer(d.id));
                document.querySelectorAll('.modal.active').forEach(m => this._closeModal(m.id));
            }
        });
        
        // Prevent body scroll when drawer is open (mobile)
        document.querySelectorAll('.drawer').forEach(drawer => {
            drawer.addEventListener('touchmove', (e) => {
                if (e.target === drawer.querySelector('.drawer-backdrop')) {
                    e.preventDefault();
                }
            }, { passive: false });
        });
    }

    _initParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 20}s`;
            particle.style.animationDuration = `${20 + Math.random() * 10}s`;
            container.appendChild(particle);
        }
    }

    // =========================================================================
    // Connection
    // =========================================================================

    async _connect() {
        const mode = this.settings.mode;
        const apiKey = this.settings.apiKey;

        if (mode === 'blockfrost' && !apiKey) {
            this._toast('error', 'Please enter a Blockfrost API key');
            return;
        }

        this._setConnectionStatus('connecting', 'Connecting...');

        try {
            this.client = new BlockchainClient(mode, apiKey, this.settings.koiosProxy);
            if (!window.ScrollReconstructor) {
                await this._loadScript(`js/reconstruct.js?cb=${Date.now()}`);
            }
            if (!window.ScrollReconstructor) {
                throw new Error('ScrollReconstructor missing');
            }
            this.reconstructor = new ScrollReconstructor(this.client);

            const result = await this.client.testConnection();
            
            if (result.success) {
                this.connected = true;
                this._setConnectionStatus('connected', 'Online');
                this._toast('success', 'Connected to Cardano!');
            } else {
                throw new Error(result.error || 'Connection failed');
            }
        } catch (e) {
            this.connected = false;
            this._setConnectionStatus('disconnected', 'Offline');
            this._toast('error', `Connection failed: ${e.message}`);
        }
    }

    _setConnectionStatus(status, text) {
        this.elements.statusDot.className = `status-dot ${status}`;
        this.elements.statusText.textContent = text;
        if (this.elements.connectBtn) {
            this.elements.connectBtn.textContent = status === 'connected' ? 'Online' : 'Offline';
        }
    }

    // =========================================================================
    // Registry → Library Loading
    // =========================================================================

    _parseHeadsTextarea(text) {
        return (text || '')
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(Boolean);
    }

    async _confirmAndLoadLibrary() {
        if (!this.connected) {
            this._toast('warning', 'Please connect to Cardano first');
            this._openDrawer('settingsDrawer');
            return;
        }

        const headTxIn = (this.elements.registryHeadInput?.value || '').trim() || (window.ScrollLibrary?.REGISTRY?.public_head_txin || '').trim();
        const privateHeads = this._parseHeadsTextarea(this.elements.privateHeadsInput?.value);

        if (!headTxIn || !headTxIn.includes('#')) {
            this._toast('error', 'Registry head is required (format: <txhash>#<ix>)');
            this._openDrawer('settingsDrawer');
            return;
        }

        // Persist settings
        this.settings.registryHeadTxIn = headTxIn;
        this.settings.privateHeads = privateHeads;
        this._saveSettings();

        this._closeDrawer('settingsDrawer');

        try {
            this.elements.loadingText.textContent = '📚 Loading registry...';
            this.elements.viewerLoading.classList.remove('hidden');
            this.elements.viewerLoading.classList.add('loading');
            this.elements.scrollProgress.classList.add('active');
            this.elements.progressFill.style.width = '0%';
            this.elements.progressStatus.textContent = 'Fetching registry head...';

            const merged = await this.client.loadRegistryMerged({ headTxIn, privateHeads }, (msg, pct) => {
                this.elements.progressStatus.textContent = msg;
                if (pct != null) this.elements.progressFill.style.width = `${pct}%`;
            });

            const scrolls = this.client.registryToScrolls(merged);

            // Make resolution transparent in the UI.
            const usedHead = headTxIn;
            this._toast('info', `Registry head: ${usedHead}`);

            if (!scrolls.length) {
                // Don't blow away the built-in library if the registry is empty.
                this._toast('warning', 'Registry loaded, but it contained zero entries (keeping built-in library)');
                this._openDrawer('libraryDrawer');
                return;
            }

            window.ScrollLibrary.setScrolls(scrolls);
            this._renderScrollLibrary();
            this._toast('success', `Library loaded (${scrolls.length} scrolls)`);
            this._openDrawer('libraryDrawer');

        } catch (e) {
            console.error(e);
            this._toast('error', `Registry load failed: ${e.message}`);
        } finally {
            this.elements.viewerLoading.classList.remove('loading');
            this.elements.scrollProgress.classList.remove('active');
            this.elements.progressFill.style.width = '0%';
            this.elements.progressStatus.textContent = 'Waiting...';
        }
    }

    // =========================================================================
    // Library Rendering
    // =========================================================================

    _renderScrollLibrary() {
        // Render categories
        const categories = ScrollLibrary.getCategoriesWithCounts();
        this.elements.scrollCategories.innerHTML = categories.map(cat => `
            <button class="category-chip ${cat.id === this.currentCategory ? 'active' : ''}" 
                    data-category="${cat.id}">
                ${cat.icon} ${cat.name} (${cat.count})
            </button>
        `).join('');

        this.elements.scrollCategories.querySelectorAll('.category-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentCategory = btn.dataset.category;
                this._renderScrollLibrary();
            });
        });

        // Render scrolls
        const scrolls = ScrollLibrary.getScrollsByCategory(this.currentCategory);
        this._renderScrollList(scrolls);
    }

    _renderScrollList(scrolls) {
        if (!scrolls || scrolls.length === 0) {
            this.elements.scrollGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <div class="empty-state-text">No scrolls found. Try a different search or load the registry from Settings.</div>
                </div>
            `;
            return;
        }

        this.elements.scrollGrid.innerHTML = scrolls.map(scroll => `
            <div class="scroll-item" data-scroll-id="${scroll.id}">
                <div class="scroll-item-icon">${scroll.icon}</div>
                <div class="scroll-item-info">
                    <div class="scroll-item-title">${scroll.title}</div>
                    <div class="scroll-item-meta">
                        <span>${scroll.metadata?.size || 'Unknown'}</span>
                        <span class="scroll-item-type">${
                            scroll.type === ScrollLibrary.SCROLL_TYPES.STANDARD ? 'Standard' : 'Legacy'
                        }</span>
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.scrollGrid.querySelectorAll('.scroll-item').forEach(item => {
            item.addEventListener('click', () => {
                const scrollId = item.dataset.scrollId;
                const scroll = ScrollLibrary.getScrollById(scrollId);
                if (scroll) {
                    this._closeDrawer('libraryDrawer');
                    this._loadScroll(scroll);
                }
            });
        });
    }

    _onSearch(query) {
        const scrolls = ScrollLibrary.searchScrolls(query);
        this._renderScrollList(scrolls);
    }

    // =========================================================================
    // Scroll Loading & Display
    // =========================================================================

    async _loadScroll(scroll) {
        if (!this.connected) {
            this._toast('warning', 'Please connect to Cardano first');
            this._openDrawer('settingsDrawer');
            return;
        }

        this.currentScroll = scroll;
        this.loadedContent = null;

        // Show title bar
        this.elements.scrollTitleBar.classList.add('active');
        this.elements.viewerTitle.textContent = scroll.title;
        
        // Reset viewer state
        this.elements.viewerContent.classList.remove('active');
        this.elements.viewerContent.innerHTML = '';
        this.elements.scrollMetadata.classList.remove('active');
        this.elements.viewerLoading.classList.remove('hidden');
        this.elements.viewerLoading.classList.add('loading');
        this.elements.scrollProgress.classList.add('active');
        this.elements.progressFill.style.width = '0%';
        this.elements.downloadBtn.disabled = true;
        this.elements.verifyBtn.disabled = true;
        
        // Reset page counter
        this._updatePageCounter(0, 0);

        // Set up progress callback
        this.reconstructor.setProgressCallback((message, percent) => {
            this.elements.loadingText.textContent = message;
            this.elements.progressStatus.textContent = message;
            
            if (percent !== null) {
                this.elements.progressFill.style.width = `${percent}%`;
            }
            
            // Parse page info from message if available
            const pageMatch = message.match(/page\s*(\d+)\s*(?:of|\/)\s*(\d+)/i);
            if (pageMatch) {
                const current = parseInt(pageMatch[1]);
                const total = parseInt(pageMatch[2]);
                this._updatePageCounter(current, total);
            }
        });

        try {
            const result = await this.reconstructor.reconstruct(scroll);
            this.loadedContent = result;
            
            // Update page counter to complete
            if (result.pages) {
                this._updatePageCounter(result.pages, result.pages);
            }
            
            this._displayContent(result, scroll);
            this._displayMetadata(result, scroll);
            this.elements.downloadBtn.disabled = false;
            this.elements.verifyBtn.disabled = false;
            this._toast('success', `${scroll.title} loaded!`);
        } catch (e) {
            this._toast('error', `Failed: ${e.message}`);
            this.elements.loadingText.textContent = `❌ ${e.message}`;
            this.elements.progressStatus.textContent = 'Error';
        } finally {
            this.elements.viewerLoading.classList.remove('loading');
        }
    }

    _updatePageCounter(current, total) {
        const currentEl = this.elements.progressPages.querySelector('.current-page');
        const totalEl = this.elements.progressPages.querySelector('.total-pages');
        
        if (currentEl && totalEl) {
            // Animate the page number change
            if (parseInt(currentEl.textContent) !== current) {
                currentEl.classList.add('pulse');
                setTimeout(() => currentEl.classList.remove('pulse'), 300);
            }
            currentEl.textContent = current;
            totalEl.textContent = total;
        }
    }

    _displayContent(result, scroll) {
        revokeActiveObjectUrl();

        this.elements.viewerLoading.classList.add('hidden');
        this.elements.viewerContent.classList.add('active');

        const contentType = result.contentType.split(';')[0].trim();
        const filename = scroll.file_name || scroll.id || scroll.title;

        window.__LS_OPEN = renderScrollBytesIntoViewer(
            { bytes: result.data, contentType, filename },
            this.elements.viewerContent
        );
    }

    _displayMetadata(result, scroll) {
        this.elements.scrollMetadata.classList.add('active');
        this.elements.scrollMetadata.classList.remove('collapsed');
        
        const metadata = {
            'Type': result.contentType.split(';')[0],
            'Size': this._formatSize(result.size),
            'Method': result.method,
            ...(result.pages && { 'Pages': result.pages }),
            'SHA-256': result.hash,
            ...(scroll.pointer.lock_txin && { 'Lock TxIn': scroll.pointer.lock_txin }),
            ...(scroll.pointer.policy_id && { 'Policy ID': scroll.pointer.policy_id })
        };

        this.elements.metadataContent.innerHTML = `
            <div class="metadata-grid">
                ${Object.entries(metadata).map(([label, value]) => `
                    <div class="metadata-item">
                        <span class="metadata-label">${label}</span>
                        <span class="metadata-value ${label === 'SHA-256' ? 'hash' : ''}">${value}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    _closeViewer() {
        revokeActiveObjectUrl();
        window.__LS_OPEN = null;

        this.currentScroll = null;
        this.loadedContent = null;
        
        // Hide title bar
        this.elements.scrollTitleBar.classList.remove('active');
        this.elements.viewerTitle.textContent = 'Select a Scroll';
        
        // Reset viewer
        this.elements.viewerContent.classList.remove('active');
        this.elements.viewerContent.innerHTML = '';
        this.elements.scrollMetadata.classList.remove('active');
        this.elements.viewerLoading.classList.remove('hidden');
        this.elements.viewerLoading.classList.remove('loading');
        this.elements.loadingText.textContent = 'Ready to explore...';
        this.elements.scrollProgress.classList.remove('active');
        this.elements.downloadBtn.disabled = true;
        this.elements.verifyBtn.disabled = true;
        
        this._updatePageCounter(0, 0);
    }

    // =========================================================================
    // Download & Verification
    // =========================================================================

    _downloadCurrentScroll() {
        const open = window.__LS_OPEN;
        if (open?.blob) {
            downloadBlob(open.blob, open.filename);
            this._toast('success', `Downloaded ${open.filename}`);
            return;
        }
        if (!this.loadedContent || !this.currentScroll) return;

        const contentType = this.loadedContent.contentType.split(';')[0].trim();
        const extension = this._getExtension(contentType);
        const filename = `${this.currentScroll.title.replace(/[^a-z0-9]/gi, '_')}${extension}`;

        const blob = new Blob([this.loadedContent.data], { type: contentType });
        downloadBlob(blob, filename);
        this._toast('success', `Downloaded ${filename}`);
    }

    _verifyCurrentScroll() {
        if (!this.loadedContent || !this.currentScroll) return;

        const expected = this.currentScroll.pointer?.sha256 || 
                        this.currentScroll.pointer?.sha256_original;
        const computed = this.loadedContent.hash;
        const noHash = !expected;
        const verified = !noHash && expected.toLowerCase() === computed.toLowerCase();

        const resultDiv = document.getElementById('verificationResult');
        resultDiv.innerHTML = `
            <div class="verification-icon">${noHash ? '⚠️' : (verified ? '✅' : '❌')}</div>
            <div class="verification-status ${noHash ? '' : (verified ? 'verified' : 'failed')}">
                ${noHash ? 'NO EXPECTED HASH' : (verified ? 'VERIFIED' : 'FAILED')}
            </div>
            <div class="hash-comparison">
                ${expected ? `
                    <div class="hash-row">
                        <div class="hash-label">Expected</div>
                        <div class="hash-value">${expected}</div>
                    </div>
                ` : ''}
                <div class="hash-row">
                    <div class="hash-label">Computed</div>
                    <div class="hash-value">${computed}</div>
                </div>
            </div>
        `;

        this._openModal('verifyModal');
    }

    // =========================================================================
    // Custom Scroll Loading
    // =========================================================================

    _switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.toggle('active', tab.id === `tab-${tabId}`);
        });
    }

    async _loadCustomScroll() {
        const activeTab = document.querySelector('.tab-content.active');
        
        if (activeTab.id === 'tab-standard') {
            const scroll = {
                id: 'custom',
                title: 'Custom Scroll',
                description: 'Custom scroll',
                icon: '🔧',
                category: 'all',
                type: ScrollLibrary.SCROLL_TYPES.STANDARD,
                pointer: {
                    lock_address: document.getElementById('customLockAddr').value.trim(),
                    lock_txin: document.getElementById('customTxIn').value.trim(),
                    content_type: document.getElementById('customContentType').value,
                    codec: document.getElementById('customCodec').value,
                    sha256: document.getElementById('customSha256').value.trim() || null
                },
                metadata: {}
            };

            if (!scroll.pointer.lock_address || !scroll.pointer.lock_txin) {
                this._toast('error', 'Please fill in Lock Address and Transaction Input');
                return;
            }

            this._closeModal('customScrollModal');
            await this._loadScroll(scroll);
        } else {
            const scroll = {
                id: 'custom-legacy',
                title: 'Custom Legacy Scroll',
                description: 'Custom legacy scroll',
                icon: '🔧',
                category: 'all',
                type: ScrollLibrary.SCROLL_TYPES.LEGACY,
                pointer: {
                    policy_id: document.getElementById('customPolicyId').value.trim(),
                    content_type: document.getElementById('customLegacyContentType').value,
                    codec: document.getElementById('customLegacyCodec').value
                },
                metadata: {}
            };

            if (!scroll.pointer.policy_id) {
                this._toast('error', 'Please enter a Policy ID');
                return;
            }

            this._closeModal('customScrollModal');
            await this._loadScroll(scroll);
        }
    }

    // =========================================================================
    // Settings
    // =========================================================================

    _saveApiKey() {
        const key = this.elements.apiKeyInput.value.trim();
        this.settings.apiKey = key;
        this._saveSettings();
        this._toast('success', 'API key saved');
        if (key) this._connect();
    }

    _saveKoiosProxy() {
        const value = this.elements.koiosProxyInput?.value?.trim() || '';
        this.settings.koiosProxy = value;
        this._saveSettings();
        if (this.client && typeof this.client.setKoiosProxy === 'function') {
            this.client.setKoiosProxy(value);
        }
        if (this.elements.koiosProxyStatus) {
            this.elements.koiosProxyStatus.textContent = `Current: ${value || '(none)'}`;
        }
        this._toast('success', value ? 'Proxy saved' : 'Proxy cleared');
    }

    _onModeChange(mode) {
        // Deprecated in Koios-only web viewer. Kept to avoid breaking older saved code paths.
        this.settings.mode = 'koios';
        this._saveSettings();
        if (this.elements.blockfrostSettings) {
            this.elements.blockfrostSettings.style.display = 'block';
        }
    }

    _applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.elements.themePills.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    // =========================================================================
    // Drawer & Modal Management
    // =========================================================================

    _openDrawer(drawerId) {
        const drawer = document.getElementById(drawerId);
        if (drawer) {
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    _closeDrawer(drawerId) {
        const drawer = document.getElementById(drawerId);
        if (drawer) {
            drawer.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    _openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            if (modalId === 'customScrollModal') this._switchTab('standard');
        }
    }

    _closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    // =========================================================================
    // Toasts
    // =========================================================================

    _toast(type, message) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const dismiss = () => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        };
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-message">${this._escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Dismiss">&times;</button>
        `;
        toast.querySelector('.toast-close').addEventListener('click', dismiss);
        this.elements.toastContainer.appendChild(toast);
        setTimeout(dismiss, 4000);
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    _formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = (e) => reject(e);
            document.head.appendChild(s);
        });
    }

    _getExtension(contentType) {
        const map = {
            'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
            'text/html': '.html', 'text/plain': '.txt',
            'application/pdf': '.pdf', 'application/json': '.json',
            'audio/opus': '.opus', 'audio/mpeg': '.mp3',
            'video/mp4': '.mp4'
        };
        const key = (contentType || '').split(';')[0].trim();
        return map[key] || '.bin';
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (window.app) return;
    window.app = new LedgerScrollsApp();
});
