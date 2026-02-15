import { createClient } from '@supabase/supabase-js';
import type { ContentMode, Location, Review, VisitType, Features } from '../types/location';
import {
  mapLocationCreateToRow,
  mapLocationUpdateToRow,
  mapRowToLocation,
} from './locationMapper';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getLocationTable(mode: ContentMode): string {
  return mode === 'space' ? 'attractions' : 'locations';
}

function getLocationSearchView(mode: ContentMode): string {
  return mode === 'space' ? 'attractions_search' : 'locations_search';
}

// 장소 관련 API 함수들
export const locationApi = {
  // 모든 장소 가져오기 (locations_search: popularity_score for ranking)
  async getAll(mode: ContentMode = 'food'): Promise<Location[]> {
    const table = getLocationTable(mode);
    const searchView = getLocationSearchView(mode);
    const columns = [
      'id', 'name', 'region', 'sub_region', 'category_main', 'category_sub',
      'lat', 'lon', 'rating', 'curation_level', 'imageUrl', 'tags', 'curator_visited',
      'trust_score', 'popularity_score',
      'address', 'memo', 'short_desc', 'price_level', 'event_tags', 'features', 'content_type',
      'naver_place_id', 'kakao_place_id', 'visit_date', 'created_at', 'last_verified_at',
    ].join(', ');
    let result = await supabase
      .from(searchView)
      .select(columns)
      .order('curation_level', { ascending: false, nullsFirst: false })
      .order('popularity_score', { ascending: false, nullsFirst: false });

    if (result.error) {
      const fallback = await supabase
        .from(table)
        .select('*')
        .order('rating', { ascending: false });
      if (fallback.error) throw fallback.error;
      result = fallback;
    }

    const data = result.data;
    
    return ((data || []) as unknown as Record<string, unknown>[]).map((item) => mapRowToLocation(item));
  },

  // 장소 추가
  async create(location: Omit<Location, 'id'>, mode: ContentMode = 'food'): Promise<Location> {
    const table = getLocationTable(mode);
    const supabaseData = mapLocationCreateToRow(location);

    const { data, error } = await supabase
      .from(table)
      .insert([supabaseData])
      .select()
      .single();

    if (error) throw error;
    
    return mapRowToLocation(data as Record<string, unknown>);
  },

  // 장소 삭제
  async delete(id: string, mode: ContentMode = 'food'): Promise<void> {
    const table = getLocationTable(mode);
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 장소 수정
  async update(id: string, location: Partial<Location>, mode: ContentMode = 'food'): Promise<Location> {
    const table = getLocationTable(mode);
    const supabaseData = mapLocationUpdateToRow(location);

    const { data, error } = await supabase
      .from(table)
      .update(supabaseData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
    
    return mapRowToLocation(data as Record<string, unknown>);
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
      const { error } = await supabase.rpc('touch_location_activity', { p_location_id: locationId });
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
