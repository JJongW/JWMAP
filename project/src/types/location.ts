export type Region = 
  | '서울 전체'
  | '강남'
  | '서초'
  | '잠실/송파/강동'
  | '영등포/여의도/강서'
  | '건대/성수/왕십리'
  | '종로/중구'
  | '홍대/합정/마포/연남'
  | '용산/이태원/한남'
  | '성북/노원/중랑'
  | '구로/관악/동작'
  | '신촌/연희'
  | '창동/도봉산'
  | '회기/청량리'
  | '강동/고덕'
  | '연신내/구파발'
  | '마곡/김포'
  | '미아/수유/북한산'
  | '목동/양천'
  | '금천/가산';

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

export interface Location {
  id: string;
  name: string;
  region: Region;
  category: Category;
  lon: number;
  lat: number;
  memo: string
  address: string;
  rating: number;
  imageUrl: string;
  eventTags?: string[]; // 이벤트 태그 (예: ['흑백요리사 시즌2'])
  features?: Features;  // 장소 특징
  short_desc?: string;  // 한 줄 경험/설명
  kakao_place_id?: string; // 카카오 장소 ID
}