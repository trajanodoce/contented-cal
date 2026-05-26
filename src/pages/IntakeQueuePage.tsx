import { toast } from 'sonner';
import { IntakeQueue } from '../components/intake/IntakeQueue';

export function IntakeQueuePage() {
  return (
    <IntakeQueue
      addToast={(msg, type = 'success') => {
        if (type === 'error') toast.error(msg);
        else if (type === 'info') toast(msg);
        else toast.success(msg);
      }}
    />
  );
}
