import { Folder } from 'lucide-react';

export function ProjectsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Folder className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Projects</h2>
          <p className="text-slate-500">Coming soon - Organize content into projects.</p>
        </div>
      </div>
    </div>
  );
}
