import type { EnhancedLLMQuery, FallbackResult, SearchActions, UIHints } from './searchTypes';

export function generateUIHints(
  enhanced: EnhancedLLMQuery,
  resultCount: number,
  fallbackApplied: boolean,
  fallbackNotes: string[]
): UIHints {
  if (resultCount === 0) {
    return {
      message_type: 'no_results_soft',
      message: '조건에 맞는 장소를 찾지 못했어요.',
      suggestions: [
        '다른 지역으로 검색해보세요',
        '조건을 줄여서 검색해보세요',
        '비슷한 카테고리로 검색해보세요',
      ],
    };
  }

  if (enhanced.intent === 'CLARIFY_QUERY') {
    return {
      message_type: 'need_clarification',
      message: '검색어가 명확하지 않아요.',
      suggestions: [
        '지역을 포함해서 검색해보세요 (예: 강남 라멘)',
        '음식 종류를 명시해보세요 (예: 혼밥 맛집)',
      ],
    };
  }

  if (fallbackApplied && fallbackNotes.length > 0) {
    return {
      message_type: 'success',
      message: fallbackNotes.join(' / '),
    };
  }

  return {
    message_type: 'success',
    message: `${resultCount}개의 장소를 찾았어요!`,
  };
}

export function generateSearchActions(
  enhanced: EnhancedLLMQuery,
  _resultCount: number,
  fallbackResult: FallbackResult
): SearchActions {
  let mode: 'browse' | 'explore' = 'browse';
  let shouldShowMap = true;
  let resultLimit = 50;

  switch (enhanced.intent) {
    case 'ASK_DETAILS':
    case 'ASK_SIMILAR_TO':
      mode = 'explore';
      resultLimit = 10;
      break;
    case 'RANDOM_PICK':
      resultLimit = 5;
      break;
    case 'COMPARE_OPTIONS':
      resultLimit = 10;
      break;
    case 'FIND_NEAR_ME':
      shouldShowMap = true;
      resultLimit = 20;
      break;
    default:
      break;
  }

  return {
    mode,
    should_show_map: shouldShowMap,
    result_limit: resultLimit,
    fallback_applied: fallbackResult.fallback_applied,
    fallback_notes: fallbackResult.fallback_notes,
    fallback_level: fallbackResult.fallback_level,
  };
}
