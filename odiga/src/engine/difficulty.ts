export type Difficulty = '★☆☆' | '★★☆' | '★★★';

export function getDifficulty(distanceMeters: number): Difficulty {
  if (distanceMeters < 800) return '★☆☆';
  if (distanceMeters <= 1800) return '★★☆';
  return '★★★';
}

export function getDifficultyLabel(difficulty: Difficulty): string {
  switch (difficulty) {
    case '★☆☆': return '쉬움';
    case '★★☆': return '보통';
    case '★★★': return '도전';
  }
}
