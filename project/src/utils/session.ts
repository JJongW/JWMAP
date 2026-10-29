/**
 * 로그인 없는 방문자 세션 ID (localStorage). 저장·방문 체크(user_place_states)의 주인 표시로 쓴다.
 * supabase 요청마다 x-oomap-session 헤더로 보내고, DB RLS가 같은 세션 행만 허용한다 (migration 024).
 */
const SESSION_KEY = 'jwmap.session.v1';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getSessionId(): string {
  const existing = storage()?.getItem(SESSION_KEY);
  if (existing) return existing;

  const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `jwmap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    storage()?.setItem(SESSION_KEY, sessionId);
  } catch {
    // 저장이 막힌 브라우저면 이번 페이지 동안만 쓴다
  }
  return sessionId;
}

export const SESSION_HEADER = 'x-oomap-session';
