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
      className={`flex min-h-[88px] w-full flex-col items-center justify-center gap-2 rounded-xl p-3 text-center transition-colors disabled:opacity-60 ${
        completed
          ? 'bg-sky-500 text-white hover:bg-sky-600'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${
          completed
            ? 'border-white bg-white text-sky-500'
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        {completed ? '✓' : ''}
      </span>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </button>
  );
}
