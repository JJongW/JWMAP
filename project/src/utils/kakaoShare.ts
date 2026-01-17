import type { Location, Features } from '../types/location';
import { getDetailImageUrl } from './image';

// Kakao SDK 타입 선언
declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: KakaoShareOptions) => void;
      };
    };
  }
}

interface KakaoShareOptions {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  };
  social?: {
    likeCount?: number;
    commentCount?: number;
    sharedCount?: number;
  };
  buttons?: Array<{
    title: string;
    link: {
      mobileWebUrl: string;
      webUrl: string;
    };
  }>;
}

// Feature labels for description
const featureLabels: Record<keyof Features, string> = {
  solo_ok: '혼밥',
  quiet: '조용함',
  wait_short: '빠른입장',
  date_ok: '데이트',
  group_ok: '단체',
  parking: '주차',
  pet_friendly: '반려동물',
  reservation: '예약',
  late_night: '심야',
};

// SDK 초기화 상태
let isInitialized = false;

/**
 * Kakao SDK 초기화
 */
export function initKakaoSDK(): boolean {
  if (typeof window === 'undefined' || !window.Kakao) {
    console.warn('Kakao SDK not loaded');
    return false;
  }

  if (isInitialized || window.Kakao.isInitialized()) {
    isInitialized = true;
    return true;
  }

  const kakaoKey = import.meta.env.VITE_KAKAO_APP_API_KEY;
  if (!kakaoKey) {
    console.error('Kakao API key not found');
    return false;
  }

  try {
    window.Kakao.init(kakaoKey);
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('Failed to initialize Kakao SDK:', error);
    return false;
  }
}

/**
 * 장소 설명 텍스트 생성
 */
function buildDescription(location: Location): string {
  const parts: string[] = [];

  // 주소
  parts.push(location.address);

  // 태그 (features)
  if (location.features) {
    const tags = Object.entries(location.features)
      .filter(([, value]) => value)
      .map(([key]) => featureLabels[key as keyof Features])
      .filter(Boolean)
      .slice(0, 3);

    if (tags.length > 0) {
      parts.push(tags.join(' · '));
    }
  }

  // 원라이너 (short_desc)
  if (location.short_desc) {
    parts.push(`"${location.short_desc}"`);
  }

  return parts.join('\n');
}

/**
 * 카카오톡으로 장소 공유
 */
export function shareToKakao(location: Location): boolean {
  // SDK 초기화 확인
  if (!initKakaoSDK()) {
    alert('카카오톡 공유 기능을 사용할 수 없습니다.');
    return false;
  }

  // 현재 페이지 URL
  const currentUrl = window.location.origin;
  
  // 장소 ID를 포함한 공유 URL 생성
  const shareUrl = `${currentUrl}?locationId=${location.id}`;

  // 이미지 URL (없으면 기본 이미지)
  const imageUrl = location.imageUrl
    ? getDetailImageUrl(location.imageUrl)
    : `${currentUrl}/logo.svg`;

  // 설명 텍스트 생성
  const description = buildDescription(location);

  // 카테고리 표시
  const categoryText = location.categorySub || location.categoryMain || '';
  const titleWithCategory = categoryText
    ? `[${categoryText}] ${location.name}`
    : location.name;

  try {
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: titleWithCategory,
        description: description,
        imageUrl: imageUrl,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: '오늘 오디가?에서 보기',
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Kakao share error:', error);
    alert('카카오톡 공유 중 오류가 발생했습니다.');
    return false;
  }
}
