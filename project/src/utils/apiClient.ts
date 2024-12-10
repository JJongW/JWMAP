import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://jwmap.site', // 환경 변수로 관리
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
