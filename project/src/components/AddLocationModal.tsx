import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { ImageUpload } from './ImageUpload';
import { PlaceSearch } from './PlaceSearch';
import type { Features, Province, CategoryMain, CategorySub } from '../types/location';
import { PROVINCES, REGION_HIERARCHY, CATEGORY_MAINS, CATEGORY_HIERARCHY, getCategorySubsByMain } from '../types/location';
import { RATING_LABELS, getRatingFromLabel, getRatingLabel, isOwnerMode, type RatingLabel } from '../utils/rating';
import type { LLMSuggestions, TagSuggestion } from '../schemas/llmSuggestions';
import { featureLabels, tagTypeLabels } from '../schemas/llmSuggestions';

interface ExistingLocation {
  id: string;
  name: string;
  address: string;
  kakao_place_id?: string;
}

interface AddLocationModalProps {
  onClose: () => void;
  onSave: (location: {
    name: string;
    province?: Province;
    region: string;
    categoryMain?: CategoryMain;
    categorySub?: CategorySub;
    address: string;
    imageUrl: string;
    rating: number;
    curator_visited?: boolean;
    lon: number;
    lat: number;
    memo: string;
    short_desc?: string;
    kakao_place_id?: string;
    features?: Features;
    tags?: string[];
  }) => void;
  existingLocations?: ExistingLocation[];
}

export function AddLocationModal({ onClose, onSave, existingLocations = [] }: AddLocationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    province: '' as Province | '',
    region: '',
    categoryMain: '' as CategoryMain | '',
    categorySub: '' as CategorySub | '',
    address: '',
    imageUrl: '',
    rating: 3.25, // 쩝쩝박사 자주 방문 기본값
    curator_visited: true,
    lon: 0,
    lat: 0,
    memo: '',
    short_desc: '',
    kakao_place_id: '',
  });
  const [features, setFeatures] = useState<Features>({});
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<LLMSuggestions | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<ExistingLocation | null>(null);

  // 중복 체크 함수
  const checkDuplicate = (name: string, address: string, kakaoPlaceId?: string): ExistingLocation | null => {
    // 1. kakao_place_id로 체크 (가장 정확)
    if (kakaoPlaceId) {
      const byPlaceId = existingLocations.find(
        loc => loc.kakao_place_id === kakaoPlaceId
      );
      if (byPlaceId) return byPlaceId;
    }

    // 2. 이름 + 주소로 체크 (유사도)
    const normalizedName = name.trim().toLowerCase();
    const normalizedAddress = address.trim().toLowerCase();

    const byNameAndAddress = existingLocations.find(loc => {
      const locName = loc.name.trim().toLowerCase();
      const locAddress = loc.address.trim().toLowerCase();

      // 정확히 일치하거나, 이름이 포함관계이고 주소가 유사한 경우
      const nameMatch = locName === normalizedName ||
        locName.includes(normalizedName) ||
        normalizedName.includes(locName);
      const addressMatch = locAddress === normalizedAddress ||
        locAddress.includes(normalizedAddress) ||
        normalizedAddress.includes(locAddress);

      return nameMatch && addressMatch;
    });

    return byNameAndAddress || null;
  };

  const featureOptions: { key: keyof Features; label: string }[] = [
    { key: 'solo_ok', label: '혼밥 가능' },
    { key: 'quiet', label: '조용한 분위기' },
    { key: 'wait_short', label: '웨이팅 짧음' },
    { key: 'date_ok', label: '데이트 추천' },
    { key: 'group_ok', label: '단체석 있음' },
    { key: 'parking', label: '주차 가능' },
    { key: 'pet_friendly', label: '반려동물 동반' },
    { key: 'reservation', label: '예약 가능' },
    { key: 'late_night', label: '심야 영업' },
  ];

  // 선택된 Province에 따른 District 목록
  const availableDistricts = formData.province
    ? REGION_HIERARCHY[formData.province] || []
    : [];

  // 선택된 카테고리 대분류에 따른 소분류 목록
  const availableCategorySubs = formData.categoryMain && formData.categoryMain !== '전체'
    ? getCategorySubsByMain(formData.categoryMain)
    : [];

  // 주소를 좌표로 변환 (카카오 지오코딩)
  const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
    if (!address.trim() || typeof kakao === 'undefined' || !kakao.maps?.services?.Geocoder) {
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.addressSearch(address, (result: kakao.maps.services.Geocoder.Result[], status: kakao.maps.services.Status) => {
        if (status === kakao.maps.services.Status.OK && result.length > 0) {
          const coords = result[0];
          resolve({
            lat: parseFloat(coords.y),
            lon: parseFloat(coords.x),
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  // 주소에서 지역 자동 추출 (Province + District)
  const extractRegionFromAddress = (address: string): { province: Province; region: string } | null => {
    // 시/도 레벨 매핑
    const provincePatterns: { pattern: string; province: Province }[] = [
      { pattern: '서울', province: '서울' },
      { pattern: '경기', province: '경기' },
      { pattern: '인천', province: '인천' },
      { pattern: '부산', province: '부산' },
      { pattern: '대구', province: '대구' },
      { pattern: '대전', province: '대전' },
      { pattern: '광주광역시', province: '광주' },
      { pattern: '울산', province: '울산' },
      { pattern: '세종', province: '세종' },
      { pattern: '강원', province: '강원' },
      { pattern: '충청북도', province: '충북' },
      { pattern: '충북', province: '충북' },
      { pattern: '충청남도', province: '충남' },
      { pattern: '충남', province: '충남' },
      { pattern: '전라북도', province: '전북' },
      { pattern: '전북', province: '전북' },
      { pattern: '전라남도', province: '전남' },
      { pattern: '전남', province: '전남' },
      { pattern: '경상북도', province: '경북' },
      { pattern: '경북', province: '경북' },
      { pattern: '경상남도', province: '경남' },
      { pattern: '경남', province: '경남' },
      { pattern: '제주', province: '제주' },
    ];

    // 서울 구별 매핑
    const seoulDistrictMap: Record<string, string> = {
      '강남구': '강남',
      '서초구': '서초',
      '송파구': '잠실/송파/강동',
      '강동구': '잠실/송파/강동',
      '영등포구': '영등포/여의도/강서',
      '강서구': '영등포/여의도/강서',
      '광진구': '건대/성수/왕십리',
      '성동구': '건대/성수/왕십리',
      '종로구': '종로/중구',
      '중구': '종로/중구',
      '마포구': '홍대/합정/마포/연남',
      '용산구': '용산/이태원/한남',
      '성북구': '성북/노원/중랑',
      '노원구': '성북/노원/중랑',
      '중랑구': '성북/노원/중랑',
      '구로구': '구로/관악/동작',
      '관악구': '구로/관악/동작',
      '동작구': '구로/관악/동작',
      '서대문구': '신촌/연희',
      '도봉구': '창동/도봉산',
      '동대문구': '회기/청량리',
      '은평구': '연신내/구파발',
      '강북구': '미아/수유/북한산',
      '양천구': '목동/양천',
      '금천구': '금천/가산',
    };

    // 경기도 시별 매핑
    const gyeonggiDistrictMap: Record<string, string> = {
      '수원시': '수원',
      '성남시': '성남/분당',
      '분당': '성남/분당',
      '고양시': '고양/일산',
      '일산': '고양/일산',
      '용인시': '용인',
      '부천시': '부천',
      '안양시': '안양/과천',
      '과천시': '안양/과천',
      '안산시': '안산',
      '화성시': '화성/동탄',
      '동탄': '화성/동탄',
      '평택시': '평택',
      '의정부시': '의정부',
      '파주시': '파주',
      '김포시': '김포',
      '광명시': '광명',
      '광주시': '광주',
      '하남시': '하남',
      '시흥시': '시흥',
      '군포시': '군포/의왕',
      '의왕시': '군포/의왕',
      '오산시': '오산',
      '이천시': '이천',
      '안성시': '안성',
      '양평군': '양평/여주',
      '여주시': '양평/여주',
      '구리시': '구리/남양주',
      '남양주시': '구리/남양주',
      '포천시': '포천/동두천',
      '동두천시': '포천/동두천',
      '양주시': '양주',
      '가평군': '가평',
      '연천군': '연천',
    };

    // 인천 구별 매핑
    const incheonDistrictMap: Record<string, string> = {
      '부평구': '부평',
      '연수구': '송도/연수',
      '송도': '송도/연수',
      '계양구': '계양',
      '남동구': '남동구',
      '서구': '서구/검단',
      '검단': '서구/검단',
      '중구': '중구/동구',
      '동구': '중구/동구',
      '강화군': '강화/옹진',
      '옹진군': '강화/옹진',
    };

    // 부산 구별 매핑
    const busanDistrictMap: Record<string, string> = {
      '부산진구': '서면',
      '서면': '서면',
      '해운대구': '해운대',
      '해운대': '해운대',
      '수영구': '광안리/수영',
      '광안리': '광안리/수영',
      '센텀': '센텀시티',
      '중구': '남포동/중앙동',
      '남포동': '남포동/중앙동',
      '동래구': '동래/온천장',
      '온천장': '동래/온천장',
      '사상구': '사상/덕천',
      '덕천': '사상/덕천',
      '북구': '사상/덕천',
      '기장군': '기장',
      '사하구': '사하/다대포',
      '다대포': '사하/다대포',
      '연제구': '연산/토곡',
      '연산동': '연산/토곡',
    };

    // 대구 구별 매핑
    const daeguDistrictMap: Record<string, string> = {
      '중구': '동성로/중구',
      '동성로': '동성로/중구',
      '수성구': '수성구',
      '범어동': '범어/만촌',
      '만촌동': '범어/만촌',
      '동구': '동대구/신천',
      '동대구': '동대구/신천',
      '신천동': '동대구/신천',
      '북구': '북구/칠곡',
      '칠곡': '북구/칠곡',
      '달서구': '달서구',
      '경북대': '경대/대현',
      '대현동': '경대/대현',
    };

    // 대전 구별 매핑
    const daejeonDistrictMap: Record<string, string> = {
      '서구': '둔산',
      '둔산동': '둔산',
      '유성구': '유성/궁동',
      '궁동': '유성/궁동',
      '중구': '대전역/중앙로',
      '대전역': '대전역/중앙로',
      '관저동': '서구/관저',
      '동구': '동구/대동',
      '대동': '동구/대동',
    };

    // 광주 구별 매핑
    const gwangjuDistrictMap: Record<string, string> = {
      '동구': '충장로/동구',
      '충장로': '충장로/동구',
      '서구': '상무지구',
      '상무': '상무지구',
      '광산구': '첨단지구',
      '첨단': '첨단지구',
      '수완': '수완지구',
      '송정역': '광주송정역',
      '송정동': '광주송정역',
    };

    // 울산 구별 매핑
    const ulsanDistrictMap: Record<string, string> = {
      '남구': '삼산/신정',
      '삼산동': '삼산/신정',
      '신정동': '삼산/신정',
      '중구': '성남동/중구',
      '성남동': '성남동/중구',
      '동구': '동구/방어진',
      '방어진': '동구/방어진',
      '울주군': '울주/언양',
      '언양': '울주/언양',
    };

    // 세종 매핑
    const sejongDistrictMap: Record<string, string> = {
      '조치원': '조치원',
      '어진동': '정부청사/어진동',
      '정부청사': '정부청사/어진동',
      '나성동': '나성동/다정동',
      '다정동': '나성동/다정동',
    };

    // 강원 시별 매핑
    const gangwonDistrictMap: Record<string, string> = {
      '춘천시': '춘천',
      '원주시': '원주',
      '강릉시': '강릉',
      '속초시': '속초/양양',
      '양양군': '속초/양양',
      '동해시': '동해/삼척',
      '삼척시': '동해/삼척',
      '평창군': '평창/정선',
      '정선군': '평창/정선',
      '홍천군': '홍천/횡성',
      '횡성군': '홍천/횡성',
    };

    // 충북 시별 매핑
    const chungbukDistrictMap: Record<string, string> = {
      '청주시': '청주',
      '충주시': '충주',
      '제천시': '제천',
      '음성군': '음성/진천',
      '진천군': '음성/진천',
    };

    // 충남 시별 매핑
    const chungnamDistrictMap: Record<string, string> = {
      '천안시': '천안',
      '아산시': '아산',
      '서산시': '서산/당진',
      '당진시': '서산/당진',
      '공주시': '공주/부여',
      '부여군': '공주/부여',
      '논산시': '논산/계룡',
      '계룡시': '논산/계룡',
      '홍성군': '홍성/예산',
      '예산군': '홍성/예산',
    };

    // 전북 시별 매핑
    const jeonbukDistrictMap: Record<string, string> = {
      '전주시': '전주',
      '익산시': '익산',
      '군산시': '군산',
      '정읍시': '정읍/김제',
      '김제시': '정읍/김제',
      '남원시': '남원/순창',
      '순창군': '남원/순창',
    };

    // 전남 시별 매핑
    const jeonnamDistrictMap: Record<string, string> = {
      '여수시': '여수',
      '순천시': '순천',
      '광양시': '광양',
      '목포시': '목포',
      '나주시': '나주',
      '무안군': '무안/영암',
      '영암군': '무안/영암',
    };

    // 경북 시별 매핑
    const gyeongbukDistrictMap: Record<string, string> = {
      '포항시': '포항',
      '경주시': '경주',
      '구미시': '구미',
      '안동시': '안동',
      '김천시': '김천',
      '영주시': '영주/봉화',
      '봉화군': '영주/봉화',
      '상주시': '상주/문경',
      '문경시': '상주/문경',
    };

    // 경남 시별 매핑
    const gyeongnamDistrictMap: Record<string, string> = {
      '창원시': '창원/마산',
      '마산': '창원/마산',
      '김해시': '김해',
      '진주시': '진주',
      '양산시': '양산',
      '거제시': '거제',
      '통영시': '통영/고성',
      '고성군': '통영/고성',
      '밀양시': '밀양/창녕',
      '창녕군': '밀양/창녕',
    };

    // 제주 시별 매핑
    const jejuDistrictMap: Record<string, string> = {
      '제주시': '제주시',
      '서귀포시': '서귀포',
      '애월읍': '애월/한림',
      '한림읍': '애월/한림',
      '성산읍': '성산/표선',
      '표선면': '성산/표선',
      '중문': '중문',
    };

    // Province별 District 매핑 통합
    const districtMaps: Record<Province, Record<string, string>> = {
      '서울': seoulDistrictMap,
      '경기': gyeonggiDistrictMap,
      '인천': incheonDistrictMap,
      '부산': busanDistrictMap,
      '대구': daeguDistrictMap,
      '대전': daejeonDistrictMap,
      '광주': gwangjuDistrictMap,
      '울산': ulsanDistrictMap,
      '세종': sejongDistrictMap,
      '강원': gangwonDistrictMap,
      '충북': chungbukDistrictMap,
      '충남': chungnamDistrictMap,
      '전북': jeonbukDistrictMap,
      '전남': jeonnamDistrictMap,
      '경북': gyeongbukDistrictMap,
      '경남': gyeongnamDistrictMap,
      '제주': jejuDistrictMap,
    };

    // Province 찾기
    let detectedProvince: Province | null = null;
    for (const { pattern, province } of provincePatterns) {
      if (address.includes(pattern)) {
        detectedProvince = province;
        break;
      }
    }

    if (!detectedProvince) return null;

    // District 찾기
    let detectedRegion = '';
    const districtMap = districtMaps[detectedProvince];
    if (districtMap) {
      for (const [key, value] of Object.entries(districtMap)) {
        if (address.includes(key)) {
          detectedRegion = value;
          break;
        }
      }
    }

    return { province: detectedProvince, region: detectedRegion };
  };

  // 카카오 카테고리에서 우리 카테고리 구조로 매핑
  const mapKakaoCategoryToOurs = (kakaoCategory: string): { categoryMain?: CategoryMain; categorySub?: CategorySub } => {
    const lower = kakaoCategory.toLowerCase();
    
    // 카테고리 매핑 규칙
    if (lower.includes('한식') || lower.includes('국밥') || lower.includes('정식') || lower.includes('덮밥') || lower.includes('백반') || lower.includes('도시락')) {
      if (lower.includes('돈까스') || lower.includes('돈카츠')) {
        return { categoryMain: '밥', categorySub: '돈까스' };
      }
      if (lower.includes('카레')) {
        return { categoryMain: '밥', categorySub: '카레' };
      }
      return { categoryMain: '밥', categorySub: '한식' };
    }
    
    if (lower.includes('라멘')) {
      return { categoryMain: '면', categorySub: '라멘' };
    }
    if (lower.includes('국수') || lower.includes('냉면') || lower.includes('소바')) {
      if (lower.includes('냉면')) {
        return { categoryMain: '면', categorySub: '냉면' };
      }
      if (lower.includes('소바')) {
        return { categoryMain: '면', categorySub: '소바' };
      }
      return { categoryMain: '면', categorySub: '국수' };
    }
    if (lower.includes('파스타') || lower.includes('우동') || lower.includes('쌀국수')) {
      if (lower.includes('파스타')) {
        return { categoryMain: '면', categorySub: '파스타' };
      }
      if (lower.includes('우동')) {
        return { categoryMain: '면', categorySub: '우동' };
      }
      if (lower.includes('쌀국수')) {
        return { categoryMain: '면', categorySub: '쌀국수' };
      }
    }
    
    if (lower.includes('국밥') || lower.includes('찌개') || lower.includes('탕') || lower.includes('전골')) {
      if (lower.includes('국밥')) {
        return { categoryMain: '국물', categorySub: '국밥' };
      }
      if (lower.includes('찌개')) {
        return { categoryMain: '국물', categorySub: '찌개' };
      }
      if (lower.includes('탕')) {
        return { categoryMain: '국물', categorySub: '탕' };
      }
      if (lower.includes('전골')) {
        return { categoryMain: '국물', categorySub: '전골' };
      }
    }
    
    if (lower.includes('고기') || lower.includes('구이') || lower.includes('스테이크') || lower.includes('바비큐') || lower.includes('수육')) {
      if (lower.includes('구이')) {
        return { categoryMain: '고기요리', categorySub: '구이' };
      }
      if (lower.includes('스테이크')) {
        return { categoryMain: '고기요리', categorySub: '스테이크' };
      }
      if (lower.includes('바비큐')) {
        return { categoryMain: '고기요리', categorySub: '바비큐' };
      }
      if (lower.includes('수육')) {
        return { categoryMain: '고기요리', categorySub: '수육' };
      }
      return { categoryMain: '고기요리' };
    }
    
    if (lower.includes('회') || lower.includes('해산물') || lower.includes('해물') || lower.includes('조개') || lower.includes('굴')) {
      if (lower.includes('회')) {
        return { categoryMain: '해산물', categorySub: '회' };
      }
      if (lower.includes('해물찜')) {
        return { categoryMain: '해산물', categorySub: '해물찜' };
      }
      if (lower.includes('해물탕')) {
        return { categoryMain: '해산물', categorySub: '해물탕' };
      }
      if (lower.includes('조개') || lower.includes('굴')) {
        return { categoryMain: '해산물', categorySub: '조개/굴' };
      }
      return { categoryMain: '해산물', categorySub: '해산물요리' };
    }
    
    if (lower.includes('분식') || lower.includes('김밥') || lower.includes('샌드위치') || lower.includes('토스트') || lower.includes('햄버거') || lower.includes('버거') || lower.includes('타코')) {
      if (lower.includes('분식')) {
        return { categoryMain: '간편식', categorySub: '분식' };
      }
      if (lower.includes('김밥')) {
        return { categoryMain: '간편식', categorySub: '김밥' };
      }
      if (lower.includes('샌드위치')) {
        return { categoryMain: '간편식', categorySub: '샌드위치' };
      }
      if (lower.includes('토스트')) {
        return { categoryMain: '간편식', categorySub: '토스트' };
      }
      if (lower.includes('햄버거') || lower.includes('버거')) {
        return { categoryMain: '간편식', categorySub: '햄버거' };
      }
      if (lower.includes('타코')) {
        return { categoryMain: '간편식', categorySub: '타코' };
      }
    }
    
    if (lower.includes('중식') || lower.includes('베트남') || lower.includes('태국') || lower.includes('인도') || lower.includes('프랑스') || lower.includes('아시안') || lower.includes('양식') || lower.includes('파스타') || lower.includes('피자') || lower.includes('리조또') || lower.includes('브런치')) {
      if (lower.includes('중식')) {
        return { categoryMain: '양식·퓨전', categorySub: '중식' };
      }
      if (lower.includes('베트남')) {
        return { categoryMain: '양식·퓨전', categorySub: '베트남' };
      }
      if (lower.includes('태국') || lower.includes('인도') || lower.includes('아시안')) {
        return { categoryMain: '양식·퓨전', categorySub: '아시안' };
      }
      if (lower.includes('프랑스')) {
        return { categoryMain: '양식·퓨전', categorySub: '프랑스' };
      }
      if (lower.includes('파스타')) {
        return { categoryMain: '양식·퓨전', categorySub: '파스타' };
      }
      if (lower.includes('피자')) {
        return { categoryMain: '양식·퓨전', categorySub: '피자' };
      }
      if (lower.includes('리조또')) {
        return { categoryMain: '양식·퓨전', categorySub: '리조또' };
      }
      if (lower.includes('브런치')) {
        return { categoryMain: '양식·퓨전', categorySub: '브런치' };
      }
      return { categoryMain: '양식·퓨전', categorySub: '양식' };
    }
    
    if (lower.includes('케이크') || lower.includes('베이커리') || lower.includes('빵') || lower.includes('도넛') || lower.includes('아이스크림')) {
      if (lower.includes('케이크')) {
        return { categoryMain: '디저트', categorySub: '케이크' };
      }
      if (lower.includes('베이커리') || lower.includes('빵')) {
        return { categoryMain: '디저트', categorySub: '베이커리' };
      }
      if (lower.includes('도넛')) {
        return { categoryMain: '디저트', categorySub: '도넛' };
      }
      if (lower.includes('아이스크림')) {
        return { categoryMain: '디저트', categorySub: '아이스크림' };
      }
    }
    
    if (lower.includes('카페') || lower.includes('커피') || lower.includes('차') || lower.includes('논커피') || lower.includes('와인바') || lower.includes('바') || lower.includes('카공')) {
      if (lower.includes('카공')) {
        return { categoryMain: '카페', categorySub: '카공카페' };
      }
      if (lower.includes('커피')) {
        return { categoryMain: '카페', categorySub: '커피' };
      }
      if (lower.includes('차')) {
        return { categoryMain: '카페', categorySub: '차' };
      }
      if (lower.includes('논커피')) {
        return { categoryMain: '카페', categorySub: '논커피' };
      }
      if (lower.includes('와인바') || lower.includes('바')) {
        return { categoryMain: '카페', categorySub: '와인바/바' };
      }
      return { categoryMain: '카페' };
    }
    
    if (lower.includes('술집') || lower.includes('이자카야') || lower.includes('포차') || lower.includes('안주') || lower.includes('호프')) {
      if (lower.includes('이자카야')) {
        return { categoryMain: '술안주', categorySub: '이자카야' };
      }
      if (lower.includes('포차')) {
        return { categoryMain: '술안주', categorySub: '포차' };
      }
      if (lower.includes('안주')) {
        return { categoryMain: '술안주', categorySub: '안주 전문' };
      }
      return { categoryMain: '술안주' };
    }
    
    // 일식은 기본적으로 양식·퓨전으로 매핑
    if (lower.includes('일식') || lower.includes('초밥') || lower.includes('돈카츠')) {
      if (lower.includes('돈카츠') || lower.includes('돈까스')) {
        return { categoryMain: '밥', categorySub: '돈까스' };
      }
      return { categoryMain: '양식·퓨전' };
    }
    
    return {};
  };

  // 장소 선택 핸들러
  const handlePlaceSelect = (place: {
    id: string;
    name: string;
    address: string;
    roadAddress: string;
    lat: number;
    lon: number;
    category: string;
  }) => {
    const detected = extractRegionFromAddress(place.roadAddress || place.address);
    const mappedCategory = mapKakaoCategoryToOurs(place.category);
    const addressToUse = place.roadAddress || place.address;

    // 중복 체크
    const duplicate = checkDuplicate(place.name, addressToUse, place.id);
    setDuplicateWarning(duplicate);

    setFormData((prev) => ({
      ...prev,
      name: place.name,
      address: addressToUse,
      lat: place.lat,
      lon: place.lon,
      kakao_place_id: place.id,
      province: detected?.province || prev.province,
      region: detected?.region || prev.region,
      categoryMain: mappedCategory.categoryMain || prev.categoryMain,
      categorySub: mappedCategory.categorySub || prev.categorySub,
    }));
  };

  const handleFeatureToggle = (key: keyof Features) => {
    setFeatures((prev) => ({
          ...prev,
      [key]: !prev[key],
    }));
  };

  // LLM 태그 제안 요청
  const handleGetSuggestions = async () => {
    if (!formData.short_desc.trim()) return;

    setIsGeneratingTags(true);
    setSuggestions(null);

    try {
      const response = await fetch('/api/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeName: formData.name,
          category: formData.categorySub || formData.categoryMain || '',
          experience: formData.short_desc,
        }),
      });

      if (response.ok) {
        const data = await response.json() as LLMSuggestions;
        setSuggestions(data);

        // 제안된 features 자동 적용
        if (data.features) {
          setFeatures((prev) => ({ ...prev, ...data.features }));
        }
      }
    } catch (error) {
      console.error('Tag suggestion error:', error);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleSubmit = async () => {
    // 필수 항목 검증
    if (!formData.name || !formData.province || !formData.region || !formData.categoryMain) {
      alert('장소명, 시/도, 세부 지역, 카테고리 대분류는 필수 항목입니다.');
      return;
    }

    // 소분류가 있는 경우 필수 검증
    if (formData.categoryMain !== '전체' && availableCategorySubs.length > 0 && !formData.categorySub) {
      alert('카테고리 소분류를 선택해주세요.');
      return;
    }

    // 주소 필수 검증
    if (!formData.address.trim()) {
      alert('주소는 필수 항목입니다.');
      return;
    }

    // 중복 체크 (저장 전 최종 확인)
    const duplicate = checkDuplicate(formData.name, formData.address, formData.kakao_place_id);
    if (duplicate) {
      const confirmAdd = window.confirm(
        `"${duplicate.name}"이(가) 이미 등록되어 있습니다.\n그래도 추가하시겠습니까?`
      );
      if (!confirmAdd) {
        return;
      }
    }

    // 좌표가 없으면 지오코딩 시도
    let finalLat = formData.lat;
    let finalLon = formData.lon;

    if ((!finalLat || !finalLon || finalLat === 0 || finalLon === 0) && formData.address.trim()) {
      setIsGeocoding(true);
      const coords = await geocodeAddress(formData.address);
      if (coords) {
        finalLat = coords.lat;
        finalLon = coords.lon;
      } else {
        alert('주소를 좌표로 변환할 수 없습니다. 주소를 확인해주세요.');
        setIsGeocoding(false);
        return;
      }
      setIsGeocoding(false);
    }

    // 최종 좌표 검증
    if (!finalLat || !finalLon || finalLat === 0 || finalLon === 0) {
      alert('주소의 좌표를 가져올 수 없습니다. 주소를 확인해주세요.');
      return;
    }

    // features에서 true인 것만 포함
    const activeFeatures = Object.fromEntries(
      Object.entries(features).filter(([, value]) => value === true)
    );

    onSave({
      ...formData,
      province: formData.province as Province,
      categoryMain: formData.categoryMain as CategoryMain,
      categorySub: formData.categorySub || undefined,
      memo: formData.short_desc || formData.memo, // short_desc를 memo로 사용
      lat: finalLat,
      lon: finalLon,
      features: Object.keys(activeFeatures).length > 0 ? activeFeatures : {}, // 빈 객체로 전달 (NOT NULL 제약 조건)
      tags: customTags.length > 0 ? customTags : undefined,
    });
    onClose();
  };

  const isFormValid = formData.name && formData.province && formData.region && formData.categoryMain && formData.address.trim() &&
    (formData.categoryMain === '전체' || availableCategorySubs.length === 0 || formData.categorySub);

  // 추천된 features 라벨 표시
  const getSuggestedFeaturesText = (): string => {
    if (!suggestions?.features) return '';
    const activeKeys = Object.entries(suggestions.features)
      .filter(([, v]) => v)
      .map(([k]) => featureLabels[k as keyof typeof featureLabels])
      .filter(Boolean);
    return activeKeys.join(', ');
  };

  // 태그 토글
  const handleTagToggle = (tagName: string) => {
    setCustomTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  // 추천된 tags 표시 (클릭 가능)
  const renderSuggestedTags = () => {
    if (!suggestions?.tags || suggestions.tags.length === 0) return null;

    return (
      <div className="mt-2">
        <p className="text-xs text-gray-500 mb-1.5">클릭하여 태그 추가:</p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.tags.map((tag: TagSuggestion, idx: number) => {
            const isSelected = customTags.includes(tag.name);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleTagToggle(tag.name)}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
                  isSelected
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                }`}
                title={`${tagTypeLabels[tag.type]} (확신도: ${Math.round(tag.weight * 100)}%)`}
              >
                <span className={isSelected ? 'text-orange-200' : 'text-orange-400'}>
                  {tagTypeLabels[tag.type]}
                </span>
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">새로운 장소 추가</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-4">
          {/* 장소 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              장소 검색 <span className="text-red-500">*</span>
            </label>
            <PlaceSearch onSelect={handlePlaceSelect} placeholder="장소명으로 검색하세요" />
            {formData.name && !duplicateWarning && (
              <p className="text-xs text-green-600 mt-1.5">
                선택됨: {formData.name}
              </p>
            )}
            {/* 중복 경고 */}
            {duplicateWarning && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-700 font-medium">
                  이미 등록된 장소입니다
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  "{duplicateWarning.name}" ({duplicateWarning.address})
                </p>
                <p className="text-xs text-amber-500 mt-1">
                  그래도 추가하려면 저장 버튼을 누르세요.
                </p>
              </div>
            )}
          </div>

          {/* 직접 입력 옵션 */}
          {!formData.kakao_place_id && (
            <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  또는 직접 입력
            </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="장소명"
                />
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={formData.address}
                  onChange={async (e) => {
                    const address = e.target.value;
                    const detected = extractRegionFromAddress(address);

                    setFormData((prev) => ({
                      ...prev,
                      address,
                      province: detected?.province || prev.province,
                      region: detected?.region || prev.region,
                    }));

                    // 주소가 완성되면 지오코딩으로 좌표 자동 변환
                    if (address.trim().length > 5 && !formData.kakao_place_id) {
                      setIsGeocoding(true);
                      const coords = await geocodeAddress(address);
                      if (coords) {
                        setFormData((prev) => ({
                          ...prev,
                          lat: coords.lat,
                          lon: coords.lon,
                        }));
                      }
                      setIsGeocoding(false);
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="주소"
                />
                {isGeocoding && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 size={16} className="animate-spin text-orange-500" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 시/도 선택 */}
          <CustomSelect
            label="시/도"
            required
            value={formData.province}
            onChange={(value) => setFormData((prev) => ({
              ...prev,
              province: value as Province,
              region: '', // Province 변경 시 region 초기화
            }))}
            options={PROVINCES}
            placeholder="시/도를 선택하세요"
          />

          {/* 세부 지역 선택 - Province 선택 후에만 표시 */}
          {formData.province && availableDistricts.length > 0 && (
            <CustomSelect
              label="세부 지역"
              required
              value={formData.region}
              onChange={(value) => setFormData((prev) => ({ ...prev, region: value }))}
              options={availableDistricts}
              placeholder="세부 지역을 선택하세요"
            />
          )}

          {/* 카테고리 대분류 */}
          <CustomSelect
            label="카테고리 (대분류)"
            required
            value={formData.categoryMain}
            onChange={(value) => setFormData((prev) => ({
              ...prev,
              categoryMain: value as CategoryMain,
              categorySub: '', // 대분류 변경 시 소분류 초기화
            }))}
            options={CATEGORY_MAINS.filter(main => main !== '전체')}
            placeholder="카테고리 대분류를 선택하세요"
          />

          {/* 카테고리 소분류 - 대분류 선택 후에만 표시 */}
          {formData.categoryMain && formData.categoryMain !== '전체' && availableCategorySubs.length > 0 && (
            <CustomSelect
              label="카테고리 (소분류)"
              required
              value={formData.categorySub}
              onChange={(value) => setFormData((prev) => ({
                ...prev,
                categorySub: value as CategorySub,
              }))}
              options={availableCategorySubs}
              placeholder="카테고리 소분류를 선택하세요"
            />
          )}

          {/* 한 줄 경험 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이곳은 어땠나요?
            </label>
            <div className="relative">
            <input
              type="text"
                value={formData.short_desc}
                onChange={(e) => setFormData((prev) => ({ ...prev, short_desc: e.target.value }))}
                className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="예: 혼자 가기 좋고 웨이팅 없어서 편해요"
              />
              {formData.short_desc.trim() && (
                <button
                  type="button"
                  onClick={handleGetSuggestions}
                  disabled={isGeneratingTags}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                  title="AI 태그 추천"
                >
                  {isGeneratingTags ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                </button>
              )}
            </div>
            {suggestions && (
              <div className="mt-2">
                {getSuggestedFeaturesText() && (
                  <p className="text-xs text-orange-500">
                    AI 추천 특징: {getSuggestedFeaturesText()}
                  </p>
                )}
                {renderSuggestedTags()}
                {suggestions.confidence > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    확신도: {Math.round(suggestions.confidence * 100)}%
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 특징 (Features) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">특징</label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleFeatureToggle(option.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    features[option.key]
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 태그 표시 */}
          {customTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">선택된 태그</label>
              <div className="flex flex-wrap gap-1.5">
                {customTags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    {tag}
                    <X size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 이미지 */}
          <ImageUpload
            label="이미지"
            value={formData.imageUrl}
            onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
          />

          {/* 쩝쩝박사 라벨 (주인장만 수정 가능) */}
          {isOwnerMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">주인장 평점</label>
              <select
                value={getRatingLabel(formData.rating)}
                onChange={(e) => setFormData((prev) => ({ ...prev, rating: getRatingFromLabel(e.target.value as RatingLabel) }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {RATING_LABELS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 주인장 다녀옴 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.curator_visited !== false}
              onChange={(e) => setFormData((prev) => ({ ...prev, curator_visited: e.target.checked }))}
              className="rounded border-gray-300 text-point focus:ring-point"
            />
            <span className="text-sm text-gray-700">주인장이 직접 다녀온 장소</span>
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              isFormValid
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
