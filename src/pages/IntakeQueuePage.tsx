import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { IntakeQueue } from '../components/intake/IntakeQueue';
import { useSelectedItem } from '../contexts/SelectedItemContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

export function IntakeQueuePage() {
  const { userRole, isOwner } = useWorkspace();
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

  // Intake Queue is admin+/owner only (matches the RLS on intake_submissions).
  if (!(isOwner || userRole === 'admin')) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-500">Only admins and owners can access the intake queue.</p>
          </div>
        </div>
      </div>
    );
  }

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
