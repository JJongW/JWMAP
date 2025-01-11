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
        'relative px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform',
        'flex items-center gap-2 shadow-md',
        isActive
          ? 'bg-blue-600 text-white scale-100 active:scale-95'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300 active:scale-95'
      )}
    >
      {/* 카테고리 이름 */}
      <span className="truncate">{category}</span>

      {/* 카운트 표시 */}
      <span
        className={clsx(
          'inline-flex items-center justify-center min-w-[1.5rem] min-h-[1.5rem] sm:min-w-[1.75rem] sm:min-h-[1.75rem]', // 최소 크기 지정
          'text-[10px] sm:text-xs font-bold rounded-full leading-none', // 숫자가 중앙에 정렬되도록 leading-none
          isActive
            ? 'bg-white text-blue-500 shadow'
            : 'bg-gray-200 text-gray-600'
        )}
      >
        {count}
      </span>
    </button>
  );
}
