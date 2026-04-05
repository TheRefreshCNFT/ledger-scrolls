import React, { useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ViewerArea from './components/ViewerArea';
import Drawers from './components/Drawers';
import { useBlockchain } from './hooks/useBlockchain';

function App() {
  const [activeDrawer, setActiveDrawer] = useState(null); // 'library', 'settings', 'about'
  const [currentScrollMeta, setCurrentScrollMeta] = useState(null);
  
  const {
    library,
    loadScroll,
    cancelLoading,
    loadingScroll,
    scrollData,
    scrollProgress,
    scrollError,
    isOnline,
    registryLoading,
    registryError,
    registryCount
  } = useBlockchain();

  const handleOpenDrawer = (drawerName) => {
    setActiveDrawer(drawerName);
  };

  const handleCloseDrawer = () => {
    setActiveDrawer(null);
  };

  const handleSelectScroll = (scroll) => {
    setCurrentScrollMeta(scroll);
    setActiveDrawer(null);
    loadScroll(scroll);
  };

  const handleBack = () => {
    setCurrentScrollMeta(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-primary)] relative">
      <Header isOnline={isOnline} />
      
      <ViewerArea 
        currentScroll={currentScrollMeta} 
        onBack={handleBack}
        loadingScroll={loadingScroll}
        scrollData={scrollData}
        scrollProgress={scrollProgress}
        scrollError={scrollError}
        cancelLoading={cancelLoading}
      />

      <BottomNav onOpenDrawer={handleOpenDrawer} />

      <Drawers
        activeDrawer={activeDrawer}
        onClose={handleCloseDrawer}
        library={library}
        onSelectScroll={handleSelectScroll}
        registryLoading={registryLoading}
        registryError={registryError}
        registryCount={registryCount}
      />
    </div>
  );
}

export default App;
