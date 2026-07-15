import { ChunkType } from '@prisma/client';
import type { ChunkingStrategy, ChunkRecord } from './base.strategy.js';
import { approximateTokenCount } from './base.strategy.js';

export class SlidingWindowStrategy implements ChunkingStrategy {
  private windowSize: number;
  private overlap: number;

  constructor(windowSize = 100, overlap = 20) {
    this.windowSize = windowSize;
    this.overlap = overlap;
  }

  chunk(content: string, _filePath: string): ChunkRecord[] {
    const lines = content.split('\n');
    const chunks: ChunkRecord[] = [];

    if (lines.length <= this.windowSize) {
      return [
        {
          content,
          startLine: 1,
          endLine: lines.length,
          chunkType: ChunkType.FULL_FILE,
          tokenCount: approximateTokenCount(content),
        },
      ];
    }

    let currentLine = 0;

    while (currentLine < lines.length) {
      const endLine = Math.min(currentLine + this.windowSize, lines.length);
      const chunkLines = lines.slice(currentLine, endLine);
      const chunkContent = chunkLines.join('\n');

      chunks.push({
        content: chunkContent,
        startLine: currentLine + 1,
        endLine,
        chunkType: ChunkType.SLIDING_WINDOW,
        tokenCount: approximateTokenCount(chunkContent),
      });

      if (endLine === lines.length) {
        break; // reached the end
      }

      // Move forward, minus overlap
      currentLine = endLine - this.overlap;
    }

    return chunks;
  }
}
