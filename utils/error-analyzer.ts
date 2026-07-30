import { ERROR_PATTERNS, GENERIC_ERROR } from '@/constants/error-patterns';
import { ErrorPattern } from '@/types/error';

export const analyzeError = (errorText: string): ErrorPattern | null => {
    if (!errorText || errorText.trim().length === 0) return null;
    const lower = errorText.toLowerCase();
    const scores: { pattern: ErrorPattern; score: number }[] = [];

    for (const pattern of ERROR_PATTERNS) {
        let score = 0;
        pattern.patterns.forEach((p, j) => {
            if (lower.includes(p)) {
                score += (2 - j * 0.1);
            }
        });
        if (score > 0) {
            scores.push({ pattern, score });
        }
    }

    if (scores.length === 0) return GENERIC_ERROR;
    scores.sort((a, b) => b.score - a.score);
    return scores[0].pattern;
};