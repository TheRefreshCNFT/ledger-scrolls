import { useState, useMemo, useCallback, useEffect } from 'react';
import { BlockchainClient } from '../utils/blockchain.js';
import { ScrollReconstructor } from '../utils/reconstruct.js';
import { getAllScrolls } from '../utils/scrolls.js';
import { RegistryResolver } from '../utils/registry.js';

export function useBlockchain() {
  const [client] = useState(() => new BlockchainClient('koios', null, 'https://koios.beacn.workers.dev'));
  const [reconstructor] = useState(() => new ScrollReconstructor(client));
  const [resolver] = useState(() => new RegistryResolver());

  const [library, setLibrary] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState(null);
  const [registryCount, setRegistryCount] = useState(0);
  
  const [loadingScroll, setLoadingScroll] = useState(false);
  const [scrollData, setScrollData] = useState(null);
  const [scrollProgress, setScrollProgress] = useState({ message: '', percent: 0 });
  const [scrollError, setScrollError] = useState(null);

  useEffect(() => {
    const hardcoded = getAllScrolls();
    setLibrary(hardcoded);

    // Test connection and resolve registry in parallel
    client.testConnection().then(res => {
      setIsOnline(res.success);
    }).catch(() => setIsOnline(false));

    setRegistryLoading(true);
    setRegistryError(null);
    resolver.resolve(client).then(discovered => {
      const merged = resolver.mergeScrolls(discovered, hardcoded);
      setLibrary(merged);
      setRegistryCount(discovered.length);
      setRegistryLoading(false);
    }).catch(e => {
      setRegistryError(e.message || String(e));
      setRegistryLoading(false);
    });

  }, [client, resolver]);

  useEffect(() => {
    reconstructor.setProgressCallback((msg, pct) => {
      setScrollProgress({ message: msg, percent: pct });
    });
  }, [reconstructor]);

  const loadScroll = useCallback(async (scroll) => {
    setLoadingScroll(true);
    setScrollError(null);
    setScrollData(null);
    setScrollProgress({ message: 'Initializing...', percent: 0 });

    try {
      const result = await reconstructor.reconstruct(scroll);
      
      if (result.contentType === 'text/html') {
        const textDecoder = new TextDecoder();
        const htmlStr = textDecoder.decode(result.data);
        const blob = new Blob([htmlStr], { type: 'text/html' });
        result.renderUrl = URL.createObjectURL(blob);
      } else if (result.contentType.startsWith('image/')) {
        const blob = new Blob([result.data], { type: result.contentType });
        result.renderUrl = URL.createObjectURL(blob);
      } else if (result.contentType.startsWith('video/')) {
        const blob = new Blob([result.data], { type: result.contentType });
        result.renderUrl = URL.createObjectURL(blob);
      } else {
        const textDecoder = new TextDecoder();
        result.renderText = textDecoder.decode(result.data);
      }

      setScrollData(result);
    } catch (err) {
      console.error(err);
      setScrollError(err.message || String(err));
    } finally {
      setLoadingScroll(false);
    }
  }, [reconstructor]);

  const cancelLoading = useCallback(() => {
    reconstructor.abort();
    setLoadingScroll(false);
    setScrollProgress({ message: 'Aborted', percent: 0 });
  }, [reconstructor]);

  return {
    library,
    loadingList,
    isOnline,
    registryLoading,
    registryError,
    registryCount,
    loadScroll,
    cancelLoading,
    loadingScroll,
    scrollData,
    scrollProgress,
    scrollError
  };
}
