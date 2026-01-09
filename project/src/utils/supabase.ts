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
    return data || [];
  },

  // 장소 추가
  async create(location: Omit<Location, 'id'>): Promise<Location> {
    const { data, error } = await supabase
      .from('locations')
      .insert([location])
      .select()
      .single();

    if (error) throw error;
    return data;
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
    const { data, error } = await supabase
      .from('locations')
      .update(location)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
