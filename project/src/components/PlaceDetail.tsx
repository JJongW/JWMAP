import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Copy, Check, Navigation, ExternalLink, Share2, Heart, CheckCircle2 } from 'lucide-react';
import type { Location, Review } from '../types/location';
import { curationApi, reviewApi, searchLogApi, type PlaceCuration } from '../utils/supabase';
import { getDetailImageUrl } from '../utils/image';
import { shareToKakao } from '../utils/kakaoShare';
import { ProofBar } from './ProofBar';
import { RECOMMEND_BADGES, VISIT_STATUS_LABEL, isFirstHandMemo, getCuratorReason, getVisitInfoText, isCuratorVisited, isPracticalInfoTag } from '../utils/curation';
import { describePlace } from '../utils/taxonomy';
import { RecommendBadge } from './RecommendBadge';
import { recordActivity, toggleSaved, toggleVisited, getSavedIds, getVisitedIds } from '../utils/activity';
import { PriceLevelBadge } from './PriceLevelBadge';
import { CommunityReviews } from './CommunityReviews';
import { AddReviewModal } from './AddReviewModal';

interface PlaceDetailProps {
  location: Location;
  onClose: () => void;
  isMobile?: boolean;
  searchId?: string | null;
  onPlaceStateChange?: () => void;
}

export function PlaceDetail({ location, onClose, isMobile = false, searchId, onPlaceStateChange }: PlaceDetailProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [isAddReviewOpen, setIsAddReviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showCurationLegend, setShowCurationLegend] = useState(false);
  const [isSaved, setIsSaved] = useState(() => getSavedIds().includes(location.id));
  const [isVisited, setIsVisited] = useState(() => getVisitedIds().includes(location.id));
  const [stateFeedback, setStateFeedback] = useState('');
  const stateFeedbackTimerRef = useRef<number | null>(null);

  /** 추천 강도 배지(직접 방문한 곳만) + "?" 레전드 토글 버튼 */
  const CurationBadge = (
    <div className="relative">
      <div className="flex items-center gap-1">
        <RecommendBadge location={location} />
        <button
          type="button"
          onClick={() => setShowCurationLegend((v) => !v)}
          aria-label="배지 뜻 보기"
          aria-expanded={showCurationLegend}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400 hover:bg-gray-200"
        >
          ?
        </button>
      </div>
      {showCurationLegend && (
        <div className="absolute right-0 top-9 z-20 w-60 rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-gray-500">배지 뜻</p>
          {RECOMMEND_BADGES.map((badge) => (
            <div key={badge.label} className="flex items-center gap-2 py-0.5">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${badge.badgeClass}`}>
                {badge.label}
              </span>
              <span className="text-xs text-gray-500">{badge.description}</span>
            </div>
          ))}
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            '{VISIT_STATUS_LABEL.candidate}'에는 추천 강도 배지를 달지 않아요.
          </p>
        </div>
      )}
    </div>
  );

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => () => {
    if (stateFeedbackTimerRef.current) {
      window.clearTimeout(stateFeedbackTimerRef.current);
    }
  }, []);

  // 큐레이션 상세: 공개된 추천 문장·방문 기록·영업시간 (새 테이블)
  const [curation, setCuration] = useState<PlaceCuration | null>(null);
  useEffect(() => {
    let alive = true;
    curationApi.getDetail(location.id).then((data) => {
      if (alive) setCuration(data);
    });
    return () => {
      alive = false;
    };
  }, [location.id]);

  // 리뷰 데이터 로드
  useEffect(() => {
    const loadReviews = async () => {
      const [reviewsData, count] = await Promise.all([
        reviewApi.getByLocationId(location.id),
        reviewApi.getCount(location.id),
      ]);
      setReviews(reviewsData);
      setReviewCount(count);
    };
    loadReviews();
  }, [location.id]);

  // 주소 복사
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(location.address);
      recordActivity('copy_address', location);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('주소 복사 실패:', err);
    }
  };

  // 카카오톡 공유
  const handleShareKakao = () => {
    recordActivity('view_detail', location);
    shareToKakao(location);
  };

  const showStateFeedback = (message: string) => {
    setStateFeedback(message);
    if (stateFeedbackTimerRef.current) {
      window.clearTimeout(stateFeedbackTimerRef.current);
    }
    stateFeedbackTimerRef.current = window.setTimeout(() => {
      setStateFeedback('');
      stateFeedbackTimerRef.current = null;
    }, 1800);
  };

  const handleToggleSaved = () => {
    const nextSaved = toggleSaved(location);
    setIsSaved(nextSaved);
    onPlaceStateChange?.();
    showStateFeedback(nextSaved ? '저장했어요. 저장한 곳에서 볼 수 있어요.' : '저장을 해제했어요.');
  };

  const handleToggleVisited = () => {
    const nextVisited = toggleVisited(location);
    setIsVisited(nextVisited);
    onPlaceStateChange?.();
    showStateFeedback(nextVisited ? '다녀온 곳으로 기록했어요.' : '방문 기록을 해제했어요.');
  };

  // 네이버 지도 열기
  const handleOpenNaver = () => {
    recordActivity('open_naver', location);
    if (searchId) searchLogApi.updateMapOpen(searchId, 'naver', location.id);
    const appName = encodeURIComponent(window.location.origin);
    const query = encodeURIComponent(location.name);
    const appLink = `nmap://search?query=${query}&appname=${appName}`;
    const webLink = `https://map.naver.com/v5/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  // 카카오맵 열기
  const handleOpenKakao = () => {
    recordActivity('open_kakao', location);
    if (searchId) searchLogApi.updateMapOpen(searchId, 'kakao', location.id);
    const query = encodeURIComponent(location.name);
    const appLink = `kakaomap://search?q=${query}`;
    const webLink = `https://map.kakao.com/link/search/${query}`;

    window.location.href = appLink;
    setTimeout(() => {
      window.location.href = webLink;
    }, 700);
  };

  const allTags = [...new Set([...(location.tags || []), ...(location.eventTags || [])])];
  const visibleTags = allTags.filter((tag) => !isPracticalInfoTag(tag)).slice(0, 10);
  const practicalTags = allTags.filter(isPracticalInfoTag);
  const visited = isCuratorVisited(location);
  const recommendation = curation?.recommendation ?? null;
  // 공개된 추천 문장이 우선. 없으면 가본 곳의 한 줄 설명만 (안 가본 곳의 초안은 보여주지 않는다)
  const curatorReason = recommendation?.body ?? (visited ? getCuratorReason(location) : '');
  const unvisitedBasis = recommendation && recommendation.basis !== 'visited' ? UNVISITED_BASIS_LABEL[recommendation.basis] ?? '' : '';
  const datedVisits = (curation?.visits ?? []).filter((v) => v.visited_on);
  const facts = curation?.facts ?? [];
  const visitInfoText = getVisitInfoText(location);
  // 운영자가 직접 쓴 메모와 자동 정리 문구를 같은 이름으로 보여주지 않는다
  const memoIsOperatorNote = isFirstHandMemo(location);
  const placeTerms = describePlace(location, curatorReason);

  /** 장소 종류 · 추천하는 이유 · 이런 때 잘 맞아요 · 직접 가본 메모. 근거 없는 분류는 보여주지 않는다 */
  const ReasonSection = (
    <div className="space-y-3">
      {placeTerms.place_type.length > 0 && (
        <TermRow title="장소 종류" items={placeTerms.place_type} />
      )}
      <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
        <p className="text-xs font-semibold text-orange-700">
          추천하는 이유
          {unvisitedBasis && <span className="ml-1.5 font-normal text-gray-500">· 아직 안 가봤어요 ({unvisitedBasis})</span>}
        </p>
        {curatorReason ? (
          <>
            <p className="mt-1 text-base font-medium leading-relaxed text-gray-800">{curatorReason}</p>
            {recommendation?.fits_for && <p className="mt-1.5 text-sm text-gray-600">이런 분께: {recommendation.fits_for}</p>}
            {recommendation?.caveats && <p className="mt-0.5 text-sm text-gray-600">알아둘 점: {recommendation.caveats}</p>}
          </>
        ) : (
          <p className="mt-1 text-sm text-gray-500">아직 운영자가 이유를 적지 않았어요.</p>
        )}
        {placeTerms.reason.length > 0 && (
          <TermRow items={placeTerms.reason} compact />
        )}
      </div>
      {placeTerms.situation.length > 0 && (
        <TermRow title="이런 때 잘 맞아요" items={placeTerms.situation} />
      )}
      {datedVisits.length > 0 && (
        <p className="text-xs text-gray-500">
          운영자 방문 {formatDay(datedVisits[0].visited_on)}
          {datedVisits.length > 1 && ` 외 ${datedVisits.length - 1}번`}
        </p>
      )}
      {memoIsOperatorNote && (
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs font-semibold text-gray-500">직접 가본 메모</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">{visitInfoText}</p>
        </div>
      )}
    </div>
  );

  const VisitInfoSection = (
    <div className="rounded-xl bg-base p-4">
      <p className="text-xs font-semibold text-accent/60">방문 정보</p>
      <div className="mt-2 flex items-center gap-2">
        <MapPin size={14} className="text-accent/50 flex-shrink-0" />
        <span className="text-sm text-accent/80 flex-1">{location.address}</span>
        <button
          onClick={handleCopyAddress}
          className="p-1.5 rounded-lg hover:bg-white transition-colors"
          title="주소 복사"
        >
          {copied ? (
            <Check size={16} className="text-green-500" />
          ) : (
            <Copy size={16} className="text-accent/50" />
          )}
        </button>
      </div>
      {facts.map((fact) => (
        <div key={fact.field} className="mt-2">
          <p className="text-[11px] font-semibold text-accent/50">
            {FACT_LABEL[fact.field] ?? fact.field}
            <span className="ml-1 font-normal">
              ({fact.source === 'kakao' ? '카카오맵 기준' : '운영자 확인'}{fact.checked_at ? ` · ${formatDay(fact.checked_at)} 확인` : ''})
            </span>
          </p>
          <p className="mt-0.5 text-sm text-accent/80 leading-relaxed">{fact.text}</p>
        </div>
      ))}
      {practicalTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {practicalTags.map((tag) => (
            <span key={tag} className="rounded-lg bg-white px-2 py-1 text-xs text-accent/70">
              {tag}
            </span>
          ))}
        </div>
      )}
      {visitInfoText && !memoIsOperatorNote && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-accent/50">참고 정보 (운영자 확인 전)</p>
          <p className="mt-0.5 text-sm text-accent/80 leading-relaxed whitespace-pre-line">{visitInfoText}</p>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    recordActivity('view_detail', location);
    setIsSaved(getSavedIds().includes(location.id));
    setIsVisited(getVisitedIds().includes(location.id));
  }, [location]);

  // 리뷰 추가 후 리프레시
  const handleReviewAdded = (newReview: Review) => {
    setReviews(prev => [newReview, ...prev]);
    setReviewCount(prev => prev + 1);
    setIsReviewsExpanded(true);
  };

  // 모바일 레이아웃
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
        {/* 상단 헤더 */}
        <div className="bg-white border-b border-base px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-base transition-colors"
          >
            <X size={24} className="text-accent/80" />
          </button>
          <span className="text-sm font-medium text-accent/70">
            {location.categorySub || location.categoryMain || '미분류'}
          </span>
          <div className="w-10" /> {/* 공간 확보를 위한 빈 div */}
        </div>

        {/* 스크롤 가능한 컨텐츠 */}
        <div className="flex-1 overflow-y-auto overscroll-none">
          {/* 커버 이미지 */}
          {location.imageUrl && !imageError && (
            <div className="relative h-48 bg-base">
              <img
                src={getDetailImageUrl(location.imageUrl)}
                alt={location.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* 헤더: 장소명, 쩝쩝박사 라벨, 주소 */}
            <div>
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-accent">{location.name}</h1>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  {CurationBadge}
                  <PriceLevelBadge priceLevel={location.price_level} size="sm" />
                </div>
              </div>
              <p className="text-sm text-accent/70 mt-1">{location.region}</p>

            </div>

            {/* ProofBar - 운영자 직접 방문 / 아직 안 가본 후보 */}
            <ProofBar
              curatorVisited={isCuratorVisited(location)}
              visitedAt={location.curator_visited_at}
              visitSlot={location.curator_visit_slot}
              disclosure={location.disclosure}
            />

            {/* 장소 종류 · 추천하는 이유 · 이런 때 잘 맞아요 · 직접 가본 메모 */}
            {ReasonSection}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleToggleSaved}
                aria-label={isSaved ? `${location.name} 저장 해제` : `${location.name} 저장하기`}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isSaved
                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Heart size={15} fill={isSaved ? 'currentColor' : 'none'} />
                {isSaved ? '저장 해제' : '저장하기'}
              </button>
              <button
                onClick={handleToggleVisited}
                aria-label={isVisited ? `${location.name} 방문 기록 해제` : `${location.name} 다녀왔어요`}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isVisited
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <CheckCircle2 size={15} />
                {isVisited ? '방문 기록 해제' : '다녀왔어요'}
              </button>
            </div>
            {stateFeedback && (
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500" role="status" aria-live="polite">
                {stateFeedback}
              </p>
            )}

            {/* 태그 */}
            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-base text-accent text-sm font-medium rounded-xl"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 방문 정보: 주소, 주차·분위기 등 참고 설명 */}
            {VisitInfoSection}

            {/* 커뮤니티 리뷰 섹션 */}
            <CommunityReviews
              reviews={reviews}
              reviewCount={reviewCount}
              isExpanded={isReviewsExpanded}
              onToggle={() => setIsReviewsExpanded(!isReviewsExpanded)}
            />

            {/* 나도 다녀왔어요 버튼 */}
            <button
              onClick={() => setIsAddReviewOpen(true)}
              className="w-full py-3.5 bg-white border-2 border-dashed border-base text-accent/80 font-medium rounded-xl hover:border-point hover:text-point transition-colors"
            >
              나도 다녀왔어요
            </button>
          </div>

          {/* 하단 여백 (sticky CTA 영역) */}
          <div className="h-24" />
        </div>

        {/* Sticky 하단 CTA */}
        <div className="flex-shrink-0 bg-white border-t border-base p-4 flex gap-3">
          <button
            onClick={handleShareKakao}
            className="py-3.5 px-4 bg-point text-white font-medium rounded-xl hover:bg-point-hover transition-colors flex items-center justify-center"
            title="카카오톡 공유"
          >
            <Share2 size={20} />
          </button>
          <button
            onClick={handleOpenNaver}
            className="flex-1 py-3.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation size={18} />
            네이버지도
          </button>
          <button
            onClick={handleOpenKakao}
            className="flex-1 py-3.5 bg-yellow-400 text-gray-900 font-medium rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink size={18} />
            카카오맵
          </button>
        </div>

        {/* 리뷰 추가 모달 */}
        {isAddReviewOpen && (
          <AddReviewModal
            locationId={location.id}
            locationName={location.name}
            onClose={() => setIsAddReviewOpen(false)}
            onSuccess={handleReviewAdded}
          />
        )}
      </div>
    );
  }

  // PC 레이아웃 (2컬럼)
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex">
        {/* 왼쪽: 컨텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {/* 커버 이미지 */}
          {location.imageUrl && !imageError && (
            <div className="relative h-56 bg-base">
              <img
                src={getDetailImageUrl(location.imageUrl)}
                alt={location.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImageError(true)}
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white/90 backdrop-blur rounded-xl flex items-center justify-center hover:bg-white transition-colors"
                >
                  <X size={20} className="text-accent/80" />
                </button>
              </div>
              <div className="absolute bottom-4 left-4">
                <span className="px-3 py-1.5 bg-point text-white text-sm font-medium rounded-lg">
                  {location.categorySub || location.categoryMain || '미분류'}
                </span>
              </div>
            </div>
          )}

          {/* 이미지 없을 때 헤더 */}
          {(!location.imageUrl || imageError) && (
            <div className="flex items-center justify-between p-5 border-b border-base">
              <span className="px-3 py-1.5 bg-point text-white text-sm font-medium rounded-lg">
                {location.categorySub || location.categoryMain || '미분류'}
              </span>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-base transition-colors"
              >
                <X size={20} className="text-accent/80" />
              </button>
            </div>
          )}

          <div className="p-6 space-y-5">
            {/* 헤더 */}
            <div>
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-accent">{location.name}</h1>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  {CurationBadge}
                  <PriceLevelBadge priceLevel={location.price_level} size="sm" />
                </div>
              </div>
              <p className="text-sm text-accent/70 mt-1">{location.region}</p>

            </div>

            {/* ProofBar - 운영자 직접 방문 / 아직 안 가본 후보 */}
            <ProofBar
              curatorVisited={isCuratorVisited(location)}
              visitedAt={location.curator_visited_at}
              visitSlot={location.curator_visit_slot}
              disclosure={location.disclosure}
            />

            {/* 장소 종류 · 추천하는 이유 · 이런 때 잘 맞아요 · 직접 가본 메모 */}
            {ReasonSection}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleToggleSaved}
                aria-label={isSaved ? `${location.name} 저장 해제` : `${location.name} 저장하기`}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isSaved
                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Heart size={15} fill={isSaved ? 'currentColor' : 'none'} />
                {isSaved ? '저장 해제' : '저장하기'}
              </button>
              <button
                onClick={handleToggleVisited}
                aria-label={isVisited ? `${location.name} 방문 기록 해제` : `${location.name} 다녀왔어요`}
                className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isVisited
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <CheckCircle2 size={15} />
                {isVisited ? '방문 기록 해제' : '다녀왔어요'}
              </button>
            </div>
            {stateFeedback && (
              <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500" role="status" aria-live="polite">
                {stateFeedback}
              </p>
            )}

            {/* 태그 */}
            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 bg-base text-accent text-sm font-medium rounded-xl"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 방문 정보: 주소, 주차·분위기 등 참고 설명 */}
            {VisitInfoSection}

            {/* 커뮤니티 리뷰 */}
            <CommunityReviews
              reviews={reviews}
              reviewCount={reviewCount}
              isExpanded={isReviewsExpanded}
              onToggle={() => setIsReviewsExpanded(!isReviewsExpanded)}
            />

            {/* 나도 다녀왔어요 */}
            <button
              onClick={() => setIsAddReviewOpen(true)}
              className="w-full py-3.5 bg-white border-2 border-dashed border-base text-accent/80 font-medium rounded-xl hover:border-point hover:text-point transition-colors"
            >
              나도 다녀왔어요
            </button>

            {/* 지도 버튼 (PC) */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleShareKakao}
                className="py-3 px-4 bg-point text-white font-medium rounded-xl hover:bg-point-hover transition-colors flex items-center justify-center"
                title="카카오톡 공유"
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={handleOpenNaver}
                className="flex-1 py-3 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Navigation size={18} />
                네이버지도
              </button>
              <button
                onClick={handleOpenKakao}
                className="flex-1 py-3 bg-yellow-400 text-gray-900 font-medium rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink size={18} />
                카카오맵
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽: 지도 미리보기 (PC) */}
        <div className="w-80 bg-base border-l border-base flex-shrink-0 hidden lg:block">
          <div className="sticky top-0 h-full flex items-center justify-center">
            <div className="text-center p-6">
              <MapPin size={48} className="text-accent/30 mx-auto mb-3" />
              <p className="text-sm text-accent/70">지도에서 위치 확인</p>
              <p className="text-xs text-accent/50 mt-1">
                {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 리뷰 추가 모달 */}
      {isAddReviewOpen && (
        <AddReviewModal
          locationId={location.id}
          locationName={location.name}
          onClose={() => setIsAddReviewOpen(false)}
          onSuccess={handleReviewAdded}
        />
      )}
    </div>
  );
}

/** 근거가 있는 분류 칩. 마우스를 올리면 근거(#태그, 등록 분류, 운영자 문장)를 보여준다 */
const UNVISITED_BASIS_LABEL: Record<string, string> = { friend: '지인 추천', research: '직접 찾아봄', wishlist: '가보고 싶은 곳' };
const FACT_LABEL: Record<string, string> = { hours: '영업시간', phone: '전화' };

function formatDay(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function TermRow({ title, items, compact = false }: { title?: string; items: { slug: string; label: string; evidence: string }[]; compact?: boolean }) {
  return (
    <div className={compact ? 'mt-2' : ''}>
      {title && <p className="mb-1.5 text-xs font-semibold text-gray-500">{title}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item.slug}
            title={`근거: ${item.evidence}`}
            className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-100"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
