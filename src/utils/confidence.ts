import { Document } from '@langchain/core/documents';
import { getConfig } from '../config/index.js';

export interface ConfidenceFactors {
  similarityScores: number[];
  documentCount: number;
  topK: number;
  answerText: string;
  retrievalMethod: string;
}

export interface ConfidenceScore {
  overall: number;
  level: 'high' | 'medium' | 'low' | 'very_low';
  factors: {
    retrieval: number;
    relevance: number;
    coverage: number;
    answerQuality: number;
  };
  explanation?: string;
}

const UNCERTAINTY_PHRASES = [
  "i couldn't find",
  "i don't know",
  "i'm not sure",
  'i cannot',
  "i can't",
  'unclear',
  'uncertain',
  'based on limited information',
  'may not be',
  'might not',
  'possibly',
  'perhaps',
];

const UNCERTAINTY_WORDS = ['may', 'might', 'possibly', 'perhaps', 'maybe', 'unclear', 'uncertain'];

/**
 * Detects uncertainty phrases in the answer text
 */
function detectUncertaintyPhrases(answer: string): string[] {
  const lowerAnswer = answer.toLowerCase();
  const detected: string[] = [];

  for (const phrase of UNCERTAINTY_PHRASES) {
    if (lowerAnswer.includes(phrase)) {
      detected.push(phrase);
    }
  }

  for (const word of UNCERTAINTY_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(answer)) {
      detected.push(word);
    }
  }

  return detected;
}

/**
 * Calculates answer quality score based on answer characteristics
 */
function calculateAnswerQualityScore(answer: string): number {
  if (!answer || answer.trim().length === 0) {
    return 0.0;
  }

  const noInfoPatterns = [
    /i couldn't find/i,
    /i don't know/i,
    /no relevant information/i,
    /couldn't find relevant/i,
  ];

  for (const pattern of noInfoPatterns) {
    if (pattern.test(answer)) {
      return 0.1;
    }
  }

  const uncertaintyPhrases = detectUncertaintyPhrases(answer);
  const uncertaintyPenalty = Math.min(uncertaintyPhrases.length * 0.15, 0.5);

  const answerLength = answer.trim().length;
  let lengthScore = 1.0;

  if (answerLength < 20) {
    lengthScore = 0.3;
  } else if (answerLength < 50) {
    lengthScore = 0.6;
  } else if (answerLength > 2000) {
    lengthScore = 0.8;
  }

  const qualityScore = Math.max(0.0, Math.min(1.0, lengthScore - uncertaintyPenalty));

  return qualityScore;
}

/**
 * Normalizes similarity score based on retrieval method
 * Some methods (like MMR) may return scores in different ranges
 */
function normalizeSimilarityScore(score: number, _method: string): number {
  return Math.max(0.0, Math.min(1.0, score));
}

/**
 * Calculates confidence score based on multiple factors
 */
export function calculateConfidence(factors: ConfidenceFactors): ConfidenceScore {
  const config = getConfig();
  const { similarityScores, documentCount, topK, answerText, retrievalMethod } = factors;

  if (documentCount === 0 || similarityScores.length === 0) {
    return {
      overall: 0.0,
      level: 'very_low',
      factors: {
        retrieval: 0.0,
        relevance: 0.0,
        coverage: 0.0,
        answerQuality: calculateAnswerQualityScore(answerText),
      },
      explanation: 'No relevant documents were retrieved',
    };
  }

  const normalizedScores = similarityScores.map((score) =>
    normalizeSimilarityScore(score, retrievalMethod)
  );

  const avgSimilarity =
    normalizedScores.reduce((sum, score) => sum + score, 0) / normalizedScores.length;
  const retrievalScore = avgSimilarity;

  const maxSimilarity = Math.max(...normalizedScores);
  const relevanceScore = maxSimilarity;

  const coverageScore = Math.min(1.0, documentCount / topK);

  const answerQualityScore = calculateAnswerQualityScore(answerText);

  const overallScore =
    retrievalScore * 0.35 + relevanceScore * 0.3 + coverageScore * 0.15 + answerQualityScore * 0.2;

  const lowThreshold = config.confidenceLowThreshold ?? 0.4;
  const mediumThreshold = config.confidenceMediumThreshold ?? 0.6;
  const highThreshold = config.confidenceHighThreshold ?? 0.8;

  let level: 'high' | 'medium' | 'low' | 'very_low';
  if (overallScore >= highThreshold) {
    level = 'high';
  } else if (overallScore >= mediumThreshold) {
    level = 'medium';
  } else if (overallScore >= lowThreshold) {
    level = 'low';
  } else {
    level = 'very_low';
  }

  const parts: string[] = [];
  if (retrievalScore >= 0.8) {
    parts.push('highly relevant documents');
  } else if (retrievalScore >= 0.6) {
    parts.push('moderately relevant documents');
  } else {
    parts.push('limited document relevance');
  }

  if (coverageScore < 0.8) {
    parts.push('incomplete context coverage');
  }

  if (answerQualityScore < 0.6) {
    parts.push('answer contains uncertainty indicators');
  }

  const explanation = parts.length > 0 ? parts.join(', ') : 'high confidence across all factors';

  return {
    overall: Math.max(0.0, Math.min(1.0, overallScore)),
    level,
    factors: {
      retrieval: Math.max(0.0, Math.min(1.0, retrievalScore)),
      relevance: Math.max(0.0, Math.min(1.0, relevanceScore)),
      coverage: Math.max(0.0, Math.min(1.0, coverageScore)),
      answerQuality: Math.max(0.0, Math.min(1.0, answerQualityScore)),
    },
    explanation,
  };
}

/**
 * Extracts similarity scores from documents
 * Checks multiple possible metadata locations for scores
 */
export function extractSimilarityScores(documents: Document[]): number[] {
  return documents.map((doc) => {
    const metadata = doc.metadata;
    const score =
      metadata.similarityScore ??
      metadata.score ??
      metadata.similarity ??
      metadata.relevanceScore ??
      metadata.relevance;

    if (typeof score === 'number') {
      return score;
    }

    if (typeof score === 'string') {
      const parsed = parseFloat(score);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return 0.5;
  });
}
