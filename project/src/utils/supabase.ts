import { createClient } from '@supabase/supabase-js';
import type { Location, Review, VisitType, Features } from '../types/location';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 장소 관련 API 함수들
export const locationApi = {
  // 모든 장소 가져오기 (locations_search: popularity_score, trust_score for ranking)
  async getAll(): Promise<Location[]> {
    const columns = [
      'id', 'name', 'region', 'sub_region', 'category_main', 'category_sub',
      'lat', 'lon', 'rating', 'imageUrl', 'image_url', 'tags', 'curator_visited',
      'trust_score', 'popularity_score',
      'address', 'memo', 'short_desc', 'price_level', 'event_tags', 'features',
      'naver_place_id', 'kakao_place_id', 'visit_date', 'created_at', 'last_verified_at',
    ].join(', ');
    const { data, error } = await supabase
      .from('locations_search')
      .select(columns)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .order('rating', { ascending: false });

    if (error) throw error;
    
    // Supabase의 snake_case를 camelCase로 변환
    // event_tags -> eventTags, image_url -> imageUrl
    return ((data || []) as unknown as Record<string, unknown>[]).map((item) => {
      let eventTags = item.event_tags || item.eventTags || [];
      
      // JSON 문자열인 경우 파싱
      if (typeof eventTags === 'string') {
        try {
          eventTags = JSON.parse(eventTags);
        } catch {
          console.warn('이벤트 태그 파싱 실패:', eventTags);
          eventTags = [];
        }
      }
      
      // 배열이 아닌 경우 빈 배열로 변환
      if (!Array.isArray(eventTags)) {
        eventTags = [];
      }
      
      // imageUrl 필드 처리 (DB 컬럼명에 따라 유연하게 처리)
      const imageUrl = item.imageUrl || item.image_url || '';

      // image_url이 있으면 제거 (imageUrl로 통일)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { image_url: _, ...rest } = item;
      
      // tags 파싱
      let tags = item.tags || [];
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch {
          tags = [];
        }
      }
      if (!Array.isArray(tags)) {
        tags = [];
      }

      const categoryMain = (item.category_main || item.categoryMain) as string | undefined;
      const categorySub = (item.category_sub || item.categorySub) as string | undefined;
      return {
        ...rest,
        category: (categorySub || categoryMain || '') as string,
        imageUrl: imageUrl as string,
        eventTags: eventTags as string[],
        features: (item.features || {}) as Features,
        tags: tags as string[],
        // DB 필드 매핑
        sub_region: item.sub_region as string | undefined,
        naver_place_id: item.naver_place_id as string | undefined,
        price_level: item.price_level as number | undefined,
        visit_date: item.visit_date as string | undefined,
        last_verified_at: item.last_verified_at as string | undefined,
        created_at: item.created_at as string | undefined,
        curator_visited: item.curator_visited,
        curator_visited_at: item.visit_date as string | undefined,
        categoryMain,
        categorySub,
      } as Location;
    });
  },

  // 장소 추가
  async create(location: Omit<Location, 'id'>): Promise<Location> {
    // camelCase를 snake_case로 변환하여 Supabase에 저장
    const {
      eventTags: inputEventTags,
      imageUrl,
      tags: inputTags,
      categoryMain,
      categorySub,
      features: inputFeatures,
      curator_visited,
      curator_visited_at,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      curator_visit_slot: _curator_visit_slot,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disclosure: _disclosure,
      ...rest
    } = location;

    // rest에서 features 제거 (명시적으로 처리하기 위해)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { features: _features, ...restWithoutFeatures } = rest as Record<string, unknown>;

    const supabaseData: Record<string, unknown> = {
      ...restWithoutFeatures,
      event_tags: inputEventTags || [],
      tags: inputTags || [],
      category_main: categoryMain,
      category_sub: categorySub,
      features: inputFeatures || {}, // features가 없으면 빈 객체로 설정 (NOT NULL 제약 조건)
    };

    // imageUrl이 있고 빈 문자열이 아니면 저장
    if (imageUrl && imageUrl.trim()) {
      supabaseData.imageUrl = imageUrl;
    }

    // curator_visited_at이 있으면 visit_date로 저장
    if (curator_visited_at) {
      supabaseData.visit_date = curator_visited_at;
    }

    if (curator_visited !== undefined) {
      supabaseData.curator_visited = curator_visited;
    }

    const { data, error } = await supabase
      .from('locations')
      .insert([supabaseData])
      .select()
      .single();

    if (error) throw error;
    
    // 응답 데이터를 camelCase로 변환
    let responseEventTags = data.event_tags || data.eventTags || [];
    
    // JSON 문자열인 경우 파싱
    if (typeof responseEventTags === 'string') {
      try {
        responseEventTags = JSON.parse(responseEventTags);
      } catch {
        console.warn('이벤트 태그 파싱 실패:', responseEventTags);
        responseEventTags = [];
      }
    }
    
    // 배열이 아닌 경우 빈 배열로 변환
    if (!Array.isArray(responseEventTags)) {
      responseEventTags = [];
    }
    
    // imageUrl 처리
    const responseImageUrl = data.imageUrl || data.image_url || '';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image_url: _imageUrlCreate, ...responseData } = data;

    // tags 파싱
    let responseTags = data.tags || [];
    if (typeof responseTags === 'string') {
      try {
        responseTags = JSON.parse(responseTags);
      } catch {
        responseTags = [];
      }
    }
    if (!Array.isArray(responseTags)) {
      responseTags = [];
    }

    return {
      ...responseData,
      imageUrl: responseImageUrl,
      eventTags: responseEventTags,
      features: (data.features || {}) as Features,
      tags: responseTags as string[],
      // DB 필드 매핑
      sub_region: data.sub_region as string | undefined,
      naver_place_id: data.naver_place_id as string | undefined,
      price_level: data.price_level as number | undefined,
      visit_date: data.visit_date as string | undefined,
      last_verified_at: data.last_verified_at as string | undefined,
      created_at: data.created_at as string | undefined,
      curator_visited: data.curator_visited,
      curator_visited_at: data.visit_date as string | undefined,
      // 카테고리 대분류/소분류
      categoryMain: (data.category_main || data.categoryMain) as string | undefined,
      categorySub: (data.category_sub || data.categorySub) as string | undefined,
    } as Location;
  },

  // 장소 삭제
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 장소 수정
  async update(id: string, location: Partial<Location>): Promise<Location> {
    // camelCase를 snake_case로 변환하여 Supabase에 저장
    const {
      eventTags: inputEventTags,
      imageUrl,
      tags: inputTags,
      categoryMain,
      categorySub,
      curator_visited,
      curator_visited_at,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      curator_visit_slot: _curator_visit_slot,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disclosure: _disclosure,
      ...rest
    } = location;

    const supabaseData: Record<string, unknown> = { ...rest };

    if (inputEventTags !== undefined) {
      supabaseData.event_tags = inputEventTags;
    }

    if (inputTags !== undefined) {
      supabaseData.tags = inputTags;
    }

    if (categoryMain !== undefined) {
      supabaseData.category_main = categoryMain;
    }

    if (categorySub !== undefined) {
      supabaseData.category_sub = categorySub;
    }

    // imageUrl 처리
    if (imageUrl !== undefined && imageUrl && imageUrl.trim()) {
      supabaseData.imageUrl = imageUrl;
    }

    // curator_visited_at -> visit_date 매핑
    if (curator_visited_at !== undefined) {
      supabaseData.visit_date = curator_visited_at;
    }

    if (curator_visited !== undefined) {
      supabaseData.curator_visited = curator_visited;
    }

    const { data, error } = await supabase
      .from('locations')
      .update(supabaseData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
    
    // 응답 데이터를 camelCase로 변환
    let responseEventTags = data.event_tags || data.eventTags || [];
    
    // JSON 문자열인 경우 파싱
    if (typeof responseEventTags === 'string') {
      try {
        responseEventTags = JSON.parse(responseEventTags);
      } catch {
        console.warn('이벤트 태그 파싱 실패:', responseEventTags);
        responseEventTags = [];
      }
    }
    
    // 배열이 아닌 경우 빈 배열로 변환
    if (!Array.isArray(responseEventTags)) {
      responseEventTags = [];
    }
    
    // imageUrl 처리
    const responseImageUrl = data.imageUrl || data.image_url || '';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image_url: _imageUrlUpdate, ...responseData } = data;

    // tags 파싱
    let responseTags = data.tags || [];
    if (typeof responseTags === 'string') {
      try {
        responseTags = JSON.parse(responseTags);
      } catch {
        responseTags = [];
      }
    }
    if (!Array.isArray(responseTags)) {
      responseTags = [];
    }

    return {
      ...responseData,
      imageUrl: responseImageUrl,
      eventTags: responseEventTags,
      features: (data.features || {}) as Features,
      tags: responseTags as string[],
      // DB 필드 매핑
      sub_region: data.sub_region as string | undefined,
      naver_place_id: data.naver_place_id as string | undefined,
      price_level: data.price_level as number | undefined,
      visit_date: data.visit_date as string | undefined,
      last_verified_at: data.last_verified_at as string | undefined,
      created_at: data.created_at as string | undefined,
      curator_visited: data.curator_visited,
      curator_visited_at: data.visit_date as string | undefined,
    } as Location;
  }
};

// 검색 로그 API - One search = One row (INSERT once, then UPDATEs)
export const searchLogApi = {
  /**
   * STEP 1: INSERT at search submit (before API call)
   * One row per user search. Returns searchLogId for subsequent UPDATEs.
   */
  async insert(params: {
    query: string;
    session_id?: string;
    device_type?: 'mobile' | 'pc';
    ui_mode?: 'browse' | 'explore';
  }): Promise<string | null> {
    try {
      // parsed JSONB is reserved for raw LLM response only (set by backend)
      // session_id, device_type, ui_mode require dedicated columns if needed
      const { data, error } = await supabase
        .from('search_logs')
        .insert([{
          query: params.query,
          parsed: null,
          result_count: 0,
          llm_ms: 0,
          db_ms: 0,
          total_ms: 0,
        }])
        .select('id')
        .single();

      if (error) {
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          return null;
        }
        console.error('[searchLogApi] INSERT 실패:', error);
        return null;
      }
      const id = data?.id || null;
      if (id && import.meta.env.DEV) console.log('[searchLogApi] INSERT:', id);
      return id;
    } catch {
      return null;
    }
  },

  /**
   * STEP 5: UPDATE on place click from result list
   * Uses dedicated columns; parsed JSONB is reserved for raw LLM output only.
   */
  async updateClick(
    id: string,
    clicked_place_id: string,
    clicked_rank: number
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('search_logs')
        .update({ clicked_place_id, clicked_rank })
        .eq('id', id);

      if (error && import.meta.env.DEV) console.warn('[searchLogApi] updateClick:', error);
      else if (import.meta.env.DEV) console.log('[searchLogApi] UPDATE click:', id);
      searchLogApi.touchLocationActivity(clicked_place_id);
    } catch {
      // Ignore
    }
  },

  /**
   * Update location last_activity_at (place clicked or map opened)
   * Uses RPC touch_location_activity (SECURITY DEFINER) - no new endpoints
   */
  async touchLocationActivity(locationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('touch_location_activity', { loc_id: locationId });
      if (error && import.meta.env.DEV) console.warn('[touchLocationActivity]', error);
    } catch {
      // Ignore
    }
  },

  /**
   * STEP 6: UPDATE when user opens Naver/Kakao map
   * Uses dedicated columns; parsed JSONB is reserved for raw LLM output only.
   */
  async updateMapOpen(
    id: string,
    map_provider: 'naver' | 'kakao',
    locationId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('search_logs')
        .update({ opened_map: true, map_provider })
        .eq('id', id);

      if (error && import.meta.env.DEV) console.warn('[searchLogApi] updateMapOpen:', error);
      else if (import.meta.env.DEV) console.log('[searchLogApi] UPDATE map open:', id);
      if (locationId) searchLogApi.touchLocationActivity(locationId);
    } catch {
      // Ignore
    }
  },
};

// 클릭 로그 API
export type ClickActionType =
  | 'view_detail'      // 장소 상세 보기
  | 'open_naver'       // 네이버지도 열기
  | 'open_kakao'       // 카카오맵 열기
  | 'marker_click'     // 마커 클릭
  | 'list_click'       // 리스트에서 클릭
  | 'copy_address';    // 주소 복사

export const clickLogApi = {
  // 클릭 로그 기록
  async log(params: {
    location_id: string;
    action_type: ClickActionType;
    search_id?: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('click_logs')
        .insert([{
          location_id: params.location_id,
          action_type: params.action_type,
          search_id: params.search_id || null,
        }]);

      if (error) {
        // 테이블 없으면 조용히 무시
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          return;
        }
        console.error('클릭 로그 저장 실패:', error);
      }
    } catch {
      // 조용히 무시
    }
  }
};

// 리뷰 관련 API 함수들
// 참고: reviews 테이블이 없으면 빈 데이터 반환 (기능 비활성화 상태)
export const reviewApi = {
  // 특정 장소의 리뷰 가져오기
  async getByLocationId(locationId: string): Promise<Review[]> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false });

      if (error) {
        // 테이블이 없는 경우 조용히 빈 배열 반환
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          return [];
        }
        console.error('리뷰 조회 오류:', error);
        return [];
      }

      return (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        location_id: item.location_id as string,
        user_id: item.user_id as string | undefined,
        user_display_name: (item.user_display_name || '익명') as string,
        one_liner: item.one_liner as string,
        visit_type: (item.visit_type || 'first') as VisitType,
        features: (item.features || {}) as Features,
        created_at: item.created_at as string,
      }));
    } catch {
      // 테이블 없음 등의 에러는 조용히 처리
      return [];
    }
  },

  // 리뷰 추가
  async create(review: {
    location_id: string;
    user_display_name?: string;
    one_liner: string;
    visit_type: VisitType;
    features?: Features;
  }): Promise<Review> {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert([{
          location_id: review.location_id,
          user_display_name: review.user_display_name || '익명',
          one_liner: review.one_liner,
          visit_type: review.visit_type,
          features: review.features || {},
        }])
        .select()
        .single();

      if (error) {
        // 테이블이 없는 경우 에러 메시지 개선
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          throw new Error('리뷰 기능이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.');
        }
        throw error;
      }

      return {
        id: data.id,
        location_id: data.location_id,
        user_id: data.user_id,
        user_display_name: data.user_display_name || '익명',
        one_liner: data.one_liner,
        visit_type: data.visit_type || 'first',
        features: data.features || {},
        created_at: data.created_at,
      };
    } catch (err) {
      // 테이블 없음 에러인 경우 사용자 친화적 메시지로 변환
      const error = err as Error;
      if (error.message?.includes('schema cache') || error.message?.includes('42P01')) {
        throw new Error('리뷰 기능이 아직 활성화되지 않았습니다. 관리자에게 문의해주세요.');
      }
      throw err;
    }
  },

  // 리뷰 개수 가져오기
  async getCount(locationId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', locationId);

      if (error) {
        // 테이블이 없는 경우 조용히 0 반환
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          return 0;
        }
        return 0;
      }

      return count || 0;
    } catch {
      return 0;
    }
  }
};
