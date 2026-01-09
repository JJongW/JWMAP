import React, { useState, useEffect } from 'react';
import type { Location } from '../types/location';
import { Star, MapPin, Edit2, Trash2, ExternalLink, X, Check, ImageIcon } from 'lucide-react';
import { locationApi } from '../utils/supabase';

interface LocationCardProps {
  location: Location;
  onDelete: (id: string) => void;
}

export function LocationCard({ location, onDelete }: LocationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRating, setEditedRating] = useState(location.rating);
  const [editedImageUrl, setEditedImageUrl] = useState(location.imageUrl);
  const [editedCategory, setEditedCategory] = useState(location.category);
  const [editedMemo, setEditedMemo] = useState(location.memo);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setEditedRating(location.rating);
    setEditedImageUrl(location.imageUrl);
    setEditedCategory(location.category);
    setEditedMemo(location.memo);
    setImageError(false);
  }, [location]);

  const handleSave = async () => {
    try {
      await locationApi.update(location.id, {
        rating: editedRating,
        imageUrl: editedImageUrl,
        category: editedCategory,
        memo: editedMemo,
      });
      alert('수정된 내용이 저장되었습니다.');
      setIsEditing(false);
    } catch (error) {
      console.error('데이터 저장 오류:', error);
      alert('데이터 저장 중 문제가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${location.name}을(를) 삭제하시겠습니까?`)) {
      return;
    }
    onDelete(location.id);
  };

  const handleKakaoMapSearch = async () => {
    const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_RESTFUL_API_KEY || '';
    const kakaoSearchUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(location.name)}`;

    try {
      const response = await fetch(kakaoSearchUrl, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
      });
      const data = await response.json();
      const results = data.documents;

      if (results && results.length > 0) {
        const placeUrl = `https://place.map.kakao.com/${results[0].id}`;
        window.open(placeUrl, '_blank');
      } else {
        alert('해당 장소를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('카카오맵 API 요청 오류:', error);
      alert('카카오맵 API 요청 중 오류가 발생했습니다.');
    }
  };

  const categories: Location['category'][] = [
    '한식', '중식', '일식', '라멘', '양식', '분식', '호프집', '칵테일바',
    '와인바', '아시안', '돈까스', '회', '피자', '베이커리', '카페', '카공카페', '버거',
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* 이미지 영역 */}
      <div className="relative h-48 bg-gray-100">
        {editedImageUrl && !imageError ? (
          <img
            src={editedImageUrl}
            alt={location.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-300" />
          </div>
        )}
        {/* 카테고리 배지 */}
        <div className="absolute top-3 left-3">
          {isEditing ? (
            <select
              value={editedCategory}
              onChange={(e) => setEditedCategory(e.target.value as Location['category'])}
              className="text-xs font-medium bg-white text-gray-700 rounded-lg px-3 py-1.5 border border-gray-200"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white">
              {editedCategory}
            </span>
          )}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="p-5 space-y-4">
        {/* 제목 & 평점 */}
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-gray-900">{location.name}</h3>
          <div className="flex items-center gap-1 text-orange-500">
            <Star size={16} className="fill-current" />
            {isEditing ? (
              <input
                type="number"
                value={editedRating}
                step="0.1"
                min="0"
                max="5"
                onChange={(e) => setEditedRating(parseFloat(e.target.value))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-700"
              />
            ) : (
              <span className="text-sm font-semibold">{editedRating?.toFixed(1) || '0.0'}</span>
            )}
          </div>
        </div>

        {/* 주소 */}
        <p className="text-gray-500 text-sm flex items-center gap-1.5">
          <MapPin size={14} className="text-gray-400" />
          {location.address}
        </p>

        {/* 메모 */}
        {isEditing ? (
          <textarea
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="메모를 입력하세요"
            rows={3}
          />
        ) : (
          <p className="text-gray-600 text-sm bg-gray-50 rounded-xl p-3">
            {location.memo || '메모가 없습니다.'}
          </p>
        )}

        {/* 이미지 URL 입력 (수정 모드) */}
        {isEditing && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">이미지 URL</label>
            <input
              type="text"
              value={editedImageUrl}
              onChange={(e) => setEditedImageUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
        )}

        {/* 버튼 그룹 */}
        <div className="flex gap-2 pt-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <X size={16} />
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                저장
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-3 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
              >
                <Edit2 size={15} />
                수정
              </button>
              <button
                onClick={handleKakaoMapSearch}
                className="flex-1 px-3 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={15} />
                카카오맵
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-2.5 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
