import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ContentItem }  from '../lib/database.types';

interface SelectedItemContextType {
  selectedItemId: string | null;
  selectedItem: ContentItem | null;
  setSelectedItemId: (id: string | null) => void;
  setSelectedItem: (item: ContentItem | null) => void;
  closePanel: () => void;
}

const SelectedItemContext = createContext<SelectedItemContextType | undefined>(undefined);

export function SelectedItemProvider({ children }: { children: React.ReactNode }) {
  const [selectedItemId, setSelectedItemIdState] = useState<string | null>(null);
  const [selectedItem, setSelectedItemState] = useState<ContentItem | null>(null);

  const setSelectedItemId = useCallback((id: string | null) => {
    setSelectedItemIdState(id);
    if (id === null) {
      setSelectedItemState(null);
    }
  }, []);

  const setSelectedItem = useCallback((item: ContentItem | null) => {
    setSelectedItemState(item);
    if (item) {
      setSelectedItemIdState(item.id);
    } else {
      setSelectedItemIdState(null);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelectedItemIdState(null);
    setSelectedItemState(null);
  }, []);

  return (
    <SelectedItemContext.Provider
      value={{
        selectedItemId,
        selectedItem,
        setSelectedItemId,
        setSelectedItem,
        closePanel,
      }}
    >
      {children}
    </SelectedItemContext.Provider>
  );
}

export function useSelectedItem() {
  const context = useContext(SelectedItemContext);
  if (context === undefined) {
    throw new Error('useSelectedItem must be used within a SelectedItemProvider');
  }
  return context;
}
