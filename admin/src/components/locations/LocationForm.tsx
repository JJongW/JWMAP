'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { updateLocation, createLocation } from '@/lib/queries/locations';
import { updateLocationTags } from '@/lib/queries/tags';
import { locationFormSchema, type LocationFormInput, type LocationFormValues } from '@/schemas/location';
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
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

import {
  CATEGORY_HIERARCHY,
  ATTRACTION_CATEGORY_HIERARCHY,
} from '@/lib/constants';
import type { LocationDomainTable } from '@/lib/queries/locations';

const SHORT_MAP_HOSTS = new Set(['kko.to', 'naver.me']);
const KAKAO_PLACE_URL_REGEX = /place\.map\.kakao\.com\/\d{4,}/i;
const NAVER_PLACE_URL_REGEX = /(?:map\.naver\.com|m\.place\.naver\.com).*\/place\/\d{4,}/i;

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

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

function mergeMemo(existingMemo: string | undefined, lines: string[]): string {
  const base = (existingMemo ?? '').trim();
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  if (cleanLines.length === 0) return base;

  const block = ['[카카오맵 수집 메모]', ...cleanLines].join('\n');
  if (!base) return block;
  if (base.includes('[카카오맵 수집 메모]')) return base;
  return `${base}\n\n${block}`;
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

interface ResolvedShortMapUrl {
  finalUrl: string;
  title?: string | null;
  description?: string | null;
  kakaoPlaceId?: string | null;
}

interface PlaceDetailPayload {
  name: string;
  address: string;
  lat: number;
  lon: number;
  region: string;
  sub_region: string | null;
  category_main: string | null;
  category_sub: string | null;
  kakao_place_id?: string | null;
  naver_place_id?: string | null;
  imageUrl: string;
  tags: string[];
  short_desc: string | null;
  memo: string | null;
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

  const form = useForm<LocationFormInput, unknown, LocationFormValues>({
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
  const curationLabel = '추천 강도';
  const priceLabel = isAttractionDomain ? '입장료 레벨' : '가격대';

  const categoryMain = watch('category_main');
  const subCategories = categoryMain ? categoryHierarchy[categoryMain] ?? [] : [];
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() =>
    locationTags.map((lt) => lt.tag_id)
  );
  const [rawMapText, setRawMapText] = useState('');
  const [isResolvingMapLink, setIsResolvingMapLink] = useState(false);

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

  async function resolveShortMapUrls(urls: string[]): Promise<ResolvedShortMapUrl[]> {
    const shortUrls = urls.filter((url) => {
      const host = getHostname(url);
      return host ? SHORT_MAP_HOSTS.has(host) : false;
    });

    if (shortUrls.length === 0) return [];

    const results = await Promise.allSettled(
      shortUrls.map(async (url) => {
        const response = await fetch(`/api/map-link/expand?url=${encodeURIComponent(url)}`);
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          finalUrl?: string;
          title?: string | null;
          description?: string | null;
          kakaoPlaceId?: string | null;
        };
        if (!payload.finalUrl) return null;
        return {
          finalUrl: payload.finalUrl,
          title: payload.title,
          description: payload.description,
          kakaoPlaceId: payload.kakaoPlaceId,
        };
      })
    );

    return results.flatMap((result) => {
      if (result.status !== 'fulfilled' || !result.value) return [];
      return [result.value];
    });
  }

  async function applyClipboardAssist() {
    if (!rawMapText.trim()) {
      toast.info('먼저 지도 링크/텍스트를 붙여넣어 주세요.');
      return;
    }

    setIsResolvingMapLink(true);
    try {
      const firstParsed = parseMapClipboard(rawMapText);
      const expandedUrls = await resolveShortMapUrls(firstParsed.sourceUrls);

      // place URL 수집 (카카오 + 네이버, 원본 + 단축 링크 확장 결과)
      const isKakaoPlace = (u: string) => KAKAO_PLACE_URL_REGEX.test(u);
      const isNaverPlace = (u: string) => NAVER_PLACE_URL_REGEX.test(u);
      const placeUrls = [
        ...firstParsed.sourceUrls.filter((u) => isKakaoPlace(u) || isNaverPlace(u)),
        ...expandedUrls.map((e) => e.finalUrl).filter((u) => isKakaoPlace(u) || isNaverPlace(u)),
      ];
      const uniquePlaceUrls = Array.from(new Set(placeUrls));
      const firstPlaceUrl = uniquePlaceUrls[0];
      const isNaver = firstPlaceUrl ? isNaverPlace(firstPlaceUrl) : false;

      // place URL이 있으면 place-detail API로 전체 필드 자동 채우기
      if (firstPlaceUrl) {
        const apiPath = isNaver
          ? `/api/map-link/place-detail-naver?url=${encodeURIComponent(firstPlaceUrl)}`
          : `/api/map-link/place-detail?url=${encodeURIComponent(firstPlaceUrl)}&domain=${domain}`;
        const res = await fetch(apiPath);
        if (res.ok) {
          const payload = (await res.json()) as PlaceDetailPayload;
          const applied: string[] = [];

          setValue('name', payload.name, { shouldValidate: true });
          applied.push('장소명');
          setValue('address', payload.address, { shouldValidate: true });
          applied.push('주소');
          setValue('lat', payload.lat, { shouldValidate: true });
          applied.push('위도');
          setValue('lon', payload.lon, { shouldValidate: true });
          applied.push('경도');
          if (payload.region) {
            setValue('region', payload.region, { shouldValidate: true });
            applied.push('지역');
          }
          if (payload.sub_region) {
            setValue('sub_region', payload.sub_region);
            applied.push('세부 지역');
          }
          if (payload.kakao_place_id) {
            setValue('kakao_place_id', payload.kakao_place_id);
            applied.push('카카오 Place ID');
          }
          if (payload.naver_place_id) {
            setValue('naver_place_id', payload.naver_place_id);
            applied.push('네이버 Place ID');
          }
          if (payload.category_main) {
            setValue('category_main', payload.category_main);
            applied.push('장소 종류');
          }
          if (payload.category_sub) {
            setValue('category_sub', payload.category_sub);
            applied.push('세부 종류');
          }
          if (payload.imageUrl) {
            setValue('imageUrl', payload.imageUrl);
            applied.push('이미지');
          }

          // 붙여넣은 텍스트에서 리뷰·해시태그 추출 후 place-detail 결과와 병합
          const pasted = firstParsed;
          const memoParts: string[] = [];
          const isAddressLike = (s: string) =>
            /서울|경기|인천|부산|^\d|동\s|구\s|로\s|길\s/.test(s) || s.length < 20;

          // 추천하는 이유(short_desc)는 운영자가 직접 쓴 글만 담는다.
          // 지도 페이지의 소개·후기는 다른 사람의 글이라 자동으로 넣지 않고, 아래 메모에 참고 정보로만 남긴다.
          if (payload.short_desc && !isAddressLike(payload.short_desc)) {
            memoParts.push(`- 지도 소개: ${payload.short_desc}`);
          }

          // 메모: place-detail 내용 + 복붙 리뷰·해시태그 병합
          if (payload.memo) memoParts.push(...payload.memo.split('\n').filter(Boolean));
          if (pasted.reviewSnippets.length > 0) {
            memoParts.push(...pasted.reviewSnippets.map((s) => `- 리뷰: ${s}`));
          }
          if (pasted.hashtags.length > 0) {
            memoParts.push(`- 해시태그: #${pasted.hashtags.join(' #')}`);
          }
          if (memoParts.length > 0) {
            const mergedMemo = mergeMemo(watch('memo'), memoParts);
            setValue('memo', mergedMemo, { shouldValidate: true });
            applied.push('메모');
          }

          // 태그: place-detail + 복붙 해시태그 병합
          const allTagNames = [...new Set([...payload.tags, ...pasted.hashtags])];
          if (allTagNames.length > 0) {
            const matchedIds = allTagNames
              .map((name) => allTags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id)
              .filter((id): id is string => !!id);
            if (matchedIds.length > 0) {
              setSelectedTagIds((prev) => Array.from(new Set([...prev, ...matchedIds])));
              applied.push('태그');
            }
          }

          toast.success(`빠른 입력 적용 완료: ${applied.join(', ')}`);
          return;
        }
      }

      // place URL 없거나 API 실패 시 기존 parseMapClipboard 플로우
      const expandedHints = expandedUrls
        .map((entry) =>
          [
            entry.finalUrl,
            entry.title ? `장소명: ${entry.title}` : null,
            entry.description ? `설명: ${entry.description}` : null,
            entry.kakaoPlaceId ? `kakao_place_id: ${entry.kakaoPlaceId}` : null,
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n');
      const mergedText = expandedHints ? `${rawMapText}\n${expandedHints}` : rawMapText;
      const parsed = parseMapClipboard(mergedText);
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
      const categorySource = parsed.categoryRaw ?? parsed.categoryHint;
      if (categorySource) {
        const mapped = mapKakaoCategoryByDomain(categorySource, domain);
        if (mapped.main) {
          setValue('category_main', mapped.main);
          applied.push('장소 종류');
        }
        if (mapped.sub) {
          setValue('category_sub', mapped.sub);
          applied.push('세부 종류');
        }
      }

      const memoLines: string[] = [];
      if (typeof parsed.rating === 'number') memoLines.push(`- 카맵 평점: ${parsed.rating.toFixed(1)}`);
      if (typeof parsed.reviewCount === 'number') memoLines.push(`- 카맵 후기 수: ${parsed.reviewCount}`);
      if (parsed.websiteUrl) memoLines.push(`- 공식 URL: ${parsed.websiteUrl}`);
      if (parsed.nearbyTransit) memoLines.push(`- 대중교통: ${parsed.nearbyTransit}`);
      if (parsed.hashtags.length > 0) memoLines.push(`- 해시태그: ${parsed.hashtags.join(' ')}`);
      if (parsed.reviewSnippets.length > 0) {
        for (const snippet of parsed.reviewSnippets.slice(0, 2)) {
          memoLines.push(`- 리뷰 메모: ${snippet}`);
        }
      }

      if (memoLines.length > 0) {
        const mergedMemo = mergeMemo(watch('memo'), memoLines);
        setValue('memo', mergedMemo, { shouldValidate: true });
        applied.push('메모 보강');
      }

      if (applied.length === 0) {
        toast.info('추출 가능한 값이 없습니다. 링크/텍스트 형식을 확인해주세요.');
        return;
      }

      toast.success(`빠른 입력 적용 완료: ${applied.join(', ')}`);
    } catch {
      toast.error('링크 해석 중 오류가 발생했습니다. 링크를 다시 확인해주세요.');
    } finally {
      setIsResolvingMapLink(false);
    }
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
              카카오맵(place.map.kakao.com) 또는 네이버지도(map.naver.com/place) 링크만 붙여넣어도 장소명·주소·위도·경도·지역·Place ID·이미지·태그가 채워지고, 영업시간·후기 같은 내용은 메모에 참고 정보로 들어가요. 추천하는 이유는 자동으로 채우지 않아요. 직접 적어 주세요.
            </p>
            <Textarea
              value={rawMapText}
              onChange={(e) => setRawMapText(e.target.value)}
              className="min-h-[96px]"
              placeholder="예) 장소명, 주소, 링크(https://map.kakao.com/... 또는 https://map.naver.com/...)"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => void applyClipboardAssist()} disabled={isResolvingMapLink}>
                {isResolvingMapLink ? '링크 해석 중...' : '복붙 내용 반영'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRawMapText('')}>
                입력 지우기
              </Button>
            </div>
            <p className="text-xs text-amber-700">
              안내: 자동 추출은 보조 기능이에요. 저장 전에 장소 종류·좌표·주소를 꼭 확인해 주세요.
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
            <CardTitle className="text-base">장소 종류와 추천 강도</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>장소 종류</Label>
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
              <Label>세부 종류</Label>
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
              <p className="mt-0.5 text-xs text-muted-foreground">
                사용자 화면 배지는 &lsquo;제가 직접 가본 곳이에요&rsquo;에 체크한 곳에만 붙어요. 3단계 운영자 추천, 4단계 이상 대표픽.
              </p>
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
            <CardTitle className="text-base">사진</CardTitle>
          </CardHeader>
          <CardContent>
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <ImageUpload value={field.value ?? ''} onChange={field.onChange} />
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
              추천하는 이유·이런 때 잘 맞아요·방문 정보(주차·예약 등)에 맞는 태그를 골라요. 여러 개 고를 수 있어요.
            </p>
            <TagSelector
              allTags={allTags}
              selectedTagIds={selectedTagIds}
              onChange={setSelectedTagIds}
              domain={tagDomain}
            />
          </CardContent>
        </Card>

        {/* Meta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">직접 가본 기록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="curator_visited"
                  {...register('curator_visited')}
                  className="rounded"
                />
                <Label htmlFor="curator_visited">제가 직접 가본 곳이에요</Label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                체크하지 않으면 사용자 화면에 &lsquo;아직 안 가본 후보&rsquo;로 보이고 추천 강도 배지가 붙지 않아요.
              </p>
            </div>
            <div>
              <Label>가본 날</Label>
              <Input {...register('visit_date')} type="date" className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">정확한 날짜를 모르면 비워 두세요.</p>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">추천하는 이유와 메모</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>추천하는 이유</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                직접 가서 좋았던 점을 문장으로 적어 주세요. 사용자 화면에 그대로 보여요. 주소나 다른 사람의 후기는 넣지 마세요.
              </p>
              <Textarea
                {...register('short_desc')}
                className="mt-1 min-h-[72px]"
                placeholder="예: 커피가 진하고 창가 자리가 넓어서 평일 오후에 작업하기 편해요"
              />
            </div>
            <div>
              <Label>직접 가본 메모 · 참고 정보</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                먹은 것·본 것·아쉬운 점처럼 직접 겪은 내용을 적어요. 빠른 입력이 채운 영업시간·후기·해시태그는 사용자 화면에 &lsquo;참고 정보 (운영자 확인 전)&rsquo;로 보여요.
              </p>
              <Textarea {...register('memo')} className="mt-1 min-h-[120px]" placeholder="예: 버터치킨커리를 먹었어요. 점심엔 20분 정도 기다렸어요." />
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
