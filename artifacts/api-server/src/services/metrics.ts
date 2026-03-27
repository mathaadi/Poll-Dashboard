export interface RatingSet {
  delivery: (number | null)[];
  content: (number | null)[];
}

export function computeAverage(ratings: (number | null)[]): number | null {
  const valid = ratings.filter((r): r is number => r !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * NPS-style score for 1-5 ratings:
 * Promoters = 5, Passives = 4, Detractors = 1-3
 * NPS = (% Promoters - % Detractors) * 100
 */
export function computeNPS(ratings: (number | null)[]): number {
  const valid = ratings.filter((r): r is number => r !== null);
  if (valid.length === 0) return 0;

  const promoters = valid.filter((r) => r === 5).length;
  const detractors = valid.filter((r) => r <= 3).length;
  const nps = ((promoters - detractors) / valid.length) * 100;
  return Math.round(nps * 10) / 10;
}

export function computeDistribution(ratings: (number | null)[]): Record<string, number> {
  const dist: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const r of ratings) {
    if (r !== null && r >= 1 && r <= 5) {
      dist[String(r)]++;
    }
  }
  return dist;
}
