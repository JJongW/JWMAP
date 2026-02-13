'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateLocation, createLocation } from '@/lib/queries/locations';
import { updateLocationTags } from '@/lib/queries/tags';
import { locationFormSchema, type LocationFormValues } from '@/schemas/location';
import { mapKakaoCategory, extractRegionFromAddress } from '@/lib/mappings';
import type { Location } from '@/types';
import { PlaceSearch, type PlaceResult } from './PlaceSearch';
import { ImageUpload } from './ImageUpload';
import { CurationLevelSelector } from './CurationLevelSelector';
import { TagSelector } from './TagSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

import { CATEGORY_HIERARCHY, FEATURE_OPTIONS } from '@/lib/constants';

function RequiredMark() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1">
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}

interface Props {
  location?: Location;
  isNew?: boolean;
  allTags?: import('@/types').Tag[];
  locationTags?: import('@/types').LocationTag[];
}

export function LocationForm({ location, isNew, allTags = [], locationTags = [] }: Props) {
  const router = useRouter();
  const firstErrorRef = useRef<HTMLFormElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema) as any,
    defaultValues: location
      ? {
          name: location.name,
          region: location.region,
          sub_region: location.sub_region,
          category_main: location.category_main,
          category_sub: location.category_sub,
          address: location.address,
          lat: location.lat,
          lon: location.lon,
          memo: location.memo,
          short_desc: location.short_desc,
          curation_level: location.curation_level,
          price_level: location.price_level,
          features: location.features ?? {},
          imageUrl: location.imageUrl,
          naver_place_id: location.naver_place_id,
          kakao_place_id: location.kakao_place_id,
          visit_date: location.visit_date,
          curator_visited: location.curator_visited,
          tags: location.tags ?? [],
          event_tags: location.event_tags ?? [],
        }
      : {
          name: '',
          region: '',
          address: '',
          lat: 0,
          lon: 0,
          memo: '',
          features: {},
          imageUrl: '',
          tags: [],
          event_tags: [],
        },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = form;

  const categoryMain = watch('category_main');
  const features = watch('features');
  const subCategories = categoryMain ? CATEGORY_HIERARCHY[categoryMain] ?? [] : [];
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() =>
    locationTags.map((lt) => lt.tag_id)
  );

  // Scroll to first error on submit
  useEffect(() => {
    if (isSubmitted && Object.keys(errors).length > 0) {
      const firstKey = Object.keys(errors)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isSubmitted, errors]);

  // Handle kakao place selection
  function handlePlaceSelect(place: PlaceResult) {
    setValue('name', place.name, { shouldValidate: true });
    setValue('address', place.roadAddress || place.address, { shouldValidate: true });
    setValue('lat', place.lat, { shouldValidate: true });
    setValue('lon', place.lon, { shouldValidate: true });
    setValue('kakao_place_id', place.id);

    // Auto-map region + sub_region from address
    const regionResult = extractRegionFromAddress(place.roadAddress || place.address);
    if (regionResult) {
      if (regionResult.region) {
        setValue('region', regionResult.region, { shouldValidate: true });
      }
      if (regionResult.sub_region) {
        setValue('sub_region', regionResult.sub_region);
      }
    }

    // Auto-map category from kakao categoryDetail (full chain for better matching)
    const mapped = mapKakaoCategory(place.categoryDetail || place.category);
    if (mapped.main) {
      setValue('category_main', mapped.main);
      if (mapped.sub) {
        setValue('category_sub', mapped.sub);
      }
    }
  }

  async function onSubmit(values: LocationFormValues) {
    try {
      const supabase = createClient();
      if (isNew) {
        const created = await createLocation(supabase, values as Omit<Location, 'id' | 'created_at'>);
        if (selectedTagIds.length > 0) {
          await updateLocationTags(supabase, created.id, selectedTagIds);
        }
        toast.success('장소가 추가되었습니다');
        router.push(`/locations/${created.id}`);
      } else if (location) {
        await updateLocation(supabase, location.id, values as Partial<Location>);
        await updateLocationTags(supabase, location.id, selectedTagIds);
        toast.success('저장되었습니다');
        router.refresh();
      }
    } catch (err) {
      toast.error('저장 실패: ' + (err as Error).message);
    }
  }

  function onError() {
    toast.error('필수 항목을 모두 채워주세요');
  }

  function toggleFeature(key: string) {
    const current = features ?? {};
    setValue('features', {
      ...current,
      [key]: !current[key as keyof typeof current],
    });
  }

  // Helper: border color for fields with errors
  function fieldBorder(fieldName: keyof LocationFormValues) {
    return errors[fieldName] ? 'border-red-500 focus-visible:ring-red-500' : '';
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-6" ref={firstErrorRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/locations">
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {isNew ? '장소 추가' : location?.name ?? '편집'}
          </h1>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting ? '저장 중...' : '저장'}
        </Button>
      </div>

      {/* Error summary */}
      {isSubmitted && Object.keys(errors).length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>필수 항목 {Object.keys(errors).length}개가 비어있습니다. 아래 빨간색 표시된 항목을 확인해주세요.</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Place search */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">장소 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <PlaceSearch
              onSelect={handlePlaceSelect}
              placeholder="카카오에서 장소 검색 (이름, 주소, 좌표, 카테고리 자동입력)"
              defaultValue={location?.name}
            />
            {watch('name') && watch('kakao_place_id') && (
              <p className="text-xs text-green-600 mt-2">
                선택됨: {watch('name')} — {watch('address')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div data-field="name">
              <Label>장소명 <RequiredMark /></Label>
              <Input {...register('name')} className={`mt-1 ${fieldBorder('name')}`} />
              <FieldError message={errors.name?.message} />
            </div>
            <div data-field="address">
              <Label>주소 <RequiredMark /></Label>
              <Input {...register('address')} className={`mt-1 ${fieldBorder('address')}`} />
              <FieldError message={errors.address?.message} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div data-field="lat">
                <Label>위도 <RequiredMark /></Label>
                <Input {...register('lat', { valueAsNumber: true })} type="number" step="any" className={`mt-1 ${fieldBorder('lat')}`} />
                <FieldError message={errors.lat?.message} />
              </div>
              <div data-field="lon">
                <Label>경도 <RequiredMark /></Label>
                <Input {...register('lon', { valueAsNumber: true })} type="number" step="any" className={`mt-1 ${fieldBorder('lon')}`} />
                <FieldError message={errors.lon?.message} />
              </div>
            </div>
            <div data-field="region">
              <Label>지역 <RequiredMark /></Label>
              <Input {...register('region')} className={`mt-1 ${fieldBorder('region')}`} placeholder="예: 강남, 홍대 (장소 검색 시 자동입력)" />
              <FieldError message={errors.region?.message} />
            </div>
            <div>
              <Label>세부 지역</Label>
              <Input {...register('sub_region')} className="mt-1" placeholder="예: 역삼동 (장소 검색 시 자동입력)" />
            </div>
          </CardContent>
        </Card>

        {/* Category & Score */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">분류 & 평가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>카테고리 대분류</Label>
              <Controller
                control={control}
                name="category_main"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => {
                      field.onChange(v || null);
                      setValue('category_sub', null);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="선택 (장소 검색 시 자동입력)" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(CATEGORY_HIERARCHY).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>카테고리 소분류</Label>
              <Controller
                control={control}
                name="category_sub"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(v) => field.onChange(v || null)}
                    disabled={subCategories.length === 0}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="선택 (장소 검색 시 자동입력)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div data-field="curation_level">
              <Label>쩝쩝박사 레벨</Label>
              <Controller
                control={control}
                name="curation_level"
                render={({ field }) => (
                  <div className="mt-2">
                    <CurationLevelSelector
                      value={field.value ?? null}
                      onChange={field.onChange}
                    />
                  </div>
                )}
              />
              <FieldError message={errors.curation_level?.message} />
            </div>
            <div>
              <Label>가격대</Label>
              <Controller
                control={control}
                name="price_level"
                render={({ field }) => (
                  <Select
                    value={field.value?.toString() ?? ''}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">$ 저렴</SelectItem>
                      <SelectItem value="2">$$ 보통</SelectItem>
                      <SelectItem value="3">$$$ 비쌈</SelectItem>
                      <SelectItem value="4">$$$$ 고급</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>네이버 Place ID</Label>
                <Input {...register('naver_place_id')} className="mt-1" />
              </div>
              <div>
                <Label>카카오 Place ID</Label>
                <Input {...register('kakao_place_id')} className="mt-1" readOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Image */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">이미지</CardTitle>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <ImageUpload value={field.value} onChange={field.onChange} />
              )}
            />
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">태그</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              기존 태그에서 선택 (클릭하여 추가/해제)
            </p>
            <TagSelector
              allTags={allTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
            />
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">특징</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((f) => {
                const active = features?.[f.key as keyof typeof features];
                return (
                  <Badge
                    key={f.key}
                    variant={active ? 'default' : 'outline'}
                    className="cursor-pointer select-none"
                    onClick={() => toggleFeature(f.key)}
                  >
                    {f.label}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Meta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">메타 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>방문일</Label>
              <Input {...register('visit_date')} type="date" className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="curator_visited"
                {...register('curator_visited')}
                className="rounded"
              />
              <Label htmlFor="curator_visited">큐레이터 방문 확인</Label>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">설명</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>한줄 설명</Label>
              <Input {...register('short_desc')} className="mt-1" placeholder="핵심 한줄 설명" />
            </div>
            <div>
              <Label>메모 (상세)</Label>
              <Textarea {...register('memo')} className="mt-1 min-h-[120px]" placeholder="상세 메모..." />
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
