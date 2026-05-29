import type { Location } from '../types/location';
import { clickLogApi, savedPlaceApi, type ClickActionType } from './supabase';

const ACTIVITY_KEY = 'jwmap.activity.v1';
const SAVED_KEY = 'jwmap.saved.v1';
const VISITED_KEY = 'jwmap.visited.v1';
const SESSION_KEY = 'jwmap.session.v1';

export type ActivityAction =
  | ClickActionType
  | 'save_want'
  | 'unsave_want'
  | 'mark_visited'
  | 'unmark_visited'
  | 'recommend_start'
  | 'hot_region_click'
  | 'show_all_places';

interface ActivityEntry {
  action: ActivityAction;
  locationId?: string;
  region?: string;
  contentType?: string;
  createdAt: number;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readString(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
}

function writeString(key: string, value: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, value);
}

export function getSessionId(): string {
  const existing = readString(SESSION_KEY);
  if (existing) return existing;

  const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `jwmap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeString(SESSION_KEY, sessionId);
  return sessionId;
}

export function recordActivity(action: ActivityAction, location?: Location, metadata?: Record<string, string>) {
  const entries = readJson<ActivityEntry[]>(ACTIVITY_KEY, []);
  const next = [
    {
      action,
      locationId: location?.id,
      region: location?.region || metadata?.region,
      contentType: location?.contentType || metadata?.contentType,
      createdAt: Date.now(),
    },
    ...entries,
  ].slice(0, 300);
  writeJson(ACTIVITY_KEY, next);

  if (location && ['view_detail', 'open_naver', 'open_kakao', 'marker_click', 'list_click', 'copy_address'].includes(action)) {
    clickLogApi.log({ location_id: location.id, action_type: action as ClickActionType });
  }
}

export function getActivityScore(location: Location): number {
  const entries = readJson<ActivityEntry[]>(ACTIVITY_KEY, []);
  return entries.reduce((score, entry) => {
    if (entry.locationId !== location.id) return score;
    const weight = entry.action === 'open_naver' || entry.action === 'open_kakao'
      ? 5
      : entry.action === 'view_detail'
        ? 3
        : 1;
    return score + weight;
  }, 0);
}

export function getSavedIds(): string[] {
  return readJson<string[]>(SAVED_KEY, []);
}

export function getVisitedIds(): string[] {
  return readJson<string[]>(VISITED_KEY, []);
}

export async function syncPlaceStateFromRemote(): Promise<void> {
  const { rows, didSync } = await savedPlaceApi.getBySession(getSessionId());
  if (!didSync) return;

  writeJson(
    SAVED_KEY,
    rows.filter((row) => row.is_saved).map((row) => row.location_id)
  );
  writeJson(
    VISITED_KEY,
    rows.filter((row) => row.is_visited).map((row) => row.location_id)
  );
}

export function toggleSaved(location: Location): boolean {
  const ids = new Set(getSavedIds());
  const visitedIds = new Set(getVisitedIds());
  const willSave = !ids.has(location.id);
  if (willSave) ids.add(location.id);
  else ids.delete(location.id);
  writeJson(SAVED_KEY, [...ids]);
  recordActivity(willSave ? 'save_want' : 'unsave_want', location);
  savedPlaceApi.upsertState({
    session_id: getSessionId(),
    location_id: location.id,
    content_type: location.contentType || 'food',
    is_saved: willSave,
    is_visited: visitedIds.has(location.id),
  });
  return willSave;
}

export function toggleVisited(location: Location): boolean {
  const savedIds = new Set(getSavedIds());
  const ids = new Set(getVisitedIds());
  const willMark = !ids.has(location.id);
  if (willMark) ids.add(location.id);
  else ids.delete(location.id);
  writeJson(VISITED_KEY, [...ids]);
  recordActivity(willMark ? 'mark_visited' : 'unmark_visited', location);
  savedPlaceApi.upsertState({
    session_id: getSessionId(),
    location_id: location.id,
    content_type: location.contentType || 'food',
    is_saved: savedIds.has(location.id),
    is_visited: willMark,
  });
  return willMark;
}
