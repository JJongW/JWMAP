import type {
  RecommendRequest,
  RecommendResponse,
  LogRequest,
  StatsResult,
  SaveCourseRequest,
  SaveCourseResponse,
} from './types.js';

const API_BASE = process.env.ODIGA_API_URL || 'https://odiga-api.vercel.app/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) {
      const retryAfter = body.retryAfter || res.headers.get('Retry-After') || '60';
      throw new ApiError(429, `요청이 너무 많아요. ${retryAfter}초 후에 다시 시도해주세요.`);
    }
    throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  recommend(params: RecommendRequest): Promise<RecommendResponse> {
    return request<RecommendResponse>('/recommend', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  log(params: LogRequest): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/log', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  stats(): Promise<StatsResult> {
    return request<StatsResult>('/stats');
  },

  saveCourse(params: SaveCourseRequest): Promise<SaveCourseResponse> {
    return request<SaveCourseResponse>('/save-course', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

export { ApiError };
