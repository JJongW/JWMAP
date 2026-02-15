import type { CategoryMain, CategorySub } from '../types/location';

type CategoryMatch = { categoryMain?: CategoryMain; categorySub?: CategorySub };

export function mapKakaoCategoryToOurs(kakaoCategory: string): CategoryMatch {
  const lower = kakaoCategory.toLowerCase();

  if (lower.includes('한식') || lower.includes('국밥') || lower.includes('정식') || lower.includes('덮밥') || lower.includes('백반') || lower.includes('도시락')) {
    if (lower.includes('돈까스') || lower.includes('돈카츠')) return { categoryMain: '밥', categorySub: '돈까스' };
    if (lower.includes('카레')) return { categoryMain: '밥', categorySub: '카레' };
    return { categoryMain: '밥', categorySub: '한식' };
  }

  if (lower.includes('라멘')) return { categoryMain: '면', categorySub: '라멘' };
  if (lower.includes('국수') || lower.includes('냉면') || lower.includes('소바')) {
    if (lower.includes('냉면')) return { categoryMain: '면', categorySub: '냉면' };
    if (lower.includes('소바')) return { categoryMain: '면', categorySub: '소바' };
    return { categoryMain: '면', categorySub: '국수' };
  }
  if (lower.includes('파스타') || lower.includes('우동') || lower.includes('쌀국수')) {
    if (lower.includes('파스타')) return { categoryMain: '면', categorySub: '파스타' };
    if (lower.includes('우동')) return { categoryMain: '면', categorySub: '우동' };
    if (lower.includes('쌀국수')) return { categoryMain: '면', categorySub: '쌀국수' };
  }

  if (lower.includes('국밥') || lower.includes('찌개') || lower.includes('탕') || lower.includes('전골')) {
    if (lower.includes('국밥')) return { categoryMain: '국물', categorySub: '국밥' };
    if (lower.includes('찌개')) return { categoryMain: '국물', categorySub: '찌개' };
    if (lower.includes('탕')) return { categoryMain: '국물', categorySub: '탕' };
    if (lower.includes('전골')) return { categoryMain: '국물', categorySub: '전골' };
  }

  if (lower.includes('고기') || lower.includes('구이') || lower.includes('스테이크') || lower.includes('바비큐') || lower.includes('수육')) {
    if (lower.includes('구이')) return { categoryMain: '고기요리', categorySub: '구이' };
    if (lower.includes('스테이크')) return { categoryMain: '고기요리', categorySub: '스테이크' };
    if (lower.includes('바비큐')) return { categoryMain: '고기요리', categorySub: '바비큐' };
    if (lower.includes('수육')) return { categoryMain: '고기요리', categorySub: '수육' };
    return { categoryMain: '고기요리' };
  }

  if (lower.includes('회') || lower.includes('해산물') || lower.includes('해물') || lower.includes('조개') || lower.includes('굴')) {
    if (lower.includes('회')) return { categoryMain: '해산물', categorySub: '회' };
    if (lower.includes('해물찜')) return { categoryMain: '해산물', categorySub: '해물찜' };
    if (lower.includes('해물탕')) return { categoryMain: '해산물', categorySub: '해물탕' };
    if (lower.includes('조개') || lower.includes('굴')) return { categoryMain: '해산물', categorySub: '조개/굴' };
    return { categoryMain: '해산물', categorySub: '해산물요리' };
  }

  if (lower.includes('분식') || lower.includes('김밥') || lower.includes('샌드위치') || lower.includes('토스트') || lower.includes('햄버거') || lower.includes('버거') || lower.includes('타코')) {
    if (lower.includes('분식')) return { categoryMain: '간편식', categorySub: '분식' };
    if (lower.includes('김밥')) return { categoryMain: '간편식', categorySub: '김밥' };
    if (lower.includes('샌드위치')) return { categoryMain: '간편식', categorySub: '샌드위치' };
    if (lower.includes('토스트')) return { categoryMain: '간편식', categorySub: '토스트' };
    if (lower.includes('햄버거') || lower.includes('버거')) return { categoryMain: '간편식', categorySub: '햄버거' };
    if (lower.includes('타코')) return { categoryMain: '간편식', categorySub: '타코' };
  }

  if (lower.includes('중식') || lower.includes('베트남') || lower.includes('태국') || lower.includes('인도') || lower.includes('프랑스') || lower.includes('아시안') || lower.includes('양식') || lower.includes('파스타') || lower.includes('피자') || lower.includes('리조또') || lower.includes('브런치')) {
    if (lower.includes('중식')) return { categoryMain: '양식·퓨전', categorySub: '중식' };
    if (lower.includes('베트남')) return { categoryMain: '양식·퓨전', categorySub: '베트남' };
    if (lower.includes('태국') || lower.includes('인도') || lower.includes('아시안')) return { categoryMain: '양식·퓨전', categorySub: '아시안' };
    if (lower.includes('프랑스')) return { categoryMain: '양식·퓨전', categorySub: '프랑스' };
    if (lower.includes('파스타')) return { categoryMain: '양식·퓨전', categorySub: '파스타' };
    if (lower.includes('피자')) return { categoryMain: '양식·퓨전', categorySub: '피자' };
    if (lower.includes('리조또')) return { categoryMain: '양식·퓨전', categorySub: '리조또' };
    if (lower.includes('브런치')) return { categoryMain: '양식·퓨전', categorySub: '브런치' };
    return { categoryMain: '양식·퓨전', categorySub: '양식' };
  }

  if (lower.includes('케이크') || lower.includes('베이커리') || lower.includes('빵') || lower.includes('도넛') || lower.includes('아이스크림')) {
    if (lower.includes('케이크')) return { categoryMain: '디저트', categorySub: '케이크' };
    if (lower.includes('베이커리') || lower.includes('빵')) return { categoryMain: '디저트', categorySub: '베이커리' };
    if (lower.includes('도넛')) return { categoryMain: '디저트', categorySub: '도넛' };
    if (lower.includes('아이스크림')) return { categoryMain: '디저트', categorySub: '아이스크림' };
  }

  if (lower.includes('카페') || lower.includes('커피') || lower.includes('차') || lower.includes('논커피') || lower.includes('와인바') || lower.includes('바') || lower.includes('카공')) {
    if (lower.includes('카공')) return { categoryMain: '카페', categorySub: '카공카페' };
    if (lower.includes('커피')) return { categoryMain: '카페', categorySub: '커피' };
    if (lower.includes('차')) return { categoryMain: '카페', categorySub: '차' };
    if (lower.includes('논커피')) return { categoryMain: '카페', categorySub: '논커피' };
    if (lower.includes('와인바') || lower.includes('바')) return { categoryMain: '카페', categorySub: '와인바/바' };
    return { categoryMain: '카페' };
  }

  if (lower.includes('술집') || lower.includes('이자카야') || lower.includes('포차') || lower.includes('안주') || lower.includes('호프')) {
    if (lower.includes('이자카야')) return { categoryMain: '술안주', categorySub: '이자카야' };
    if (lower.includes('포차')) return { categoryMain: '술안주', categorySub: '포차' };
    if (lower.includes('안주')) return { categoryMain: '술안주', categorySub: '안주 전문' };
    return { categoryMain: '술안주' };
  }

  if (lower.includes('일식') || lower.includes('초밥') || lower.includes('돈카츠')) {
    if (lower.includes('돈카츠') || lower.includes('돈까스')) return { categoryMain: '밥', categorySub: '돈까스' };
    return { categoryMain: '양식·퓨전' };
  }

  return {};
}
