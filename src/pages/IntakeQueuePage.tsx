import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { IntakeQueue } from '../components/intake/IntakeQueue';
import { useSelectedItem } from '../contexts/SelectedItemContext';

export function IntakeQueuePage() {
  const { setSelectedItemId } = useSelectedItem();
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link: /intake-queue?item=<id> opens the DetailSlideOver
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (itemId) {
      setSelectedItemId(itemId);
      // Clean URL after opening
      searchParams.delete('item');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, setSelectedItemId]);

  return (
    <IntakeQueue
      addToast={(msg, type = 'success') => {
        if (type === 'error') toast.error(msg);
        else if (type === 'info') toast(msg);
        else toast.success(msg);
      }}
      onOpenItem={(itemId) => setSelectedItemId(itemId)}
    />
  );
}
