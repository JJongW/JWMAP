// ---- Category Hierarchy ----
export const CATEGORY_HIERARCHY: Record<string, string[]> = {
  '밥': ['덮밥', '정식', '도시락', '백반', '돈까스', '한식', '카레'],
  '면': ['라멘', '국수', '파스타', '쌀국수', '우동', '냉면', '소바'],
  '국물': ['국밥', '찌개', '탕', '전골'],
  '고기요리': ['구이', '스테이크', '바비큐', '수육'],
  '해산물': ['해산물요리', '회', '해물찜', '해물탕', '조개/굴'],
  '간편식': ['김밥', '샌드위치', '토스트', '햄버거', '타코', '분식'],
  '양식·퓨전': ['베트남', '아시안', '인도', '양식', '중식', '프랑스', '파스타', '피자', '리조또', '브런치'],
  '디저트': ['케이크', '베이커리', '도넛', '아이스크림'],
  '카페': ['커피', '차', '논커피', '와인바/바', '카공카페'],
  '술안주': ['이자카야', '포차', '안주 전문'],
};

export const CATEGORY_MAINS = Object.keys(CATEGORY_HIERARCHY);

// ---- Feature Options ----
export const FEATURE_OPTIONS: { key: string; label: string }[] = [
  { key: 'solo_ok', label: '혼밥 가능' },
  { key: 'quiet', label: '조용한' },
  { key: 'wait_short', label: '웨이팅 짧음' },
  { key: 'date_ok', label: '데이트' },
  { key: 'group_ok', label: '단체석' },
  { key: 'parking', label: '주차 가능' },
  { key: 'pet_friendly', label: '반려동물' },
  { key: 'reservation', label: '예약 가능' },
  { key: 'late_night', label: '심야 영업' },
];

// ---- Price Options ----
export const PRICE_OPTIONS = [
  { value: 1, label: '₩ 저렴' },
  { value: 2, label: '₩₩ 보통' },
  { value: 3, label: '₩₩₩ 비쌈' },
  { value: 4, label: '₩₩₩₩ 고급' },
] as const;
