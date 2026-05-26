import { useParams } from 'react-router-dom';
import { IntakePage } from '../components/intake/IntakePage';

export function IntakeFormPage() {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Invalid form link.</p>
      </div>
    );
  }

  return <IntakePage slug={slug} />;
}
