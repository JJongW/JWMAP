// 대분류 (시/도)
export type Province =
  | '서울'
  | '경기'
  | '인천'
  | '부산'
  | '대구'
  | '대전'
  | '광주'
  | '울산'
  | '세종'
  | '강원'
  | '충북'
  | '충남'
  | '전북'
  | '전남'
  | '경북'
  | '경남'
  | '제주';

// 지역 계층 구조 데이터
export const REGION_HIERARCHY: Record<Province, string[]> = {
  '서울': [
    '강남', '서초', '잠실/송파/강동', '영등포/여의도/강서', '건대/성수/왕십리',
    '종로/중구', '홍대/합정/마포/연남', '용산/이태원/한남', '성북/노원/중랑',
    '구로/관악/동작', '신촌/연희', '창동/도봉산', '회기/청량리', '강동/고덕',
    '연신내/구파발', '마곡/김포', '미아/수유/북한산', '목동/양천', '금천/가산'
  ],
  '경기': [
    '수원', '성남/분당', '고양/일산', '용인', '부천', '안양/과천', '안산',
    '화성/동탄', '평택', '의정부', '파주', '김포', '광명', '광주', '하남',
    '시흥', '군포/의왕', '오산', '이천', '안성', '양평/여주', '구리/남양주', '포천/동두천'
  ],
  '인천': [
    '부평', '송도/연수', '계양', '남동구', '서구/검단', '중구/동구', '강화/옹진'
  ],
  '부산': [
    '서면', '해운대', '광안리/수영', '센텀시티', '남포동/중앙동', '동래/온천장',
    '사상/덕천', '기장', '사하/다대포', '연산/토곡'
  ],
  '대구': [
    '동성로/중구', '수성구', '범어/만촌', '동대구/신천', '북구/칠곡', '달서구', '경대/대현'
  ],
  '대전': [
    '둔산', '유성/궁동', '대전역/중앙로', '서구/관저', '동구/대동'
  ],
  '광주': [
    '충장로/동구', '상무지구', '첨단지구', '수완지구', '광주송정역'
  ],
  '울산': [
    '삼산/신정', '성남동/중구', '동구/방어진', '울주/언양'
  ],
  '세종': [
    '조치원', '정부청사/어진동', '나성동/다정동'
  ],
  '강원': [
    '춘천', '원주', '강릉', '속초/양양', '동해/삼척', '평창/정선', '홍천/횡성'
  ],
  '충북': [
    '청주', '충주', '제천', '음성/진천'
  ],
  '충남': [
    '천안', '아산', '서산/당진', '공주/부여', '논산/계룡', '홍성/예산'
  ],
  '전북': [
    '전주', '익산', '군산', '정읍/김제', '남원/순창'
  ],
  '전남': [
    '여수', '순천', '광양', '목포', '나주', '무안/영암'
  ],
  '경북': [
    '포항', '경주', '구미', '안동', '김천', '영주/봉화', '상주/문경'
  ],
  '경남': [
    '창원/마산', '김해', '진주', '양산', '거제', '통영/고성', '밀양/창녕'
  ],
  '제주': [
    '제주시', '서귀포', '애월/한림', '성산/표선', '중문'
  ]
};

// 모든 Province 목록 가져오기
export const PROVINCES: Province[] = Object.keys(REGION_HIERARCHY) as Province[];

// 특정 Province의 District 목록 가져오기
export function getDistrictsByProvince(province: Province): string[] {
  return REGION_HIERARCHY[province] || [];
}

// Region(소분류)으로부터 Province(대분류) 추론 - 기존 데이터 호환용
export function inferProvinceFromRegion(region: string): Province | null {
  for (const [province, districts] of Object.entries(REGION_HIERARCHY)) {
    if (districts.includes(region)) {
      return province as Province;
    }
  }
  return null;
}

// Region은 이제 string으로 유연하게 처리 (하위 호환성 + 확장성)
export type Region = string;

export type Category =
  | '전체'
  | '한식'
  | '중식'
  | '일식'
  | '라멘'
  | '양식'
  | '분식'
  | '호프집'
  | '칵테일바'
  | '와인바'
  | '아시안'
  | '돈까스'
  | '회'
  | '피자'
  | '베이커리'
  | '카페'
  | '카공카페'
  | '버거';

export interface Features {
  solo_ok?: boolean;       // 혼밥 가능
  quiet?: boolean;         // 조용한 분위기
  wait_short?: boolean;    // 웨이팅 짧음
  date_ok?: boolean;       // 데이트 추천
  group_ok?: boolean;      // 단체석 있음
  parking?: boolean;       // 주차 가능
  pet_friendly?: boolean;  // 반려동물 동반
  reservation?: boolean;   // 예약 가능
  late_night?: boolean;    // 심야 영업
}

// 방문 유형
export type VisitType = 'first' | 'revisit';

// 공개 유형 (내돈내산/초대/협찬)
export type DisclosureType = 'paid' | 'invited' | 'sponsored';

export interface Location {
  id: string;
  name: string;
  province?: Province; // 대분류 (시/도) - 새 필드
  region: Region;      // 소분류 (구/동)
  category: Category;
  lon: number;
  lat: number;
  memo: string
  address: string;
  rating: number;
  imageUrl: string;
  eventTags?: string[]; // 이벤트 태그 (예: ['흑백요리사 시즌2'])
  features?: Features;  // 장소 특징
  short_desc?: string;  // 한 줄 경험/설명 (큐레이터 원라이너)
  kakao_place_id?: string; // 카카오 장소 ID
  tags?: string[];      // LLM 추천 태그 (예: ['혼밥', '조용한 분위기'])
  // 큐레이터 관련 필드
  curator_visited_at?: string;  // 큐레이터 방문 일시
  curator_visit_slot?: string;  // 방문 시간대 (점심/저녁/심야 등)
  disclosure?: DisclosureType;  // 내돈내산/초대/협찬
}

// 커뮤니티 리뷰
export interface Review {
  id: string;
  location_id: string;
  user_id?: string;           // 익명 가능
  user_display_name?: string; // 표시 이름
  one_liner: string;          // 한 줄 리뷰 (필수)
  visit_type: VisitType;      // 첫방문/재방문
  features?: Features;        // 선택한 특징 태그
  created_at: string;
}