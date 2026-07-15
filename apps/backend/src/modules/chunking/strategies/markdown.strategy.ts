import { ChunkType } from '@prisma/client';
import type { ChunkingStrategy, ChunkRecord } from './base.strategy.js';
import { approximateTokenCount } from './base.strategy.js';

export class MarkdownStrategy implements ChunkingStrategy {
  chunk(content: string, _filePath: string): ChunkRecord[] {
    const lines = content.split('\n');
    const chunks: ChunkRecord[] = [];

    let currentChunkLines: string[] = [];
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // If we encounter a heading (e.g., #, ##) and we already have some content, flush the chunk
      if (line.match(/^#{1,6}\s/) && currentChunkLines.length > 0) {
        const chunkContent = currentChunkLines.join('\n');
        chunks.push({
          content: chunkContent,
          startLine,
          endLine: i,
          chunkType: ChunkType.HEADING_SECTION,
          tokenCount: approximateTokenCount(chunkContent),
        });

        currentChunkLines = [];
        startLine = i + 1;
      }

      currentChunkLines.push(line);
    }

    // Flush any remaining content
    if (currentChunkLines.length > 0) {
      const chunkContent = currentChunkLines.join('\n');
      // Only push if it's not just pure empty space
      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          startLine,
          endLine: lines.length,
          chunkType: ChunkType.HEADING_SECTION,
          tokenCount: approximateTokenCount(chunkContent),
        });
      }
    }

    return chunks;
  }
}
