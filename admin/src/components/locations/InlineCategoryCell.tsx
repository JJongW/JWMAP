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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check } from 'lucide-react';
import { CATEGORY_HIERARCHY, ATTRACTION_CATEGORY_HIERARCHY } from '@/lib/constants';
import type { Location } from '@/types';

interface InlineCategoryCellProps {
  location: Location;
  domain?: 'locations' | 'attractions';
  onSuccess?: () => void;
}

export function InlineCategoryCell({
  location,
  domain = 'attractions',
  onSuccess,
}: InlineCategoryCellProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const hierarchy = domain === 'attractions' ? ATTRACTION_CATEGORY_HIERARCHY : CATEGORY_HIERARCHY;
  const main = location.category_main;
  const sub = location.category_sub;

  const displayText = main ? (sub ? `${main} > ${sub}` : main) : '-';

  async function handleSelect(newMain: string | null, newSub: string | null) {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      const supabase = createClient();
      const table = domain === 'attractions' ? 'attractions' : 'locations';
      await updateLocation(supabase, location.id, {
        category_main: newMain ?? null,
        category_sub: newSub ?? null,
      }, table);
      toast.success('카테고리가 변경되었습니다');
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
          className="h-7 min-w-[100px] max-w-[180px] justify-between gap-1 font-normal text-muted-foreground hover:text-foreground truncate"
          disabled={isUpdating}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] overflow-y-auto">
        <DropdownMenuItem onClick={() => handleSelect(null, null)}>
          <span className="text-muted-foreground">- 미설정</span>
        </DropdownMenuItem>
        {Object.entries(hierarchy).map(([mainKey, subs]) => (
          <DropdownMenuSub key={mainKey}>
            <DropdownMenuSubTrigger>
              {main === mainKey && !sub && <Check className="mr-2 h-4 w-4" />}
              {mainKey}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleSelect(mainKey, null)}>
                {main === mainKey && !sub && <Check className="mr-2 h-4 w-4" />}
                <span className={main === mainKey && !sub ? 'ml-6' : ''}>
                  {mainKey}만 (소분류 없음)
                </span>
              </DropdownMenuItem>
              {subs.map((subKey) => (
                <DropdownMenuItem
                  key={subKey}
                  onClick={() => handleSelect(mainKey, subKey)}
                >
                  {main === mainKey && sub === subKey && <Check className="mr-2 h-4 w-4" />}
                  <span className={main === mainKey && sub === subKey ? 'ml-6' : ''}>
                    {subKey}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
