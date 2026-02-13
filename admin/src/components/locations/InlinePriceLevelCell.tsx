'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateLocation } from '@/lib/queries/locations';
import { PRICE_OPTIONS } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import type { Location } from '@/types';

interface InlinePriceLevelCellProps {
  location: Location;
  onSuccess?: () => void;
}

export function InlinePriceLevelCell({ location, onSuccess }: InlinePriceLevelCellProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const value = location.price_level;
  const label = value ? PRICE_OPTIONS.find((o) => o.value === value)?.label ?? '-' : '-';

  async function handleSelect(level: number | null) {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const supabase = createClient();
      await updateLocation(supabase, location.id, { price_level: level ?? null });
      toast.success('가격대가 변경되었습니다');
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
          className="h-7 min-w-[60px] justify-between gap-1 font-normal text-muted-foreground hover:text-foreground"
          disabled={isUpdating}
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          <span className="text-muted-foreground">- 미설정</span>
        </DropdownMenuItem>
        {PRICE_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => handleSelect(opt.value)}>
            {value === opt.value && <Check className="mr-2 h-4 w-4" />}
            <span className={value === opt.value ? 'ml-6' : ''}>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
