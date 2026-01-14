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
      };
    });
  },

  // 장소 추가
  async create(location: Omit<Location, 'id'>): Promise<Location> {
    // camelCase를 snake_case로 변환하여 Supabase에 저장
    const { eventTags: inputEventTags, imageUrl, tags: inputTags, ...rest } = location;
    const supabaseData: any = {
      ...rest,
      event_tags: inputEventTags || [], // eventTags를 event_tags로 변환
      tags: inputTags || [], // tags 저장
    };

    // imageUrl이 있고 빈 문자열이 아니면 저장
    if (imageUrl && imageUrl.trim()) {
      supabaseData.imageUrl = imageUrl; // DB 컬럼명이 camelCase인 경우
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
    const { eventTags: inputEventTags, imageUrl, tags: inputTags, ...rest } = location;
    const supabaseData: any = { ...rest };

    if (inputEventTags !== undefined) {
      supabaseData.event_tags = inputEventTags;
    }

    if (inputTags !== undefined) {
      supabaseData.tags = inputTags;
    }

    // imageUrl 처리 - DB 컬럼명에 맞게 설정
    // 빈 문자열이 아닐 때만 업데이트 (컬럼이 없을 수 있으므로 null 설정 제외)
    if (imageUrl !== undefined && imageUrl && imageUrl.trim()) {
      supabaseData.imageUrl = imageUrl; // DB 컬럼명이 camelCase인 경우
    }

    console.log('Supabase update - id:', id);
    console.log('Supabase update - data:', supabaseData);

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
    };
  }
};

// 리뷰 관련 API 함수들
export const reviewApi = {
  // 특정 장소의 리뷰 가져오기
  async getByLocationId(locationId: string): Promise<Review[]> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('리뷰 조회 오류:', error);
      return []; // 테이블이 없어도 빈 배열 반환
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
    const { count, error } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId);

    if (error) {
      console.error('리뷰 개수 조회 오류:', error);
      return 0;
    }

    return count || 0;
  }
};
