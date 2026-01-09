import React from 'react';
import { clsx } from 'clsx';
import type { Category } from '../types/location';

interface CategoryButtonProps {
  category: Category | string;
  isActive: boolean;
  onClick: () => void;
  count: number;
}

export function CategoryButton({ category, isActive, onClick, count }: CategoryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
        'flex items-center gap-2',
        isActive
          ? 'bg-orange-500 text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      )}
    >
      <span>{category}</span>
      <span
        className={clsx(
          'px-2 py-0.5 text-xs font-semibold rounded-lg',
          isActive
            ? 'bg-orange-400 text-white'
            : 'bg-gray-200 text-gray-500'
        )}
      >
        {count}
      </span>
    </button>
  );
}
