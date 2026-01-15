import { createClient } from '@supabase/supabase-js';
import type { Location, Review, VisitType, Features } from '../types/location';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 장소 관련 API 함수들
export const locationApi = {
  // 모든 장소 가져오기
  async getAll(): Promise<Location[]> {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Supabase의 snake_case를 camelCase로 변환
    // event_tags -> eventTags, image_url -> imageUrl
    return (data || []).map((item: any) => {
      let eventTags = item.event_tags || item.eventTags || [];
      
      // JSON 문자열인 경우 파싱
      if (typeof eventTags === 'string') {
        try {
          eventTags = JSON.parse(eventTags);
        } catch (e) {
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
      const { image_url, ...rest } = item;
      
      // tags 파싱
      let tags = item.tags || [];
      if (typeof tags === 'string') {
        try {
          tags = JSON.parse(tags);
        } catch (e) {
          tags = [];
        }
      }
      if (!Array.isArray(tags)) {
        tags = [];
      }

      return {
        ...rest,
        imageUrl,
        eventTags,
        features: item.features || {},
        tags,
        // DB 필드 매핑
        sub_region: item.sub_region,
        naver_place_id: item.naver_place_id,
        price_level: item.price_level,
        visit_date: item.visit_date,
        last_verified_at: item.last_verified_at,
        created_at: item.created_at,
        // visit_date를 curator_visited_at으로도 매핑 (UI 호환성)
        curator_visited_at: item.visit_date,
      };
    });
  },

  // 장소 추가
  async create(location: Omit<Location, 'id'>): Promise<Location> {
    // camelCase를 snake_case로 변환하여 Supabase에 저장
    const {
      eventTags: inputEventTags,
      imageUrl,
      tags: inputTags,
      curator_visited_at,  // UI용 필드는 제외
      curator_visit_slot,
      disclosure,
      ...rest
    } = location;

    const supabaseData: any = {
      ...rest,
      event_tags: inputEventTags || [],
      tags: inputTags || [],
    };

    // imageUrl이 있고 빈 문자열이 아니면 저장
    if (imageUrl && imageUrl.trim()) {
      supabaseData.imageUrl = imageUrl;
    }

    // curator_visited_at이 있으면 visit_date로 저장
    if (curator_visited_at) {
      supabaseData.visit_date = curator_visited_at;
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
      } catch (e) {
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
    const { image_url, ...responseData } = data;

    // tags 파싱
    let responseTags = data.tags || [];
    if (typeof responseTags === 'string') {
      try {
        responseTags = JSON.parse(responseTags);
      } catch (e) {
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
      features: data.features || {},
      tags: responseTags,
      // DB 필드 매핑
      sub_region: data.sub_region,
      naver_place_id: data.naver_place_id,
      price_level: data.price_level,
      visit_date: data.visit_date,
      last_verified_at: data.last_verified_at,
      created_at: data.created_at,
      curator_visited_at: data.visit_date,
    };
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
      curator_visited_at,
      curator_visit_slot,
      disclosure,
      ...rest
    } = location;

    const supabaseData: any = { ...rest };

    if (inputEventTags !== undefined) {
      supabaseData.event_tags = inputEventTags;
    }

    if (inputTags !== undefined) {
      supabaseData.tags = inputTags;
    }

    // imageUrl 처리
    if (imageUrl !== undefined && imageUrl && imageUrl.trim()) {
      supabaseData.imageUrl = imageUrl;
    }

    // curator_visited_at -> visit_date 매핑
    if (curator_visited_at !== undefined) {
      supabaseData.visit_date = curator_visited_at;
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
      } catch (e) {
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
    const { image_url, ...responseData } = data;

    // tags 파싱
    let responseTags = data.tags || [];
    if (typeof responseTags === 'string') {
      try {
        responseTags = JSON.parse(responseTags);
      } catch (e) {
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
      features: data.features || {},
      tags: responseTags,
      // DB 필드 매핑
      sub_region: data.sub_region,
      naver_place_id: data.naver_place_id,
      price_level: data.price_level,
      visit_date: data.visit_date,
      last_verified_at: data.last_verified_at,
      created_at: data.created_at,
      curator_visited_at: data.visit_date,
    };
  }
};

// 검색 로그 API
export const searchLogApi = {
  // 검색 로그 기록
  async log(params: {
    query: string;
    parsed?: Record<string, any>;
    result_count: number;
    llm_ms?: number;
    db_ms?: number;
    total_ms?: number;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('search_logs')
        .insert([{
          query: params.query,
          parsed: params.parsed || {},
          result_count: params.result_count,
          llm_ms: params.llm_ms || 0,
          db_ms: params.db_ms || 0,
          total_ms: params.total_ms || 0,
        }])
        .select('id')
        .single();

      if (error) {
        // 테이블 없으면 조용히 무시
        if (error.message?.includes('schema cache') || error.code === '42P01') {
          return null;
        }
        console.error('검색 로그 저장 실패:', error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      return null;
    }
  }
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
    } catch (err) {
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

      return (data || []).map((item: any) => ({
        id: item.id,
        location_id: item.location_id,
        user_id: item.user_id,
        user_display_name: item.user_display_name || '익명',
        one_liner: item.one_liner,
        visit_type: item.visit_type || 'first',
        features: item.features || {},
        created_at: item.created_at,
      }));
    } catch (err) {
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

    if (error) throw error;

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
    } catch (err) {
      return 0;
    }
  }
};
