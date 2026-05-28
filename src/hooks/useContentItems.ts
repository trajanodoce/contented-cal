import { useApp } from '../contexts/AppContext';
import type { ContentItem } from '../lib/database.types';

interface UseContentItemsReturn {
  items: ContentItem[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useContentItems(): UseContentItemsReturn {
  const { contentItems, contentItemsLoading, refreshContentItems } = useApp();
  return {
    items: contentItems,
    loading: contentItemsLoading,
    error: null,
    refetch: refreshContentItems,
  };
}
