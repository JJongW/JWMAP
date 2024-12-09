import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001', // 환경 변수로 관리
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
