import React, { useState } from 'react';

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

declare const kakao: any; // Kakao 지도 API 타입 정의 (전역)

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
  const [file, setFile] = useState<File | null>(null); // 선택된 파일 상태 추가
  const [loadingCoords, setLoadingCoords] = useState(false); // 좌표 가져오는 상태

  // 파일 선택 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]); // 선택된 파일 저장
    }
  };

  // 파일 업로드 처리
  const handleUpload = async () => {
    if (!file) {
      alert('이미지를 선택해주세요.');
      return;
    }
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류: ${response.status}`);
      }
      
      const data = await response.json();
      setFormData((prev) => ({ ...prev, imageUrl: data.imageUrl })); // 서버에서 받은 URL 저장
      alert('이미지 업로드 완료!');
    } catch (error) {
      console.error('File upload error:', error);
      alert('이미지 업로드 중 문제가 발생했습니다.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'rating' || name === 'lon' || name === 'lat' ? parseFloat(value) : value,
    }));

    // 주소 변경 시 자동으로 좌표 계산
    if (name === 'address') {
      handleAddressChange(value);
    }
  };

  const handleAddressChange = async (address: string) => {
    if (!address) return;

    setLoadingCoords(true); // 로딩 상태 활성화
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(address, (result: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK) {
        const coords = result[0];
        setFormData((prev) => ({
          ...prev,
          lon: parseFloat(coords.x), // 경도
          lat: parseFloat(coords.y), // 위도
        }));
        alert(`위도: ${coords.y}, 경도: ${coords.x}`);
      } else {
        alert('주소를 찾을 수 없습니다. 올바른 주소를 입력해주세요.');
      }
      setLoadingCoords(false); // 로딩 상태 해제
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.region || !formData.category || !formData.address) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4 text-center text-gray-800">새로운 장소 추가</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">이름</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="예: 강남 맛집"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">지역</label>
            <input
              type="text"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="예: 강남"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">종류</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="예: 한식"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">주소</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="예: 서울 강남구 강남대로"
            />
            {loadingCoords && <p className="text-sm text-blue-500 mt-1">좌표 계산 중...</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer"
            />
            <button
              onClick={handleUpload}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              이미지 업로드
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
              <label className="block text-sm font-medium text-gray-700">평점</label>
              <input
                type="number"
                name="rating"
                value={formData.rating}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                min="0"
                max="5"
                step="0.1"
              />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">메모</label>
            <input
              type="text"
              name="memo"
              value={formData.memo}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="메모를 입력하세요"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}