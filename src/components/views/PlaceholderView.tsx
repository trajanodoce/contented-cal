import React from 'react';
import { Calendar, Kanban, FolderOpen } from 'lucide-react';

type ViewType = 'calendar' | 'board' | 'projects';

interface Props {
  view: ViewType;
}

const configs: Record<ViewType, { icon: React.ElementType; title: string; description: string; color: string }> = {
  calendar: {
    icon: Calendar,
    title: 'Calendar View',
    description: 'Visualize your content on a monthly, weekly, or daily calendar. Drag and drop to reschedule.',
    color: 'text-brand-500',
  },
  board: {
    icon: Kanban,
    title: 'Board View',
    description: 'Drag and drop content items across your workflow columns in a Kanban-style board.',
    color: 'text-green-500',
  },
  projects: {
    icon: FolderOpen,
    title: 'Projects',
    description: 'Group content items into campaigns and projects. Track progress and manage timelines.',
    color: 'text-orange-500',
  },
};

export function PlaceholderView({ view }: Props) {
  const config = configs[view];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-center px-4">
      <div className={`w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 ${config.color}`}>
        <Icon className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">{config.title}</h2>
      <p className="text-gray-500 max-w-sm text-sm leading-relaxed">{config.description}</p>
      <span className="mt-4 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-medium">Coming in Phase 2</span>
    </div>
  );
}
