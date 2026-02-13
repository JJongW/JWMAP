'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateLocation } from '@/lib/queries/locations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import { getCurationLabel, CURATION_LEVELS } from './CurationLevelSelector';
import type { Location } from '@/types';

interface InlineCurationLevelCellProps {
  location: Location;
  onSuccess?: () => void;
}

export function InlineCurationLevelCell({ location, onSuccess }: InlineCurationLevelCellProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const value = location.curation_level;

  async function handleSelect(level: number | null) {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const supabase = createClient();
      await updateLocation(supabase, location.id, { curation_level: level ?? null });
      toast.success('큐레이션이 변경되었습니다');
      onSuccess?.();
      router.refresh();
    } catch (err) {
      toast.error('변경 실패: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 min-w-[72px] justify-between gap-1 font-normal text-muted-foreground hover:text-foreground"
          disabled={isUpdating}
        >
          {value ? getCurationLabel(value) : '-'}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          <span className="text-muted-foreground">- 미설정</span>
        </DropdownMenuItem>
        {CURATION_LEVELS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => handleSelect(opt.value)}>
            {value === opt.value && <Check className="mr-2 h-4 w-4" />}
            <span className={value === opt.value ? 'ml-6' : ''}>
              Lv.{opt.value} {opt.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
