import { createClient } from '@supabase/supabase-js';
import type { Location } from '../types/location';

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
      
      // image_url을 imageUrl로 변환 (image_url이 있으면 우선 사용, 없으면 imageUrl 사용)
      const imageUrl = item.image_url || item.imageUrl || '';
      
      // image_url 제거하고 imageUrl로 통일
      const { image_url, ...rest } = item;
      
      return {
        ...rest,
        imageUrl,
        eventTags,
        features: item.features || {},
      };
    });
  },

  // 장소 추가
  async create(location: Omit<Location, 'id'>): Promise<Location> {
    // camelCase를 snake_case로 변환하여 Supabase에 저장
    const { eventTags: inputEventTags, imageUrl, ...rest } = location;
    const supabaseData: any = {
      ...rest,
      event_tags: inputEventTags || [], // eventTags를 event_tags로 변환
    };
    
    // imageUrl이 있고 빈 문자열이 아니면 image_url로 변환
    if (imageUrl && imageUrl.trim()) {
      supabaseData.image_url = imageUrl;
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
    
    // image_url을 imageUrl로 변환
    const responseImageUrl = data.image_url || data.imageUrl || '';
    const { image_url, ...responseData } = data;
    
    return {
      ...responseData,
      imageUrl: responseImageUrl,
      eventTags: responseEventTags,
      features: data.features || {},
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
    const { eventTags: inputEventTags, imageUrl, ...rest } = location;
    const supabaseData: any = { ...rest };
    
    if (inputEventTags !== undefined) {
      supabaseData.event_tags = inputEventTags;
    }
    
    // imageUrl이 있으면 image_url로 변환 (빈 문자열이 아닐 때만)
    if (imageUrl !== undefined) {
      if (imageUrl && imageUrl.trim()) {
        supabaseData.image_url = imageUrl;
      } else {
        // 빈 문자열이면 null로 설정
        supabaseData.image_url = null;
      }
    }

    const { data, error } = await supabase
      .from('locations')
      .update(supabaseData)
      .eq('id', id)
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
    
    // image_url을 imageUrl로 변환
    const responseImageUrl = data.image_url || data.imageUrl || '';
    const { image_url, ...responseData } = data;
    
    return {
      ...responseData,
      imageUrl: responseImageUrl,
      eventTags: responseEventTags,
      features: data.features || {},
    };
  }
};
