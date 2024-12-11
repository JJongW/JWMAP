import React, { useState, useEffect } from 'react';
import type { Location } from '../types/location';
import { Star, MapPin, Edit2, Trash2 } from 'lucide-react';
import apiClient from '../utils/apiClient'; 

interface LocationCardProps {
  location: Location;
  onDelete: (id: string) => void; // 삭제 후 부모 컴포넌트에 알림
}

export function LocationCard({ location, onDelete }: LocationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRating, setEditedRating] = useState(location.rating);
  const [editedImageUrl, setEditedImageUrl] = useState(location.imageUrl);
  const [editedCategory, setEditedCategory] = useState(location.category);
  const [editedMemo, setEditedMemo] = useState(location.memo);

  // location prop이 변경될 때, 수정 모드를 종료하고 입력 필드 초기화
  useEffect(() => {
    setIsEditing(false);
    setEditedRating(location.rating);
    setEditedImageUrl(location.imageUrl);
    setEditedCategory(location.category);
    setEditedMemo(location.memo);
  }, [location]);

  const handleSave = async () => {
    try {
      await apiClient.put(`/api/locations/${location.id}`, {
        rating: editedRating,
        imageUrl: editedImageUrl,
        category: editedCategory,
        memo: editedMemo,
      });
      alert('수정된 내용이 저장되었습니다.');
      setIsEditing(false);
    } catch (error) {
      console.log('Image URL:', editedImageUrl);
      console.error('데이터 저장 오류:', error);
      alert('데이터 저장 중 문제가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`${location.name}을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await apiClient.delete(`/api/locations/${location.id}`);
      alert('장소가 삭제되었습니다.');
      onDelete(location.id); // 부모 컴포넌트에 삭제 알림
    } catch (error) {
      console.error('데이터 삭제 오류:', error);
      alert('데이터 삭제 중 문제가 발생했습니다.');
    }
  };

  const handleKakaoMapSearch = async () => {
    const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_RESTFUL_API_KEY || '';
    console.log("API_Key: ", KAKAO_API_KEY);
    const kakaoSearchUrl = 'https://dapi.kakao.com/v2/local/search/keyword.json';

    try {
      const response = await apiClient.get(kakaoSearchUrl, {
        headers: {
          Authorization: `KakaoAK ${KAKAO_API_KEY}`,
        },
        params: { query: location.name },
      });

      const results = response.data.documents;

      if (results.length > 0) {
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
    '전체',
    '한식',
    '중식',
    '일식',
    '양식',
    '분식',
    '호프집',
    '칵테일바',
    '와인바',
    '아시안',
    '돈까스',
    '회',
    '피자',
    '베이커리',
    '카페',
    '카공카페',
    '버거',
  ];

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <img
        src={editedImageUrl}
        alt={location.name}
        className="w-full h-48 object-cover"
      />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{location.name}</h3>
          <div className="flex flex-col gap-2">
            {isEditing ? (
              <select
                value={editedCategory}
                onChange={(e) => setEditedCategory(e.target.value as Location['category'])}
                className="text-xs font-medium bg-green-100 text-green-800 rounded px-2 py-1"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {editedCategory}
              </span>
            )}
          </div>
        </div>
        <p className="text-gray-600 text-sm flex items-center gap-1">
          <MapPin size={14} />
          {location.address}
        </p>
        {isEditing ? (
          <textarea
            value={editedMemo}
            onChange={(e) => setEditedMemo(e.target.value)}
            className="w-full mt-2 border rounded px-2 py-1 text-sm"
            placeholder="메모를 입력하세요"
          />
        ) : (
          <p className="text-gray-700 text-sm mt-2">
            {location.memo ? location.memo : '메모가 없습니다.'}
          </p>
        )}
        <div className="flex items-center text-yellow-500">
          <Star size={16} className="fill-current" />
          {isEditing ? (
            <input
              type="number"
              value={editedRating}
              step="0.1"
              min="0"
              max="5"
              onChange={(e) => setEditedRating(parseFloat(e.target.value))}
              className="ml-2 border rounded px-2 py-1 text-sm"
            />
          ) : (
            <span className="ml-1 text-sm">{editedRating.toFixed(1)}</span>
          )}
        </div>
        {isEditing && (
          <input
            type="text"
            value={editedImageUrl}
            onChange={(e) => setEditedImageUrl(e.target.value)}
            className="w-full mt-2 border rounded px-2 py-1 text-sm"
            placeholder="이미지 URL 수정"
          />
        )}
        <div className="text-center mt-3 flex justify-center gap-2">
          {isEditing ? (
            <button
              onClick={handleSave}
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-all"
            >
              저장
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="inline-block px-4 py-2 bg-gray-500 text-white rounded-lg shadow hover:bg-gray-600 transition-all"
              >
                <Edit2 size={16} className="inline-block mr-1" />
                수정
              </button>
              <button
                onClick={handleKakaoMapSearch}
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-all"
              >
                카카오맵에서 검색
              </button>
              <button
                onClick={handleDelete}
                className="inline-block px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-all"
              >
                <Trash2 size={16} className="inline-block mr-1" />
                삭제
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
