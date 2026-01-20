import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';

// ============================================
// Enhanced Search Types
// ============================================

// Search Intent Classification
type SearchIntent =
  | 'DISCOVER_RECOMMEND'    // 추천해줘, 맛집 알려줘
  | 'SEARCH_BY_FOOD'        // 라멘 먹고 싶어
  | 'SEARCH_BY_CATEGORY'    // 밥집, 면집
  | 'SEARCH_BY_REGION'      // 강남 맛집
  | 'SEARCH_BY_CONSTRAINTS' // 혼밥 가능한 곳
  | 'SEARCH_BY_CONTEXT'     // 데이트 장소
  | 'COMPARE_OPTIONS'       // A vs B
  | 'RANDOM_PICK'           // 아무거나, 랜덤
  | 'FIND_NEAR_ME'          // 근처 맛집
  | 'FIND_OPEN_NOW'         // 지금 열린 곳
  | 'FIND_LATE_NIGHT'       // 야식, 심야영업
  | 'FIND_BEST_FOR'         // ~하기 좋은 곳
  | 'ASK_DETAILS'           // ~가 어때?
  | 'ASK_SIMILAR_TO'        // ~랑 비슷한 곳
  | 'ASK_EXCLUDE'           // ~빼고
  | 'CLARIFY_QUERY';        // 불명확한 쿼리

// Time of day context
type TimeOfDay = '아침' | '점심' | '저녁' | '야식' | '심야' | '브런치';

// Visit context
type VisitContext =
  | '혼밥' | '혼술' | '데이트' | '접대' | '가족모임' | '친구모임'
  | '회식' | '소개팅' | '생일' | '기념일' | '카공' | '반려동물_동반';

// Search constraints
type SearchConstraint =
  | '웨이팅_없음' | '예약_가능' | '주차_가능' | '좌석_넉넉' | '오래_앉기'
  | '조용한' | '빠른_회전' | '가성비' | '비싼_곳_제외' | '체인점_제외'
  | '관광지_제외' | '비건' | '채식' | '매운맛' | '담백';

// Enhanced LLM Query Interface
interface EnhancedLLMQuery {
  intent: SearchIntent;
  slots: {
    region: string | null;
    sub_region: string | null;
    place_name: string | null;
    category_main: string | null;
    category_sub: string | null;
    exclude_category_main: string[] | null;
    time_of_day: TimeOfDay | null;
    visit_context: VisitContext | null;
    constraints: SearchConstraint[];
    keywords: string[];
    count: number | null;
    open_now: boolean | null;
  };
}

// Search Actions for Frontend
interface SearchActions {
  mode: 'browse' | 'explore';
  should_show_map: boolean;
  result_limit: number;
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}

// UI Hints for Frontend
interface UIHints {
  message_type: 'success' | 'no_results_soft' | 'need_clarification';
  message: string;
  suggestions?: string[];
}

// Legacy LLM Query (for backward compatibility)
interface LLMQuery {
  region?: string[];
  subRegion?: string[];
  category?: string[]; // 레거시 호환
  categoryMain?: string[]; // 카테고리 대분류 (밥, 면, 국물, 고기, 해산물, 간편식, 양식, 디저트, 카페, 술안주)
  categorySub?: string[]; // 카테고리 소분류 (덮밥, 라멘, 회 등)
  excludeCategory?: string[]; // 제외할 카테고리 (예: ["카페"])
  excludeCategoryMain?: string[]; // 제외할 카테고리 대분류
  keywords?: string[];
  constraints?: {
    solo_ok?: boolean;
    quiet?: boolean;
    no_wait?: boolean;
    price_level?: number;
  };
  sort?: 'relevance' | 'rating';
}

interface TimingMetrics {
  llmMs: number;
  dbMs: number;
  totalMs: number;
}

interface Location {
  id: string;
  name: string;
  region: string;
  subRegion?: string;
  category: string;
  categoryMain?: string;
  categorySub?: string;
  tags?: string[];
  lon: number;
  lat: number;
  address: string;
  memo: string;
  shortDesc?: string;
  features?: Record<string, boolean>;
  rating: number;
  priceLevel?: number;
  naverPlaceId?: string;
  kakaoPlaceId?: string;
  imageUrl: string;
  eventTags?: string[];
  visitDate?: string;
}

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  maxOutputTokens: 500,
  apiKey: process.env.GOOGLE_API_KEY || '',
});

// ============================================
// Enhanced LLM Prompt for Query Parsing
// ============================================
const SYSTEM_PROMPT = `You are a query parser for a Seoul restaurant discovery service called "오늘 오디가?".
Your job is to understand user intent and extract structured data from natural language Korean queries.

=== INTENT CLASSIFICATION (16 types) ===
Choose ONE that best matches the query:
- DISCOVER_RECOMMEND: 추천해줘, 맛집 알려줘, 좋은 곳
- SEARCH_BY_FOOD: specific food (라멘 먹고 싶어, 스테이크 어디)
- SEARCH_BY_CATEGORY: category type (밥집, 면집, 카페)
- SEARCH_BY_REGION: region focus (강남 맛집, 홍대 맛집)
- SEARCH_BY_CONSTRAINTS: feature focus (혼밥 가능한 곳, 주차 되는 곳)
- SEARCH_BY_CONTEXT: context focus (데이트 장소, 회식 장소)
- COMPARE_OPTIONS: A vs B, A랑 B 비교
- RANDOM_PICK: 아무거나, 랜덤, 뭐 먹지
- FIND_NEAR_ME: 근처 맛집, 가까운 곳
- FIND_OPEN_NOW: 지금 열린 곳, 영업 중
- FIND_LATE_NIGHT: 야식, 심야영업, 새벽
- FIND_BEST_FOR: ~하기 좋은 곳
- ASK_DETAILS: specific place question (히코 어때?, ~는 어떤 곳?)
- ASK_SIMILAR_TO: ~랑 비슷한 곳, ~같은 곳
- ASK_EXCLUDE: ~빼고, ~제외
- CLARIFY_QUERY: unclear or incomplete query

=== REGION MAPPING (use exact strings) ===
IMPORTANT: When user mentions any location name below, map it to the corresponding region string.
- "서울 전체" - all of Seoul
- "강남" - 강남역, 강남구, 선릉, 역삼, 논현, 신사, 압구정, 청담
- "서초" - 서초구, 교대, 양재, 서초역, 반포
- "잠실/송파/강동" - 잠실, 송파구, 강동구, 천호, 올림픽공원, 방이
- "영등포/여의도/강서" - 영등포, 여의도, 강서구, 마곡, 등촌, 목동
- "건대/성수/왕십리" - 건대, 건대입구, 성수동, 성수, 왕십리, 성동구, 뚝섬
- "종로/중구" - 종로, 중구, 을지로, 명동, 동대문, 광화문, 인사동
- "홍대/합정/마포/연남" - 홍대, 홍대입구, 합정, 마포구, 연남동, 상수, 서교
- "용산/이태원/한남" - 용산구, 이태원, 한남동, 용산역, 이촌
- "성북/노원/중랑" - 성북구, 노원구, 중랑구, 미아, 길음
- "구로/관악/동작" - 구로, 구로구, 관악, 관악구, 동작구, 신림, 사당, 사당역, 보라매, 노량진, 흑석, 상도
- "신촌/연희" - 신촌, 연희동, 이대, 서대문구
- "창동/도봉산" - 창동, 도봉구, 수유
- "회기/청량리" - 회기, 청량리, 동대문구, 이문, 휘경
- "강동/고덕" - 강동구, 고덕, 암사
- "연신내/구파발" - 연신내, 구파발, 은평구, 불광
- "마곡/김포" - 마곡, 김포공항, 방화
- "미아/수유/북한산" - 미아, 수유, 북한산, 강북구
- "목동/양천" - 목동, 양천구, 오목교, 신정
- "금천/가산" - 금천구, 가산디지털단지, 독산, 시흥

=== CATEGORY MAPPING ===
대분류 (category_main):
- "밥" → 덮밥, 정식, 도시락, 백반, 돈까스, 한식, 카레
- "면" → 라멘, 국수, 파스타, 쌀국수, 우동, 냉면, 소바
- "국물" → 국밥, 찌개, 탕, 전골
- "고기요리" → 구이, 스테이크, 바비큐, 수육
- "해산물" → 해산물요리, 회, 해물찜, 해물탕, 조개/굴
- "간편식" → 김밥, 샌드위치, 토스트, 햄버거, 타코, 분식
- "양식·퓨전" → 베트남, 아시안, 인도, 양식, 중식, 프랑스, 피자, 리조또, 브런치
- "디저트" → 케이크, 베이커리, 도넛, 아이스크림
- "카페" → 커피, 차, 논커피, 와인바/바, 카공카페
- "술안주" → 이자카야, 포차, 안주 전문

=== VISIT CONTEXT ===
- "혼밥" - eating alone (implies excluding cafe)
- "혼술" - drinking alone
- "데이트" - romantic setting
- "접대" - business hosting
- "가족모임" - family gathering
- "친구모임" - friends hangout
- "회식" - company dinner
- "소개팅" - blind date
- "생일" - birthday celebration
- "기념일" - anniversary
- "카공" - cafe for studying
- "반려동물_동반" - pet friendly

=== SEARCH CONSTRAINTS ===
- "웨이팅_없음" - no wait, 바로 입장
- "예약_가능" - reservation available
- "주차_가능" - parking available
- "좌석_넉넉" - spacious seating
- "오래_앉기" - can stay long
- "조용한" - quiet atmosphere
- "빠른_회전" - quick meal
- "가성비" - good value
- "비싼_곳_제외" - exclude expensive
- "체인점_제외" - exclude chains
- "관광지_제외" - exclude tourist traps
- "비건" - vegan
- "채식" - vegetarian
- "매운맛" - spicy
- "담백" - mild/light

=== TIME OF DAY ===
- "아침" - morning/breakfast
- "점심" - lunch
- "저녁" - dinner
- "야식" - late night snack
- "심야" - very late, past midnight
- "브런치" - brunch

=== NATURAL LANGUAGE MAPPING ===
Korean expressions to structured fields:
- "밥집", "밥 먹을 곳", "밥 먹고 싶어" → category_main: "밥"
- "면집", "면 먹을래", "국수 먹을래" → category_main: "면"
- "고기집", "고기 먹을래" → category_main: "고기요리"
- "회집", "횟집", "해산물" → category_main: "해산물"
- "술집", "한잔 하자", "안주" → category_main: "술안주"
- "카페 가자", "커피숍", "카공카페", "카공 카페", "카공" → category_main: "카페" (and category_sub: "카공카페" if explicitly mentioned)
- "맛집" → generic, don't set category
- "추천해줘", "알려줘", "보여줘" → ignore (no semantic value)
- "[place name] 어때?", "[place name] 어떤 곳?" → ASK_DETAILS intent, put name in place_name

=== OUTPUT JSON SCHEMA ===
{
  "intent": "ONE_OF_16_INTENTS",
  "slots": {
    "region": "exact region string or null",
    "sub_region": "finer location like 한남동 or null",
    "place_name": "if asking about specific place, else null",
    "category_main": "one category main or null",
    "category_sub": "specific sub-category or null",
    "exclude_category_main": ["categories to exclude"],
    "time_of_day": "time context or null",
    "visit_context": "visit context or null",
    "constraints": ["array of constraints"],
    "keywords": ["food names, dish names, tags"],
    "count": number or null,
    "open_now": boolean or null
  }
}

=== EXAMPLES ===
"용산 맛집" → {"intent": "SEARCH_BY_REGION", "slots": {"region": "용산/이태원/한남", "keywords": ["맛집"]}}

"사당 맛집" → {"intent": "SEARCH_BY_REGION", "slots": {"region": "구로/관악/동작", "keywords": ["맛집"]}}

"신림 맛집" → {"intent": "SEARCH_BY_REGION", "slots": {"region": "구로/관악/동작", "keywords": ["맛집"]}}

"용산 혼밥" → {"intent": "SEARCH_BY_CONSTRAINTS", "slots": {"region": "용산/이태원/한남", "visit_context": "혼밥", "exclude_category_main": ["카페"]}}

"강남 라멘" → {"intent": "SEARCH_BY_FOOD", "slots": {"region": "강남", "category_sub": "라멘", "keywords": ["라멘"]}}

"홍대 데이트 맛집" → {"intent": "SEARCH_BY_CONTEXT", "slots": {"region": "홍대/합정/마포/연남", "visit_context": "데이트"}}

"히코 어때?" → {"intent": "ASK_DETAILS", "slots": {"place_name": "히코", "keywords": ["히코"]}}

"야식 맛집" → {"intent": "FIND_LATE_NIGHT", "slots": {"time_of_day": "야식"}}

"카페 빼고 맛집" → {"intent": "ASK_EXCLUDE", "slots": {"exclude_category_main": ["카페"]}}

"강남 면집 추천" → {"intent": "SEARCH_BY_CATEGORY", "slots": {"region": "강남", "category_main": "면"}}

"카공카페" → {"intent": "SEARCH_BY_CATEGORY", "slots": {"category_main": "카페", "category_sub": "카공카페"}}

"강남 카공카페" → {"intent": "SEARCH_BY_CATEGORY", "slots": {"region": "강남", "category_main": "카페", "category_sub": "카공카페"}}

"웨이팅 없는 곳" → {"intent": "SEARCH_BY_CONSTRAINTS", "slots": {"constraints": ["웨이팅_없음"]}}

"주차 가능한 고기집" → {"intent": "SEARCH_BY_CONSTRAINTS", "slots": {"category_main": "고기요리", "constraints": ["주차_가능"]}}

=== RULES ===
1. "혼밥" always adds visit_context: "혼밥" AND exclude_category_main: ["카페"]
2. If user mentions a specific place name (not food/category), use ASK_DETAILS intent
3. Always include the original food/dish names in keywords for tag matching
4. IMPORTANT: "카공카페", "카공 카페", "카공" always means category_main: "카페" AND category_sub: "카공카페". Do NOT confuse with other categories.
5. IMPORTANT: When user mentions a location name (like "사당", "신림", "강남", "홍대", etc.), ALWAYS set the region field using the exact region string from REGION MAPPING above. Examples:
   - "사당 맛집" → region: "구로/관악/동작" (not null!)
   - "신림 맛집" → region: "구로/관악/동작"
   - "강남 맛집" → region: "강남"
   - "홍대 맛집" → region: "홍대/합정/마포/연남"
   - Any location name from REGION MAPPING should be mapped to its corresponding region string
5. If unsure about region, use null (system will use UI context or default)
6. Only set fields you're confident about - don't invent data
7. Location names in queries should be mapped to region field, not left as keywords only

Output ONLY valid JSON. No explanation.`;

// Sub-region to region mapping
// 지역명(동/역/구 이름)을 region으로 매핑하는 딕셔너리
const SUB_REGION_TO_REGION: Record<string, string> = {
  // 용산/이태원/한남
  '한남동': '용산/이태원/한남',
  '이태원': '용산/이태원/한남',
  '이태원역': '용산/이태원/한남',
  '한남역': '용산/이태원/한남',
  '용산구': '용산/이태원/한남',
  '용산역': '용산/이태원/한남',
  '이촌': '용산/이태원/한남',
  // 건대/성수/왕십리
  '성수동': '건대/성수/왕십리',
  '성수': '건대/성수/왕십리',
  '건대': '건대/성수/왕십리',
  '건대입구': '건대/성수/왕십리',
  '왕십리': '건대/성수/왕십리',
  '성동구': '건대/성수/왕십리',
  '뚝섬': '건대/성수/왕십리',
  // 홍대/합정/마포/연남
  '연남동': '홍대/합정/마포/연남',
  '합정동': '홍대/합정/마포/연남',
  '합정': '홍대/합정/마포/연남',
  '홍대': '홍대/합정/마포/연남',
  '홍대입구': '홍대/합정/마포/연남',
  '서교동': '홍대/합정/마포/연남',
  '망원동': '홍대/합정/마포/연남',
  '마포구': '홍대/합정/마포/연남',
  '상수': '홍대/합정/마포/연남',
  '서교': '홍대/합정/마포/연남',
  // 종로/중구
  '을지로': '종로/중구',
  '명동': '종로/중구',
  '삼청동': '종로/중구',
  '종로구': '종로/중구',
  '중구': '종로/중구',
  '동대문': '종로/중구',
  '광화문': '종로/중구',
  '인사동': '종로/중구',
  // 신촌/연희
  '연희동': '신촌/연희',
  '신촌': '신촌/연희',
  '이대': '신촌/연희',
  '서대문구': '신촌/연희',
  // 잠실/송파/강동
  '송리단길': '잠실/송파/강동',
  '석촌': '잠실/송파/강동',
  '잠실': '잠실/송파/강동',
  '송파구': '잠실/송파/강동',
  '강동구': '잠실/송파/강동',
  '천호': '잠실/송파/강동',
  '올림픽공원': '잠실/송파/강동',
  '방이': '잠실/송파/강동',
  // 구로/관악/동작 (핵심 개선)
  '사당': '구로/관악/동작',
  '사당역': '구로/관악/동작',
  '신림': '구로/관악/동작',
  '신림역': '구로/관악/동작',
  '구로': '구로/관악/동작',
  '구로구': '구로/관악/동작',
  '구로역': '구로/관악/동작',
  '관악': '구로/관악/동작',
  '관악구': '구로/관악/동작',
  '동작구': '구로/관악/동작',
  '보라매': '구로/관악/동작',
  '노량진': '구로/관악/동작',
  '흑석': '구로/관악/동작',
  '상도': '구로/관악/동작',
  // 강남
  '강남': '강남',
  '강남구': '강남',
  '강남역': '강남',
  '선릉': '강남',
  '역삼': '강남',
  '논현': '강남',
  '신사': '강남',
  '압구정': '강남',
  '청담': '강남',
  // 서초
  '서초': '서초',
  '서초구': '서초',
  '서초역': '서초',
  '교대': '서초',
  '양재': '서초',
  '반포': '서초',
  // 영등포/여의도/강서
  '영등포': '영등포/여의도/강서',
  '여의도': '영등포/여의도/강서',
  '강서구': '영등포/여의도/강서',
  '마곡': '영등포/여의도/강서',
  '등촌': '영등포/여의도/강서',
  '목동': '영등포/여의도/강서',
};

// Category sub to main mapping
const CATEGORY_SUB_TO_MAIN: Record<string, string> = {
  '덮밥': '밥', '정식': '밥', '도시락': '밥', '백반': '밥', '돈까스': '밥', '한식': '밥', '카레': '밥',
  '라멘': '면', '국수': '면', '파스타': '면', '쌀국수': '면', '우동': '면', '냉면': '면', '소바': '면',
  '국밥': '국물', '찌개': '국물', '탕': '국물', '전골': '국물',
  '구이': '고기요리', '스테이크': '고기요리', '바비큐': '고기요리', '수육': '고기요리',
  '해산물요리': '해산물', '회': '해산물', '해물찜': '해산물', '해물탕': '해산물', '조개/굴': '해산물',
  '김밥': '간편식', '샌드위치': '간편식', '토스트': '간편식', '햄버거': '간편식', '타코': '간편식', '분식': '간편식',
  '베트남': '양식·퓨전', '아시안': '양식·퓨전', '인도': '양식·퓨전', '양식': '양식·퓨전', '중식': '양식·퓨전',
  '프랑스': '양식·퓨전', '피자': '양식·퓨전', '리조또': '양식·퓨전', '브런치': '양식·퓨전',
  '케이크': '디저트', '베이커리': '디저트', '도넛': '디저트', '아이스크림': '디저트',
  '커피': '카페', '차': '카페', '논커피': '카페', '와인바/바': '카페', '카공카페': '카페',
  '이자카야': '술안주', '포차': '술안주', '안주 전문': '술안주',
};

// ============================================
// Enhanced Query Parsing
// ============================================
async function parseEnhancedQuery(text: string): Promise<EnhancedLLMQuery> {
  const defaultQuery: EnhancedLLMQuery = {
    intent: 'CLARIFY_QUERY',
    slots: {
      region: null,
      sub_region: null,
      place_name: null,
      category_main: null,
      category_sub: null,
      exclude_category_main: null,
      time_of_day: null,
      visit_context: null,
      constraints: [],
      keywords: [],
      count: null,
      open_now: null,
    },
  };

  try {
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`Parse this query: "${text}"`),
    ];

    const response = await llm.invoke(messages);

    const content = typeof response.content === 'string'
      ? response.content
      : '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultQuery;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure proper structure
    return {
      intent: parsed.intent || 'CLARIFY_QUERY',
      slots: {
        region: parsed.slots?.region || null,
        sub_region: parsed.slots?.sub_region || null,
        place_name: parsed.slots?.place_name || null,
        category_main: parsed.slots?.category_main || null,
        category_sub: parsed.slots?.category_sub || null,
        exclude_category_main: parsed.slots?.exclude_category_main || null,
        time_of_day: parsed.slots?.time_of_day || null,
        visit_context: parsed.slots?.visit_context || null,
        constraints: parsed.slots?.constraints || [],
        keywords: parsed.slots?.keywords || [],
        count: parsed.slots?.count || null,
        open_now: parsed.slots?.open_now || null,
      },
    };
  } catch (error) {
    console.error('Enhanced LLM parsing error:', error);
    return defaultQuery;
  }
}

// Extract region from keywords if not already set
function extractRegionFromKeywords(keywords: string[]): string | null {
  if (!keywords || keywords.length === 0) return null;
  
  // 키워드에서 지역명 추출
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    
    // SUB_REGION_TO_REGION 매핑 확인
    for (const [subRegion, region] of Object.entries(SUB_REGION_TO_REGION)) {
      if (normalizedKeyword === subRegion.toLowerCase() || 
          normalizedKeyword.includes(subRegion.toLowerCase()) ||
          subRegion.toLowerCase().includes(normalizedKeyword)) {
        return region;
      }
    }
    
    // 직접 region 이름과 매칭
    const regionNames = [
      '강남', '서초', '잠실/송파/강동', '영등포/여의도/강서',
      '건대/성수/왕십리', '종로/중구', '홍대/합정/마포/연남',
      '용산/이태원/한남', '성북/노원/중랑', '구로/관악/동작',
      '신촌/연희', '창동/도봉산', '회기/청량리', '강동/고덕',
      '연신내/구파발', '마곡/김포', '미아/수유/북한산', '목동/양천', '금천/가산'
    ];
    
    for (const region of regionNames) {
      // region 이름에서 '/' 제거하고 검색
      const regionParts = region.split('/');
      for (const part of regionParts) {
        if (normalizedKeyword === part.toLowerCase() || 
            normalizedKeyword.includes(part.toLowerCase()) ||
            part.toLowerCase().includes(normalizedKeyword)) {
          return region;
        }
      }
    }
  }
  
  return null;
}

// Convert enhanced query to legacy LLMQuery for compatibility
function toLegacyQuery(enhanced: EnhancedLLMQuery): LLMQuery {
  const legacy: LLMQuery = {
    keywords: enhanced.slots.keywords || [],
    sort: 'relevance',
  };

  // region이 없으면 키워드에서 추출 시도
  let region = enhanced.slots.region;
  if (!region && enhanced.slots.keywords && enhanced.slots.keywords.length > 0) {
    region = extractRegionFromKeywords(enhanced.slots.keywords);
  }

  if (region) {
    legacy.region = [region];
  }
  if (enhanced.slots.sub_region) {
    legacy.subRegion = [enhanced.slots.sub_region];
  }
  if (enhanced.slots.category_main) {
    legacy.categoryMain = [enhanced.slots.category_main];
  }
  if (enhanced.slots.category_sub) {
    legacy.categorySub = [enhanced.slots.category_sub];
  }
  if (enhanced.slots.exclude_category_main) {
    legacy.excludeCategoryMain = enhanced.slots.exclude_category_main;
  }

  // Map constraints
  const constraints: LLMQuery['constraints'] = {};
  if (enhanced.slots.visit_context === '혼밥' || enhanced.slots.visit_context === '혼술') {
    constraints.solo_ok = true;
  }
  if (enhanced.slots.constraints.includes('조용한')) {
    constraints.quiet = true;
  }
  if (enhanced.slots.constraints.includes('웨이팅_없음')) {
    constraints.no_wait = true;
  }
  if (enhanced.slots.constraints.includes('가성비') || enhanced.slots.constraints.includes('비싼_곳_제외')) {
    constraints.price_level = 2;
  }
  if (Object.keys(constraints).length > 0) {
    legacy.constraints = constraints;
  }

  // Add place name to keywords if present
  if (enhanced.slots.place_name) {
    legacy.keywords = [...(legacy.keywords || []), enhanced.slots.place_name];
  }

  return legacy;
}

// Get location IDs that match keywords via tags (locations.tags 배열 직접 검색)
async function getLocationIdsByTags(keywords: string[]): Promise<Set<string>> {
  const locationIds = new Set<string>();

  if (!keywords || keywords.length === 0) {
    return locationIds;
  }

  // locations 테이블의 tags 배열에서 직접 검색
  // Supabase는 배열 컬럼에서 ilike 검색을 지원하지 않으므로, 모든 locations를 가져와서 필터링
  const { data: allLocations } = await supabase
    .from('locations')
    .select('id, tags');

  if (!allLocations) {
    return locationIds;
  }

  // 키워드가 tags 배열에 포함된 location 찾기
  const keywordLower = keywords.map(k => k.toLowerCase());
  allLocations.forEach((loc: { id: string; tags: string[] | null }) => {
    if (!loc.tags || !Array.isArray(loc.tags)) return;
    
    const locTagsLower = loc.tags.map(t => t.toLowerCase());
    const matches = keywordLower.some(kw => 
      locTagsLower.some(tag => tag.includes(kw) || kw.includes(tag))
    );
    
    if (matches) {
      locationIds.add(loc.id);
    }
  });

  return locationIds;
}

// Search locations based on parsed query
async function searchLocations(query: LLMQuery): Promise<Location[]> {
  let dbQuery = supabase.from('locations').select('*');

  // 키워드가 있고 region 필터가 있는지 확인
  const hasKeywords = query.keywords && query.keywords.length > 0;
  const hasRegionFilter = query.region && query.region.length > 0;

  // Filter by region
  if (query.region && query.region.length > 0) {
    const regions = query.region.filter((r) => r !== '서울 전체');
    if (regions.length > 0) {
      dbQuery = dbQuery.in('region', regions);
    }
  }

  // Filter by sub_region
  if (query.subRegion && query.subRegion.length > 0) {
    dbQuery = dbQuery.in('sub_region', query.subRegion);
  }

  // Filter by category (레거시 호환)
  if (query.category && query.category.length > 0) {
    dbQuery = dbQuery.in('category', query.category);
  }

  // Filter by categoryMain (새 구조)
  if (query.categoryMain && query.categoryMain.length > 0) {
    dbQuery = dbQuery.in('category_main', query.categoryMain);
  }

  // Filter by categorySub (새 구조)
  if (query.categorySub && query.categorySub.length > 0) {
    dbQuery = dbQuery.in('category_sub', query.categorySub);
  }

  // Filter by price level
  if (query.constraints?.price_level) {
    dbQuery = dbQuery.lte('price_level', query.constraints.price_level);
  }

  // Execute query (제외 필터는 나중에 적용)
  // 키워드 검색을 위해서는 더 많은 결과를 가져와야 함
  const limit = hasKeywords ? 200 : 100;
  const { data, error } = await dbQuery.order('rating', { ascending: false }).limit(limit);

  if (error) {
    console.error('Supabase query error:', error);
    return [];
  }

  let results: Location[] = (data || []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: item.name as string,
    region: item.region as string,
    subRegion: item.sub_region as string | undefined,
    category: item.category as string,
    lon: item.lon as number,
    lat: item.lat as number,
    address: item.address as string,
    memo: item.memo as string,
    shortDesc: item.short_desc as string | undefined,
    features: item.features as Record<string, boolean> | undefined,
    rating: item.rating as number,
    priceLevel: item.price_level as number | undefined,
    naverPlaceId: item.naver_place_id as string | undefined,
    kakaoPlaceId: item.kakao_place_id as string | undefined,
    imageUrl: (item.image_url || item.imageUrl) as string,
    eventTags: (item.event_tags || item.eventTags) as string[] | undefined,
    visitDate: (item.visit_date || item.visitDate) as string | undefined,
    // 새 카테고리 구조 추가
    categoryMain: item.category_main as string | undefined,
    categorySub: item.category_sub as string | undefined,
    tags: item.tags as string[] | undefined,
  }));

  // 제외 카테고리 필터링
  if (query.excludeCategoryMain && query.excludeCategoryMain.length > 0) {
    results = results.filter((loc) => {
      const locCategoryMain = loc.categoryMain;
      return !locCategoryMain || !query.excludeCategoryMain?.includes(locCategoryMain);
    });
  }

  // Get tag-matched location IDs for keyword boosting
  const tagMatchedIds = await getLocationIdsByTags(query.keywords || []);

  // Constraints 필터링 (더 유연하게)
  if (query.constraints) {
    results = results.filter((loc) => {
      // solo_ok: 피쳐가 있거나, 혼밥 태그가 있거나, 키워드에 혼밥이 포함된 경우
      if (query.constraints?.solo_ok) {
        const hasSoloOkFeature = loc.features?.solo_ok === true;
        const hasSoloTag = loc.tags?.some(tag => 
          ['혼밥', '혼자', '혼술'].some(keyword => tag.toLowerCase().includes(keyword.toLowerCase()))
        );
        const hasSoloKeyword = query.keywords?.some(kw => 
          ['혼밥', '혼자', '혼술'].some(keyword => kw.toLowerCase().includes(keyword.toLowerCase()))
        ) && tagMatchedIds.has(loc.id);
        
        if (!hasSoloOkFeature && !hasSoloTag && !hasSoloKeyword) {
        return false;
        }
      }

      if (query.constraints?.quiet && !loc.features?.quiet) {
        return false;
      }

      if (query.constraints?.no_wait && !loc.features?.no_wait) {
        return false;
      }

      return true;
    });
  }

  // 일반적인 키워드 목록 (키워드 필터링에서 제외)
  const GENERIC_KEYWORDS = ['맛집', '추천', '알려줘', '보여줘', '어디', '어디서', '어디가', '가고 싶어', '먹고 싶어', '가볼 곳'];

  // Keyword matching: include tag matches OR text matches
  // 단, 일반적인 키워드는 필터링하지 않음 (region/category 필터만 적용)
  if (query.keywords && query.keywords.length > 0) {
    const keywordLower = query.keywords.map((k) => k.toLowerCase());
    
    // 일반적인 키워드만 있는 경우 키워드 필터링 건너뛰기
    const hasSpecificKeywords = keywordLower.some(kw => 
      !GENERIC_KEYWORDS.some(generic => kw.includes(generic) || generic.includes(kw))
    );
    
    if (hasSpecificKeywords) {
      // 구체적인 키워드가 있는 경우에만 키워드 필터링 적용
      const filteredResults = results.filter((loc) => {
      // Include if matched by tags
      if (tagMatchedIds.has(loc.id)) {
        return true;
      }
        // Or if matched by text search (name, memo, shortDesc)
      const searchText = `${loc.name} ${loc.memo || ''} ${loc.shortDesc || ''}`.toLowerCase();
        return keywordLower.some((kw) => {
          // 일반적인 키워드는 제외
          if (GENERIC_KEYWORDS.some(generic => kw.includes(generic) || generic.includes(kw))) {
            return false;
          }
          return searchText.includes(kw);
        });
      });

      // 키워드 매칭 결과가 없어도 region 필터는 절대 무시하지 않음
      // region 필터가 있으면 그대로 유지하고 키워드 필터만 제거
      if (filteredResults.length === 0 && hasRegionFilter) {
        // region 필터는 유지하고 키워드 필터만 제거 (이미 results에 region 필터가 적용됨)
        // results는 그대로 사용 (region 필터만 적용된 상태)
      } else {
        results = filteredResults;
      }

    // Boost tag-matched results to top
    results.sort((a, b) => {
      const aTagMatch = tagMatchedIds.has(a.id) ? 1 : 0;
      const bTagMatch = tagMatchedIds.has(b.id) ? 1 : 0;
      if (aTagMatch !== bTagMatch) {
        return bTagMatch - aTagMatch;
      }
      return (b.rating || 0) - (a.rating || 0);
    });
    } else {
      // 일반적인 키워드만 있는 경우 키워드 필터링 건너뛰고 region/category 필터만 적용
      // results는 이미 region/category 필터가 적용된 상태이므로 그대로 사용
      // 태그 매칭된 결과를 상단으로 정렬
      results.sort((a, b) => {
        const aTagMatch = tagMatchedIds.has(a.id) ? 1 : 0;
        const bTagMatch = tagMatchedIds.has(b.id) ? 1 : 0;
        if (aTagMatch !== bTagMatch) {
          return bTagMatch - aTagMatch;
        }
        return (b.rating || 0) - (a.rating || 0);
      });
    }
  }

  // Sort by rating if explicitly requested
  if (query.sort === 'rating') {
    results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  // 최대 50개로 제한
  return results.slice(0, 50);
}

// ============================================
// Fallback Search Strategy (5 levels)
// ============================================

interface FallbackResult {
  places: Location[];
  fallback_applied: boolean;
  fallback_notes: string[];
  fallback_level: number;
}

// Non-critical constraints that can be dropped first
const NON_CRITICAL_CONSTRAINTS: SearchConstraint[] = [
  '체인점_제외', '관광지_제외', '가성비', '비싼_곳_제외', '빠른_회전'
];

async function searchWithFallback(
  enhanced: EnhancedLLMQuery,
  originalText: string,
  uiRegion?: string
): Promise<FallbackResult> {
  const fallbackNotes: string[] = [];

  // Create working copy of slots
  const workingSlots = { ...enhanced.slots };

  // Add original text to keywords for place name search
  if (!workingSlots.keywords.includes(originalText.trim())) {
    workingSlots.keywords = [...workingSlots.keywords, originalText.trim()];
  }

  // Use UI region as fallback if no region specified
  if (!workingSlots.region && uiRegion && uiRegion !== '서울 전체') {
    workingSlots.region = uiRegion;
  }

  // Level 0: Original query
  let legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
  let places = await searchLocations(legacyQuery);

  if (places.length > 0) {
    return {
      places,
      fallback_applied: false,
      fallback_notes: [],
      fallback_level: 0,
    };
  }

  // Level 1: Drop non-critical constraints
  if (workingSlots.constraints.length > 0) {
    const originalConstraints = [...workingSlots.constraints];
    workingSlots.constraints = workingSlots.constraints.filter(
      c => !NON_CRITICAL_CONSTRAINTS.includes(c)
    );
    if (workingSlots.constraints.length < originalConstraints.length) {
      fallbackNotes.push('일부 조건을 완화했어요');
      legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
      places = await searchLocations(legacyQuery);
      if (places.length > 0) {
        return {
          places,
          fallback_applied: true,
          fallback_notes: fallbackNotes,
          fallback_level: 1,
        };
      }
    }
  }

  // Level 2: Soften wait and other critical constraints
  if (workingSlots.constraints.includes('웨이팅_없음' as SearchConstraint)) {
    workingSlots.constraints = workingSlots.constraints.filter(c => c !== '웨이팅_없음');
    fallbackNotes.push('웨이팅 조건을 제외했어요');
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 2,
      };
    }
  }

  // Clear remaining constraints
  if (workingSlots.constraints.length > 0) {
    workingSlots.constraints = [];
    fallbackNotes.push('조건을 모두 완화했어요');
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 2,
      };
    }
  }

  // Level 3: Broaden category (category_sub → category_main)
  if (workingSlots.category_sub) {
    const categoryMain = CATEGORY_SUB_TO_MAIN[workingSlots.category_sub];
    if (categoryMain) {
      workingSlots.category_sub = null;
      workingSlots.category_main = categoryMain;
      fallbackNotes.push(`${enhanced.slots.category_sub} → ${categoryMain} 전체로 검색했어요`);
      legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
      places = await searchLocations(legacyQuery);
      if (places.length > 0) {
        return {
          places,
          fallback_applied: true,
          fallback_notes: fallbackNotes,
          fallback_level: 3,
        };
      }
    }
  }

  // Level 4: Broaden region (sub_region → region → 서울 전체)
  if (workingSlots.sub_region) {
    const broadRegion = SUB_REGION_TO_REGION[workingSlots.sub_region] || workingSlots.region;
    workingSlots.sub_region = null;
    workingSlots.region = broadRegion;
    fallbackNotes.push(`${enhanced.slots.sub_region} → ${broadRegion} 전체로 검색했어요`);
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 4,
      };
    }
  }

  if (workingSlots.region && workingSlots.region !== '서울 전체') {
    const oldRegion = workingSlots.region;
    workingSlots.region = null; // 서울 전체로 검색
    fallbackNotes.push(`${oldRegion} → 서울 전체로 검색했어요`);
    legacyQuery = toLegacyQuery({ ...enhanced, slots: workingSlots });
    places = await searchLocations(legacyQuery);
    if (places.length > 0) {
      return {
        places,
        fallback_applied: true,
        fallback_notes: fallbackNotes,
        fallback_level: 4,
      };
    }
  }

  // Level 5: Curated safe picks (top-rated diverse recommendations)
  workingSlots.category_main = null;
  workingSlots.category_sub = null;
  workingSlots.exclude_category_main = null;
  fallbackNotes.push('조건에 맞는 장소가 없어 인기 장소를 보여드려요');

  const { data: topRated } = await supabase
    .from('locations')
    .select('*')
    .order('rating', { ascending: false })
    .limit(20);

  if (topRated && topRated.length > 0) {
    places = topRated.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      name: item.name as string,
      region: item.region as string,
      subRegion: item.sub_region as string | undefined,
      category: item.category as string,
      lon: item.lon as number,
      lat: item.lat as number,
      address: item.address as string,
      memo: item.memo as string,
      shortDesc: item.short_desc as string | undefined,
      features: item.features as Record<string, boolean> | undefined,
      rating: item.rating as number,
      priceLevel: item.price_level as number | undefined,
      naverPlaceId: item.naver_place_id as string | undefined,
      kakaoPlaceId: item.kakao_place_id as string | undefined,
      imageUrl: (item.image_url || item.imageUrl) as string,
      eventTags: (item.event_tags || item.eventTags) as string[] | undefined,
      visitDate: (item.visit_date || item.visitDate) as string | undefined,
      categoryMain: item.category_main as string | undefined,
      categorySub: item.category_sub as string | undefined,
      tags: item.tags as string[] | undefined,
    }));

    return {
      places,
      fallback_applied: true,
      fallback_notes: fallbackNotes,
      fallback_level: 5,
    };
  }

  // No results at all
  return {
    places: [],
    fallback_applied: true,
    fallback_notes: fallbackNotes,
    fallback_level: 5,
  };
}

// Generate UI hints based on results and intent
function generateUIHints(
  enhanced: EnhancedLLMQuery,
  resultCount: number,
  fallbackApplied: boolean,
  fallbackNotes: string[]
): UIHints {
  if (resultCount === 0) {
    return {
      message_type: 'no_results_soft',
      message: '조건에 맞는 장소를 찾지 못했어요.',
      suggestions: [
        '다른 지역으로 검색해보세요',
        '조건을 줄여서 검색해보세요',
        '비슷한 카테고리로 검색해보세요',
      ],
    };
  }

  if (enhanced.intent === 'CLARIFY_QUERY') {
    return {
      message_type: 'need_clarification',
      message: '검색어가 명확하지 않아요.',
      suggestions: [
        '지역을 포함해서 검색해보세요 (예: 강남 라멘)',
        '음식 종류를 명시해보세요 (예: 혼밥 맛집)',
      ],
    };
  }

  if (fallbackApplied && fallbackNotes.length > 0) {
    return {
      message_type: 'success',
      message: fallbackNotes.join(' / '),
    };
  }

  return {
    message_type: 'success',
    message: `${resultCount}개의 장소를 찾았어요!`,
  };
}

// Generate search actions based on intent
function generateSearchActions(
  enhanced: EnhancedLLMQuery,
  resultCount: number,
  fallbackResult: FallbackResult
): SearchActions {
  let mode: 'browse' | 'explore' = 'browse';
  let shouldShowMap = true;
  let resultLimit = 50;

  // Adjust based on intent
  switch (enhanced.intent) {
    case 'ASK_DETAILS':
    case 'ASK_SIMILAR_TO':
      mode = 'explore';
      resultLimit = 10;
      break;
    case 'RANDOM_PICK':
      resultLimit = 5;
      break;
    case 'COMPARE_OPTIONS':
      resultLimit = 10;
      break;
    case 'FIND_NEAR_ME':
      shouldShowMap = true;
      resultLimit = 20;
      break;
    default:
      break;
  }

  return {
    mode,
    should_show_map: shouldShowMap,
    result_limit: resultLimit,
    fallback_applied: fallbackResult.fallback_applied,
    fallback_notes: fallbackResult.fallback_notes,
    fallback_level: fallbackResult.fallback_level,
  };
}

// Log search to database
async function logSearch(
  traceId: string,
  queryText: string,
  parsed: LLMQuery,
  resultCount: number,
  timing: TimingMetrics
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('search_logs')
      .insert({
        id: traceId,
        query: queryText,
        parsed: parsed,
        result_count: resultCount,
        llm_ms: timing.llmMs,
        db_ms: timing.dbMs,
        total_ms: timing.totalMs,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[${traceId}] Search log error:`, error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error(`[${traceId}] Search log exception:`, err);
    return null;
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const traceId = randomUUID();
  const startTime = Date.now();

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Trace-ID', traceId);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', traceId });
  }

  const { text, uiRegion } = req.body || {};

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "text" field', traceId });
  }

  console.log(`[${traceId}] Search request: "${text}"${uiRegion ? ` (UI region: ${uiRegion})` : ''}`);

  try {
    // 1. Parse query with enhanced LLM
    const llmStart = Date.now();
    const enhanced = await parseEnhancedQuery(text);
    const llmMs = Date.now() - llmStart;
    console.log(`[${traceId}] Enhanced LLM parsed in ${llmMs}ms:`, JSON.stringify(enhanced));

    // 2. Search with fallback strategy
    const dbStart = Date.now();
    const fallbackResult = await searchWithFallback(enhanced, text, uiRegion);
    const dbMs = Date.now() - dbStart;
    console.log(`[${traceId}] Search with fallback in ${dbMs}ms: ${fallbackResult.places.length} results (level: ${fallbackResult.fallback_level})`);

    const totalMs = Date.now() - startTime;
    const timing: TimingMetrics = { llmMs, dbMs, totalMs };

    // 3. Generate actions and UI hints
    const actions = generateSearchActions(enhanced, fallbackResult.places.length, fallbackResult);
    const uiHints = generateUIHints(
      enhanced,
      fallbackResult.places.length,
      fallbackResult.fallback_applied,
      fallbackResult.fallback_notes
    );

    // 4. Convert to legacy query for logging
    const legacyQuery = toLegacyQuery(enhanced);

    // 5. Log search (async, don't wait)
    logSearch(traceId, text, legacyQuery, fallbackResult.places.length, timing);

    // 6. Return enhanced response
    return res.status(200).json({
      // Core results
      places: fallbackResult.places,

      // Enhanced query info
      intent: enhanced.intent,
      slots: enhanced.slots,

      // Legacy query (for backward compatibility)
      query: legacyQuery,

      // Actions for frontend
      actions,

      // UI hints
      ui_hints: uiHints,

      // Metadata
      traceId,
      timing,
    });
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error(`[${traceId}] Search error after ${totalMs}ms:`, error);
    return res.status(500).json({ error: 'Internal server error', traceId });
  }
}
