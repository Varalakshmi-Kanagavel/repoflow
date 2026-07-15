import type { ChunkType } from '@prisma/client';
import { countTokens } from '../../../shared/token-counter.js';

export interface ChunkRecord {
  content: string;
  startLine: number;
  endLine: number;
  chunkType: ChunkType;
  tokenCount: number;
}

export interface ChunkingStrategy {
  /**
   * Generates a list of chunk records from the given file content.
   */
  chunk(content: string, filePath: string): ChunkRecord[];
}

/**
 * Token counter for use in chunking strategies.
 * Sprint 4: delegates to tiktoken (cl100k_base) for exact counts.
 * Previously this was a word-count heuristic — strategies don't need to change
 * their call sites because they all call this function.
 */
export function approximateTokenCount(text: string): number {
  return countTokens(text);
}
