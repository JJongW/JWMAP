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
import { mapKakaoCategoryByDomain, extractRegionFromAddress } from '@/lib/mappings';
import { parseMapClipboard } from '@/lib/mapClipboardParser';
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

import {
  CATEGORY_HIERARCHY,
  FEATURE_OPTIONS,
  ATTRACTION_CATEGORY_HIERARCHY,
  ATTRACTION_FEATURE_OPTIONS,
} from '@/lib/constants';
import type { LocationDomainTable } from '@/lib/queries/locations';

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
  domain?: LocationDomainTable;
  domainLabel?: string;
  listPath?: string;
  tagDomain?: 'food' | 'space';
}

export function LocationForm({
  location,
  isNew,
  allTags = [],
  locationTags = [],
  domain = 'locations',
  domainLabel = '장소',
  listPath = '/locations',
  tagDomain = domain === 'attractions' ? 'space' : 'food',
}: Props) {
  const router = useRouter();
  const firstErrorRef = useRef<HTMLFormElement>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
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

  const isAttractionDomain = domain === 'attractions';
  const categoryHierarchy = isAttractionDomain ? ATTRACTION_CATEGORY_HIERARCHY : CATEGORY_HIERARCHY;
  const featureOptions = isAttractionDomain ? ATTRACTION_FEATURE_OPTIONS : FEATURE_OPTIONS;
  const curationLabel = isAttractionDomain ? '큐레이션 레벨' : '쩝쩝박사 레벨';
  const priceLabel = isAttractionDomain ? '입장료 레벨' : '가격대';

  const categoryMain = watch('category_main');
  const features = watch('features');
  const subCategories = categoryMain ? categoryHierarchy[categoryMain] ?? [] : [];
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() =>
    locationTags.map((lt) => lt.tag_id)
  );
  const [rawMapText, setRawMapText] = useState('');

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
    const mapped = mapKakaoCategoryByDomain(place.categoryDetail || place.category, domain);
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
        const created = await createLocation(
          supabase,
          values as Omit<Location, 'id' | 'created_at'>,
          domain
        );
        if (selectedTagIds.length > 0) {
          await updateLocationTags(supabase, created.id, selectedTagIds, domain);
        }
        toast.success(`${domainLabel}이(가) 추가되었습니다`);
        router.push(`${listPath}/${created.id}`);
      } else if (location) {
        await updateLocation(supabase, location.id, values as Partial<Location>, domain);
        await updateLocationTags(supabase, location.id, selectedTagIds, domain);
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

  function applyClipboardAssist() {
    const parsed = parseMapClipboard(rawMapText);
    const applied: string[] = [];

    if (parsed.name) {
      setValue('name', parsed.name, { shouldValidate: true });
      applied.push('장소명');
    }
    if (parsed.address) {
      setValue('address', parsed.address, { shouldValidate: true });
      applied.push('주소');

      const regionResult = extractRegionFromAddress(parsed.address);
      if (regionResult?.region) {
        setValue('region', regionResult.region, { shouldValidate: true });
        applied.push('지역');
      }
      if (regionResult?.sub_region) {
        setValue('sub_region', regionResult.sub_region);
        applied.push('세부 지역');
      }
    }
    if (typeof parsed.lat === 'number') {
      setValue('lat', parsed.lat, { shouldValidate: true });
      applied.push('위도');
    }
    if (typeof parsed.lon === 'number') {
      setValue('lon', parsed.lon, { shouldValidate: true });
      applied.push('경도');
    }
    if (parsed.kakao_place_id) {
      setValue('kakao_place_id', parsed.kakao_place_id);
      applied.push('카카오 Place ID');
    }
    if (parsed.naver_place_id) {
      setValue('naver_place_id', parsed.naver_place_id);
      applied.push('네이버 Place ID');
    }
    if (parsed.categoryHint) {
      const mapped = mapKakaoCategoryByDomain(parsed.categoryHint, domain);
      if (mapped.main) {
        setValue('category_main', mapped.main);
        applied.push('카테고리 대분류');
      }
      if (mapped.sub) {
        setValue('category_sub', mapped.sub);
        applied.push('카테고리 소분류');
      }
    }

    if (applied.length === 0) {
      toast.info('추출 가능한 값이 없습니다. 링크/텍스트 형식을 확인해주세요.');
      return;
    }

    toast.success(`빠른 입력 적용 완료: ${applied.join(', ')}`);
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
          <Link href={listPath}>
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {isNew ? `${domainLabel} 추가` : location?.name ?? '편집'}
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

        {/* Clipboard assist */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">빠른 입력 보조 (지도 즐겨찾기 복붙)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              카카오맵/네이버지도에서 복사한 텍스트나 링크를 붙여넣으면 장소명, 주소, 좌표, Place ID를 자동으로 채웁니다.
            </p>
            <Textarea
              value={rawMapText}
              onChange={(e) => setRawMapText(e.target.value)}
              className="min-h-[96px]"
              placeholder="예) 장소명, 주소, 링크(https://map.kakao.com/... 또는 https://map.naver.com/...)"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={applyClipboardAssist}>
                복붙 내용 반영
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRawMapText('')}>
                입력 지우기
              </Button>
            </div>
            <p className="text-xs text-amber-700">
              안내: 자동 추출은 보조 기능입니다. 저장 전 카테고리/좌표/주소를 반드시 확인해주세요.
            </p>
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
                      {Object.keys(categoryHierarchy).map((c) => (
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
              <Label>{curationLabel}</Label>
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
              <Label>{priceLabel}</Label>
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
                      {isAttractionDomain ? (
                        <>
                          <SelectItem value="1">무료</SelectItem>
                          <SelectItem value="2">저가</SelectItem>
                          <SelectItem value="3">보통</SelectItem>
                          <SelectItem value="4">고가</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="1">$ 저렴</SelectItem>
                          <SelectItem value="2">$$ 보통</SelectItem>
                          <SelectItem value="3">$$$ 비쌈</SelectItem>
                          <SelectItem value="4">$$$$ 고급</SelectItem>
                        </>
                      )}
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
              domain={tagDomain}
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
              {featureOptions.map((f) => {
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
