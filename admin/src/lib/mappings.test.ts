import { describe, it, expect } from 'vitest';
import { mapKakaoCategory, mapKakaoCategoryByDomain, extractRegionFromAddress } from './mappings';

describe('mapKakaoCategory', () => {
  // 밥
  it('한식을 인식한다', () => {
    expect(mapKakaoCategory('한식')).toEqual({ main: '밥', sub: '한식' });
  });
  it('돈까스를 인식한다', () => {
    expect(mapKakaoCategory('돈까스·회·일식 > 돈까스')).toEqual({ main: '밥', sub: '돈까스' });
  });

  // 면
  it('라멘을 인식한다', () => {
    expect(mapKakaoCategory('라멘')).toEqual({ main: '면', sub: '라멘' });
  });
  it('냉면을 인식한다', () => {
    expect(mapKakaoCategory('냉면')).toEqual({ main: '면', sub: '냉면' });
  });

  // 국물
  it('찌개를 인식한다', () => {
    expect(mapKakaoCategory('찌개,전골')).toEqual({ main: '국물', sub: '찌개' });
  });

  // 고기요리
  it('고기구이를 인식한다', () => {
    expect(mapKakaoCategory('고기구이')).toEqual({ main: '고기요리', sub: '구이' });
  });
  it('스테이크를 인식한다', () => {
    expect(mapKakaoCategory('스테이크')).toEqual({ main: '고기요리', sub: '스테이크' });
  });

  // 해산물
  it('회를 인식한다', () => {
    expect(mapKakaoCategory('회 전문점')).toEqual({ main: '해산물', sub: '회' });
  });
  it('해물탕을 인식한다', () => {
    expect(mapKakaoCategory('해물탕')).toEqual({ main: '해산물', sub: '해물탕' });
  });

  // 간편식
  it('분식을 인식한다', () => {
    expect(mapKakaoCategory('분식')).toEqual({ main: '간편식', sub: '분식' });
  });
  it('햄버거를 인식한다', () => {
    expect(mapKakaoCategory('햄버거')).toEqual({ main: '간편식', sub: '햄버거' });
  });

  // 양식·퓨전
  it('이탈리안을 인식한다', () => {
    expect(mapKakaoCategory('이탈리아 레스토랑')).toEqual({ main: '양식·퓨전', sub: '파스타' });
  });
  it('중식을 인식한다', () => {
    expect(mapKakaoCategory('중식')).toEqual({ main: '양식·퓨전', sub: '중식' });
  });
  it('브런치를 인식한다', () => {
    expect(mapKakaoCategory('브런치카페')).toEqual({ main: '양식·퓨전', sub: '브런치' });
  });

  // 디저트
  it('베이커리를 인식한다', () => {
    expect(mapKakaoCategory('베이커리')).toEqual({ main: '디저트', sub: '베이커리' });
  });
  it('케이크를 인식한다', () => {
    expect(mapKakaoCategory('케이크전문점')).toEqual({ main: '디저트', sub: '케이크' });
  });

  // 카페
  it('카페를 인식한다', () => {
    expect(mapKakaoCategory('카페')).toEqual({ main: '카페', sub: '커피' });
  });
  it('카공카페를 인식한다', () => {
    expect(mapKakaoCategory('카공카페')).toEqual({ main: '카페', sub: '카공카페' });
  });

  // 술안주
  it('이자카야를 인식한다', () => {
    expect(mapKakaoCategory('이자카야')).toEqual({ main: '술안주', sub: '이자카야' });
  });
  it('포차를 인식한다', () => {
    expect(mapKakaoCategory('포차')).toEqual({ main: '술안주', sub: '포차' });
  });

  // 매핑 불가
  it('매핑 안되면 빈 객체를 반환한다', () => {
    expect(mapKakaoCategory('주유소')).toEqual({});
  });
});

describe('mapKakaoCategoryByDomain', () => {
  it('attractions 도메인에서 전시를 인식한다', () => {
    expect(mapKakaoCategoryByDomain('전시관', 'attractions')).toEqual({ main: '전시/문화', sub: '전시관' });
  });
  it('attractions 도메인에서 미술관을 인식한다', () => {
    expect(mapKakaoCategoryByDomain('미술관', 'attractions')).toEqual({ main: '전시/문화', sub: '미술관' });
  });
  it('attractions 도메인에서 팝업을 인식한다', () => {
    expect(mapKakaoCategoryByDomain('팝업스토어', 'attractions')).toEqual({ main: '팝업/이벤트', sub: '브랜드 팝업' });
  });
  it('attractions 도메인에서 소품샵을 인식한다', () => {
    expect(mapKakaoCategoryByDomain('소품샵', 'attractions')).toEqual({ main: '쇼핑/소품', sub: '소품샵' });
  });
  it('locations 도메인은 기본 매핑을 사용한다', () => {
    expect(mapKakaoCategoryByDomain('카페', 'locations')).toEqual({ main: '카페', sub: '커피' });
  });
});

describe('extractRegionFromAddress', () => {
  it('서울 주소를 파싱한다', () => {
    const result = extractRegionFromAddress('서울특별시 마포구 연남동 123-4');
    expect(result).not.toBeNull();
    expect(result!.province).toBe('서울');
    expect(result!.region).toBe('홍대/합정/마포/연남');
    expect(result!.sub_region).toBe('연남동');
  });

  it('서울 강남구를 파싱한다', () => {
    const result = extractRegionFromAddress('서울특별시 강남구 역삼동 100');
    expect(result!.province).toBe('서울');
    expect(result!.region).toBe('강남');
  });

  it('경기 수원시를 파싱한다', () => {
    const result = extractRegionFromAddress('경기도 수원시 팔달구 인계동');
    expect(result!.province).toBe('경기');
    expect(result!.region).toBe('수원');
  });

  it('부산 해운대를 파싱한다', () => {
    const result = extractRegionFromAddress('부산광역시 해운대구 우동 123');
    expect(result!.province).toBe('부산');
    expect(result!.region).toBe('해운대');
  });

  it('제주를 파싱한다', () => {
    const result = extractRegionFromAddress('제주특별자치도 제주시 노형동');
    expect(result!.province).toBe('제주');
    expect(result!.region).toBe('제주시');
  });

  it('인천을 파싱한다', () => {
    const result = extractRegionFromAddress('인천광역시 연수구 송도동');
    expect(result!.province).toBe('인천');
    expect(result!.region).toBe('송도/연수');
  });

  it('매칭 안되는 주소면 null을 반환한다', () => {
    expect(extractRegionFromAddress('알 수 없는 주소')).toBeNull();
  });

  it('동/읍/면/리를 sub_region으로 추출한다', () => {
    const result = extractRegionFromAddress('서울특별시 종로구 평창동 123');
    expect(result!.sub_region).toBe('평창동');
  });
});
