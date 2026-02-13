// 카카오 카테고리 → 우리 카테고리 매핑
export function mapKakaoCategory(kakaoCategory: string): { main?: string; sub?: string } {
  const l = kakaoCategory.toLowerCase();

  if (l.includes('돈까스') || l.includes('돈카츠')) return { main: '밥', sub: '돈까스' };
  if (l.includes('카레')) return { main: '밥', sub: '카레' };
  if (l.includes('한식') || l.includes('국밥') || l.includes('정식') || l.includes('덮밥') || l.includes('백반') || l.includes('도시락')) return { main: '밥', sub: '한식' };

  if (l.includes('라멘')) return { main: '면', sub: '라멘' };
  if (l.includes('냉면')) return { main: '면', sub: '냉면' };
  if (l.includes('소바')) return { main: '면', sub: '소바' };
  if (l.includes('국수')) return { main: '면', sub: '국수' };
  if (l.includes('우동')) return { main: '면', sub: '우동' };
  if (l.includes('쌀국수')) return { main: '면', sub: '쌀국수' };
  if (l.includes('파스타') && !l.includes('양식') && !l.includes('이탈리')) return { main: '면', sub: '파스타' };

  if (l.includes('국밥')) return { main: '국물', sub: '국밥' };
  if (l.includes('찌개')) return { main: '국물', sub: '찌개' };
  if (l.includes('전골')) return { main: '국물', sub: '전골' };
  if (l.includes('탕') && !l.includes('해물탕')) return { main: '국물', sub: '탕' };

  if (l.includes('스테이크')) return { main: '고기요리', sub: '스테이크' };
  if (l.includes('바비큐') || l.includes('bbq')) return { main: '고기요리', sub: '바비큐' };
  if (l.includes('수육')) return { main: '고기요리', sub: '수육' };
  if (l.includes('구이') || l.includes('고기')) return { main: '고기요리', sub: '구이' };

  if (l.includes('회') && !l.includes('회식')) return { main: '해산물', sub: '회' };
  if (l.includes('해물찜')) return { main: '해산물', sub: '해물찜' };
  if (l.includes('해물탕')) return { main: '해산물', sub: '해물탕' };
  if (l.includes('조개') || l.includes('굴')) return { main: '해산물', sub: '조개/굴' };
  if (l.includes('해산물') || l.includes('해물')) return { main: '해산물', sub: '해산물요리' };

  if (l.includes('분식')) return { main: '간편식', sub: '분식' };
  if (l.includes('김밥')) return { main: '간편식', sub: '김밥' };
  if (l.includes('샌드위치')) return { main: '간편식', sub: '샌드위치' };
  if (l.includes('토스트')) return { main: '간편식', sub: '토스트' };
  if (l.includes('햄버거') || l.includes('버거')) return { main: '간편식', sub: '햄버거' };
  if (l.includes('타코')) return { main: '간편식', sub: '타코' };

  if (l.includes('중식') || l.includes('중국')) return { main: '양식·퓨전', sub: '중식' };
  if (l.includes('베트남')) return { main: '양식·퓨전', sub: '베트남' };
  if (l.includes('태국') || l.includes('인도') || l.includes('아시안')) return { main: '양식·퓨전', sub: '아시안' };
  if (l.includes('프랑스')) return { main: '양식·퓨전', sub: '프랑스' };
  if (l.includes('파스타') || l.includes('이탈리')) return { main: '양식·퓨전', sub: '파스타' };
  if (l.includes('피자')) return { main: '양식·퓨전', sub: '피자' };
  if (l.includes('리조또')) return { main: '양식·퓨전', sub: '리조또' };
  if (l.includes('브런치')) return { main: '양식·퓨전', sub: '브런치' };
  if (l.includes('양식')) return { main: '양식·퓨전', sub: '양식' };

  if (l.includes('케이크')) return { main: '디저트', sub: '케이크' };
  if (l.includes('베이커리') || l.includes('빵')) return { main: '디저트', sub: '베이커리' };
  if (l.includes('도넛')) return { main: '디저트', sub: '도넛' };
  if (l.includes('아이스크림')) return { main: '디저트', sub: '아이스크림' };

  if (l.includes('카공')) return { main: '카페', sub: '카공카페' };
  if (l.includes('와인바') || (l.includes('바') && l.includes('술'))) return { main: '카페', sub: '와인바/바' };
  if (l.includes('카페') || l.includes('커피')) return { main: '카페', sub: '커피' };

  if (l.includes('이자카야')) return { main: '술안주', sub: '이자카야' };
  if (l.includes('포차')) return { main: '술안주', sub: '포차' };
  if (l.includes('술집') || l.includes('안주') || l.includes('호프')) return { main: '술안주', sub: '안주 전문' };

  if (l.includes('일식') || l.includes('초밥')) return { main: '양식·퓨전' };

  return {};
}

// 주소 → 지역 자동 추출
type Province = string;

const PROVINCE_PATTERNS: { pattern: string; province: Province }[] = [
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
  { pattern: '충청북도', province: '충북' }, { pattern: '충북', province: '충북' },
  { pattern: '충청남도', province: '충남' }, { pattern: '충남', province: '충남' },
  { pattern: '전라북도', province: '전북' }, { pattern: '전북', province: '전북' },
  { pattern: '전라남도', province: '전남' }, { pattern: '전남', province: '전남' },
  { pattern: '경상북도', province: '경북' }, { pattern: '경북', province: '경북' },
  { pattern: '경상남도', province: '경남' }, { pattern: '경남', province: '경남' },
  { pattern: '제주', province: '제주' },
];

const DISTRICT_MAPS: Record<string, Record<string, string>> = {
  '서울': {
    '강남구': '강남', '서초구': '서초', '송파구': '잠실/송파/강동', '강동구': '잠실/송파/강동',
    '영등포구': '영등포/여의도/강서', '강서구': '영등포/여의도/강서',
    '광진구': '건대/성수/왕십리', '성동구': '건대/성수/왕십리',
    '종로구': '종로/중구', '중구': '종로/중구',
    '마포구': '홍대/합정/마포/연남', '용산구': '용산/이태원/한남',
    '성북구': '성북/노원/중랑', '노원구': '성북/노원/중랑', '중랑구': '성북/노원/중랑',
    '구로구': '구로/관악/동작', '관악구': '구로/관악/동작', '동작구': '구로/관악/동작',
    '서대문구': '신촌/연희', '도봉구': '창동/도봉산', '동대문구': '회기/청량리',
    '은평구': '연신내/구파발', '강북구': '미아/수유/북한산', '양천구': '목동/양천', '금천구': '금천/가산',
  },
  '경기': {
    '수원시': '수원', '성남시': '성남/분당', '분당': '성남/분당', '고양시': '고양/일산', '일산': '고양/일산',
    '용인시': '용인', '부천시': '부천', '안양시': '안양/과천', '과천시': '안양/과천',
    '안산시': '안산', '화성시': '화성/동탄', '동탄': '화성/동탄', '평택시': '평택',
    '의정부시': '의정부', '파주시': '파주', '김포시': '김포', '광명시': '광명',
    '광주시': '광주', '하남시': '하남', '시흥시': '시흥', '군포시': '군포/의왕', '의왕시': '군포/의왕',
    '오산시': '오산', '이천시': '이천', '안성시': '안성', '양평군': '양평/여주', '여주시': '양평/여주',
    '구리시': '구리/남양주', '남양주시': '구리/남양주', '포천시': '포천/동두천', '동두천시': '포천/동두천',
    '양주시': '양주', '가평군': '가평', '연천군': '연천',
  },
  '인천': {
    '부평구': '부평', '연수구': '송도/연수', '계양구': '계양', '남동구': '남동구',
    '서구': '서구/검단', '중구': '중구/동구', '동구': '중구/동구', '강화군': '강화/옹진', '옹진군': '강화/옹진',
  },
  '부산': {
    '부산진구': '서면', '해운대구': '해운대', '수영구': '광안리/수영',
    '중구': '남포동/중앙동', '동래구': '동래/온천장', '사상구': '사상/덕천',
    '기장군': '기장', '사하구': '사하/다대포', '연제구': '연산/토곡',
  },
  '대구': { '중구': '동성로/중구', '수성구': '수성구', '동구': '동대구/신천', '북구': '북구/칠곡', '달서구': '달서구' },
  '대전': { '서구': '둔산', '유성구': '유성/궁동', '중구': '대전역/중앙로', '동구': '동구/대동' },
  '광주': { '동구': '충장로/동구', '서구': '상무지구', '광산구': '첨단지구' },
  '울산': { '남구': '삼산/신정', '중구': '성남동/중구', '동구': '동구/방어진', '울주군': '울주/언양' },
  '제주': { '제주시': '제주시', '서귀포시': '서귀포' },
};

export function extractRegionFromAddress(address: string): { province: string; region: string; sub_region: string } | null {
  let province: string | null = null;
  for (const { pattern, province: p } of PROVINCE_PATTERNS) {
    if (address.includes(pattern)) { province = p; break; }
  }
  if (!province) return null;

  let region = '';
  const map = DISTRICT_MAPS[province];
  if (map) {
    for (const [key, value] of Object.entries(map)) {
      if (address.includes(key)) { region = value; break; }
    }
  }

  // Extract sub_region (동/읍/면/리)
  let sub_region = '';
  const dongMatch = address.match(/\s([가-힣]+[동읍면리])\s?/);
  if (dongMatch) {
    sub_region = dongMatch[1];
  }

  return { province, region, sub_region };
}
