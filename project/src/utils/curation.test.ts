import { describe, expect, it } from 'vitest';
import {
  getCuratorReason,
  getRecommendBadge,
  getVisitInfoText,
  getVisitStatusLabel,
  isCuratorVisited,
  isPracticalInfoTag,
  VISIT_STATUS_LABEL,
} from './curation';

const AUTO_MEMO = '가게 뒤편에 작은 유료 주차장 있음. 추천: 돈카츠\n분위기: 차분한 · 맛: 바삭 · 방문 많음';

describe('getCuratorReason', () => {
  it('운영자 한 줄(short_desc)만 추천 이유로 쓴다', () => {
    expect(getCuratorReason({ short_desc: '  오차즈케가 진짜 맛있음!  ', memo: AUTO_MEMO })).toBe('오차즈케가 진짜 맛있음!');
  });

  it('short_desc가 없으면 자동 생성 memo를 추천 이유로 끌어오지 않는다', () => {
    expect(getCuratorReason({ short_desc: '', memo: AUTO_MEMO })).toBe('');
    expect(getCuratorReason({ memo: AUTO_MEMO })).toBe('');
  });
});

describe('getVisitInfoText', () => {
  it('memo는 방문 정보로 그대로 넘긴다', () => {
    expect(getVisitInfoText({ memo: `  ${AUTO_MEMO}  ` })).toBe(AUTO_MEMO);
    expect(getVisitInfoText({})).toBe('');
  });
});

describe('visit status', () => {
  it('직접 방문 / 아직 안 가본 후보를 같은 문구로 구분한다', () => {
    expect(getVisitStatusLabel({ curator_visited: true })).toBe(VISIT_STATUS_LABEL.visited);
    expect(getVisitStatusLabel({ curator_visited: false })).toBe(VISIT_STATUS_LABEL.candidate);
    expect(VISIT_STATUS_LABEL).toEqual({ visited: '운영자 직접 방문', candidate: '아직 안 가본 후보' });
  });

  it('값이 비어 있으면 직접 방문했다고 말하지 않는다', () => {
    expect(isCuratorVisited({})).toBe(false);
    expect(getVisitStatusLabel({})).toBe(VISIT_STATUS_LABEL.candidate);
  });
});

describe('getRecommendBadge', () => {
  it('아직 안 가본 후보는 큐레이션 단계가 높아도 추천 강도 배지가 없다', () => {
    expect(getRecommendBadge({ curator_visited: false, curation_level: 3 })).toBeNull();
    expect(getRecommendBadge({ curator_visited: false, curation_level: 5 })).toBeNull();
  });

  it('직접 방문한 곳만 3단계 운영자 추천, 4단계 이상 대표픽', () => {
    expect(getRecommendBadge({ curator_visited: true, curation_level: 2 })).toBeNull();
    expect(getRecommendBadge({ curator_visited: true, curation_level: 3 })?.label).toBe('운영자 추천');
    expect(getRecommendBadge({ curator_visited: true, curation_level: 4 })?.label).toBe('대표픽');
  });

  it("'검증됨'처럼 방문으로 오해될 라벨을 쓰지 않는다", () => {
    const labels = [3, 4, 5].map((level) => getRecommendBadge({ curator_visited: true, curation_level: level })?.label);
    expect(labels).not.toContain('검증됨');
  });
});

describe('주소가 들어간 short_desc', () => {
  it('주소처럼 보이면 추천 이유로 쓰지 않는다', () => {
    expect(getCuratorReason({ short_desc: '서울 광진구 자양로 319 한가온빌 1층 101호' })).toBe('');
    expect(getCuratorReason({ short_desc: '경기 수원시 영통구 센트럴파크로127번길 142 지하 1층' })).toBe('');
    expect(getCuratorReason({ short_desc: '을지로 3가역 근처', address: '을지로 3가역 근처' })).toBe('');
  });

  it('지역명으로 시작해도 주소가 아니면 살린다', () => {
    expect(getCuratorReason({ short_desc: '서울에서 제일 바삭한 돈카츠' })).toBe('서울에서 제일 바삭한 돈카츠');
  });
});

describe('isPracticalInfoTag', () => {
  it('주차·포장·예약 같은 정보성 태그를 고른다', () => {
    for (const tag of ['주차불가', '포장가능', '예약가능', '배달가능', '웨이팅', '이동약자접근']) {
      expect(isPracticalInfoTag(tag)).toBe(true);
    }
    for (const tag of ['데이트', '혼밥', '조용한 분위기', '라멘']) {
      expect(isPracticalInfoTag(tag)).toBe(false);
    }
  });
});
