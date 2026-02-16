import { useCallback, useState } from 'react';
import type { LLMSuggestions } from '../schemas/llmSuggestions';

interface UseTagSuggestionsParams {
  placeName: string;
  category: string;
  experience: string;
}

export function useTagSuggestions() {
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [suggestions, setSuggestions] = useState<LLMSuggestions | null>(null);

  const requestSuggestions = useCallback(async (
    params: UseTagSuggestionsParams
  ): Promise<{ suggestions: LLMSuggestions | null }> => {
    if (!params.experience.trim()) {
      return { suggestions: null };
    }

    setIsGeneratingTags(true);
    setSuggestions(null);
    try {
      const response = await fetch('/api/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        return { suggestions: null };
      }

      const data = await response.json() as LLMSuggestions;
      setSuggestions(data);
      return { suggestions: data };
    } catch (error) {
      console.error('Tag suggestion error:', error);
      return { suggestions: null };
    } finally {
      setIsGeneratingTags(false);
    }
  }, []);

  return {
    isGeneratingTags,
    suggestions,
    requestSuggestions,
    setSuggestions,
  };
}
