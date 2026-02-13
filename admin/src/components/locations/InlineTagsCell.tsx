'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createTag, updateLocationTags } from '@/lib/queries/tags';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Check, Plus } from 'lucide-react';
import type { Location, Tag, LocationTag } from '@/types';

interface InlineTagsCellProps {
  location: Location;
  locationTags: LocationTag[];
  allTags: Tag[];
  onSuccess?: () => void;
}

export function InlineTagsCell({
  location,
  locationTags,
  allTags,
  onSuccess,
}: InlineTagsCellProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [open, setOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [localTags, setLocalTags] = useState<Tag[]>([]);

  const selectedTagIds = new Set(locationTags.map((lt) => lt.tag_id));
  const tagsToShow = [...allTags, ...localTags.filter((t) => !allTags.some((a) => a.id === t.id))].sort(
    (a, b) => a.name.localeCompare(b.name, 'ko-KR')
  );

  // Use location.tags (string[]) for display
  const displayTags = (location.tags ?? []).slice().sort((a, b) => a.localeCompare(b, 'ko-KR'));

  async function handleToggleTag(tagId: string) {
    if (isUpdating) return;
    const newIds = selectedTagIds.has(tagId)
      ? [...selectedTagIds].filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    setIsUpdating(true);
    try {
      const supabase = createClient();
      await updateLocationTags(supabase, location.id, newIds);
      toast.success('태그가 변경되었습니다');
      onSuccess?.();
      router.refresh();
    } catch (err) {
      toast.error('변경 실패: ' + (err as Error).message);
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAddNewTag() {
    const name = newTagName.trim();
    if (!name || isUpdating) return;

    const existing = tagsToShow.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      handleToggleTag(existing.id);
      setNewTagName('');
      return;
    }

    setIsUpdating(true);
    try {
      const supabase = createClient();
      const created = await createTag(supabase, name);
      setLocalTags((prev) => [...prev, created]);
      const newIds = [...selectedTagIds, created.id];
      await updateLocationTags(supabase, location.id, newIds);
      toast.success(`"${created.name}" 태그 추가`);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg.includes('duplicate') || msg.includes('unique') ? '이미 같은 태그가 있습니다' : '추가 실패: ' + msg);
    } finally {
      setIsUpdating(false);
      setNewTagName('');
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto min-h-[28px] min-w-[80px] justify-between gap-1 px-2 py-1 font-normal text-muted-foreground hover:text-foreground"
          disabled={isUpdating}
        >
          {displayTags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {displayTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[11px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </span>
          ) : (
            <span>-</span>
          )}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] w-56 overflow-y-auto">
        <div className="max-h-[220px] overflow-y-auto">
          {tagsToShow.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              태그 없음. 아래에서 새로 추가
            </div>
          ) : (
            tagsToShow.map((tag) => {
              const isSelected = selectedTagIds.has(tag.id);
              return (
                <DropdownMenuItem
                  key={tag.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleToggleTag(tag.id);
                  }}
                >
                  {isSelected ? <Check className="mr-2 h-4 w-4 shrink-0" /> : null}
                  <span className={isSelected ? '' : 'ml-6'}>{tag.name}</span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <div className="border-t p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Input
            placeholder="새 태그"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewTag())}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleAddNewTag}
            disabled={!newTagName.trim() || isUpdating}
          >
            <Plus className="h-3 w-3 mr-1" />
            추가
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
