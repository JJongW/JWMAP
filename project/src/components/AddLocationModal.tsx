import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddLocationModalProps {
  onClose: () => void;
  onSave: (location: {
    name: string;
    region: string;
    category: string;
    address: string;
    imageUrl: string;
    rating: number;
    lon: number;
    lat: number;
    memo: string;
  }) => void;
}

declare const kakao: any;

export function AddLocationModal({ onClose, onSave }: AddLocationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    category: '',
    address: '',
    imageUrl: '',
    rating: 0,
    lon: 0,
    lat: 0,
    memo: ''
  });
  const [loadingCoords, setLoadingCoords] = useState(false);

  const regions = [
    '강남', '서초', '잠실/송파/강동', '영등포/여의도/강서', '건대/성수/왕십리',
    '종로/중구', '홍대/합정/마포/연남', '용산/이태원/한남', '성북/노원/중랑',
    '구로/관악/동작', '신촌/연희', '창동/도봉산', '회기/청량리', '강동/고덕',
    '연신내/구파발', '마곡/김포', '미아/수유/북한산', '목동/양천', '금천/가산'
  ];

  const categories = [
    '한식', '중식', '일식', '라멘', '양식', '분식', '호프집', '칵테일바',
    '와인바', '아시안', '돈까스', '회', '피자', '베이커리', '카페', '카공카페', '버거'
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'rating' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAddressBlur = async () => {
    if (!formData.address) return;

    setLoadingCoords(true);
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(formData.address, (result: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK) {
        const coords = result[0];
        setFormData((prev) => ({
          ...prev,
          lon: parseFloat(coords.x),
          lat: parseFloat(coords.y),
        }));
      }
      setLoadingCoords(false);
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.region || !formData.category || !formData.address) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">새로운 장소 추가</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="예: 강남 맛집"
            />
          </div>

          {/* 지역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              지역 <span className="text-red-500">*</span>
            </label>
            <select
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            >
              <option value="">지역을 선택하세요</option>
              {regions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>

          {/* 종류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              종류 <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
            >
              <option value="">종류를 선택하세요</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              onBlur={handleAddressBlur}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="예: 서울 강남구 강남대로 123"
            />
            {loadingCoords && (
              <p className="text-xs text-orange-500 mt-1.5">좌표 계산 중...</p>
            )}
            {formData.lon !== 0 && formData.lat !== 0 && !loadingCoords && (
              <p className="text-xs text-green-600 mt-1.5">
                좌표: {formData.lat.toFixed(6)}, {formData.lon.toFixed(6)}
              </p>
            )}
          </div>

          {/* 이미지 URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">이미지 URL</label>
            <input
              type="text"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>

          {/* 평점 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">평점</label>
            <input
              type="number"
              name="rating"
              value={formData.rating}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              min="0"
              max="5"
              step="0.1"
              placeholder="0.0 ~ 5.0"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">메모</label>
            <textarea
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              placeholder="메모를 입력하세요"
              rows={3}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
