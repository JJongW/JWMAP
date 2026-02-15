import { MODE_STEP_MAP, getModeFromPeopleCount } from './scoringConfig';

export interface ModeConfig {
  mode: string;
  steps: number;
  labels: string[];
}

const MODE_LABELS: Record<string, string[]> = {
  solo: ['탐색', '마무리'],
  date: ['시작', '메인', '마무리'],
  group: ['집합', '메인', '마무리'],
  party: ['저녁', '2차', '3차', '마무리'],
};

export function planMode(peopleCount: number, modeOverride?: string | null): ModeConfig {
  const mode = modeOverride || getModeFromPeopleCount(peopleCount);
  const steps = MODE_STEP_MAP[mode] || 3;
  const labels = MODE_LABELS[mode] || Array.from({ length: steps }, (_, i) => `Step ${i + 1}`);

  return { mode, steps, labels };
}
