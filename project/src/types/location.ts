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
  | '양식'
  | '분식'
  | '호프집'
  | '칵테일바'
  | '아시안'
  | '돈까스'
  | '회'
  | '피자'
  | '베이커리'
  | '카페'
  | '카공카페'
  | '버거';

export interface Location {
  id: string;
  name: string;
  region: Region;
  category: Category;
  lon: number;
  lat: number;
  address: string;
  rating: number;
  imageUrl: string;
}