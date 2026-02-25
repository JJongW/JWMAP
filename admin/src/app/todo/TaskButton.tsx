'use client';

import { useTransition } from 'react';
import { toggleTask } from './actions';
import type { TaskType } from '@/lib/queries/todo';

interface TaskButtonProps {
  taskType: TaskType;
  label: string;
  date: string;
  completed: boolean;
}

export function TaskButton({ taskType, label, date, completed }: TaskButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => toggleTask(taskType, date, completed))}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
        completed
          ? 'bg-sky-500 text-white hover:bg-sky-600'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
          completed
            ? 'border-white bg-white text-sky-500'
            : 'border-slate-400 dark:border-slate-500'
        }`}
      >
        {completed && '✓'}
      </span>
      {label}
    </button>
  );
}
