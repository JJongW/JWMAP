'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createTag } from '@/lib/queries/tags';
import { Plus } from 'lucide-react';
import type { Tag } from '@/types';

interface TagSelectorProps {
  allTags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  className?: string;
}

/** 기존 태그에서 선택 + 새 태그 추가 가능 */
export function TagSelector({
  allTags,
  selectedTagIds,
  onChange,
  className,
}: TagSelectorProps) {
  const [localTags, setLocalTags] = useState<Tag[]>(allTags);
  const [newTagName, setNewTagName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);
  const tagsToShow = useMemo(() => {
    const ids = new Set(allTags.map((t) => t.id));
    const extra = localTags.filter((t) => !ids.has(t.id));
    return [...allTags, ...extra].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
  }, [allTags, localTags]);

  function toggle(tagId: string) {
    if (selectedSet.has(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  }

  async function handleAddNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    if (isAdding) return;

    const existing = tagsToShow.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      toggle(existing.id);
      setNewTagName('');
      return;
    }

    setIsAdding(true);
    try {
      const supabase = createClient();
      const created = await createTag(supabase, name);
      setLocalTags((prev) => [...prev, created]);
      onChange([...selectedTagIds, created.id]);
      setNewTagName('');
      toast.success(`"${created.name}" 태그가 추가되었습니다`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('이미 같은 이름의 태그가 있습니다');
      } else {
        toast.error('태그 추가 실패: ' + msg);
      }
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap gap-2">
        {tagsToShow.map((tag) => {
          const isSelected = selectedSet.has(tag.id);
          return (
            <Badge
              key={tag.id}
              variant={isSelected ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggle(tag.id)}
            >
              {tag.name}
            </Badge>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="새 태그 추가"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewTag())}
          className="max-w-[200px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddNewTag}
          disabled={!newTagName.trim() || isAdding}
        >
          <Plus className="h-4 w-4 mr-1" />
          추가
        </Button>
      </div>
    </div>
  );
}
