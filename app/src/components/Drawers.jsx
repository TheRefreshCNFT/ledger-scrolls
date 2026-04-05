import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LibraryDrawer from './LibraryDrawer';

export default function Drawers({ activeDrawer, onClose, library, onSelectScroll, registryLoading, registryError, registryCount }) {
  if (!activeDrawer) return null;

  const getTitle = () => {
    switch(activeDrawer) {
      case 'library': return '📚 The Library';
      case 'settings': return '⚙️ Settings';
      case 'about': return '📜 About';
      default: return '';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-end">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        {/* Drawer Panel */}
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full md:w-[400px] h-full bg-[var(--bg-panel)] border-l border-[var(--border-glass)] flex flex-col shadow-2xl"
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-glass)]">
            <h3 className="text-xl font-semibold tracking-wide text-[var(--text-primary)]">{getTitle()}</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col text-[var(--text-primary)]">
            {activeDrawer === 'library' && (
              <LibraryDrawer
                library={library}
                onSelect={onSelectScroll}
                registryLoading={registryLoading}
                registryError={registryError}
                registryCount={registryCount}
              />
            )}
            
            {activeDrawer === 'about' && (
              <div className="flex flex-col items-center flex-1 justify-center text-center">
                 <div className="text-6xl mb-4">📜</div>
                 <h2 className="text-2xl font-semibold mb-2">Ledger Scrolls</h2>
                 <p className="text-[var(--text-muted)] italic mb-6">A Library That Cannot Burn</p>
                 <p className="mb-4">React + Vite + Tailwind</p>
                 <p className="text-sm opacity-60">Created by BEACNpool</p>
              </div>
            )}

            {activeDrawer === 'settings' && (
              <div className="flex flex-col flex-1 items-center justify-center text-[var(--text-muted)]">
                 <p className="italic">Settings config under construction.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
