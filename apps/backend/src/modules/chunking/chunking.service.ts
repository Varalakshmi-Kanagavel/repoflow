import { prisma } from '../../config/prisma.js';
import { ChunkType } from '@prisma/client';
import { MarkdownStrategy } from './strategies/markdown.strategy.js';
import { CodeStrategy } from './strategies/code.strategy.js';
import { SlidingWindowStrategy } from './strategies/sliding-window.strategy.js';
import type { ChunkRecord } from './strategies/base.strategy.js';
import { countTokens } from '../../shared/token-counter.js';

export class ChunkingService {
  private markdownStrategy = new MarkdownStrategy();
  private codeStrategy = new CodeStrategy();
  private fallbackStrategy = new SlidingWindowStrategy();

  /**
   * Process a file's content and generate chunks, saving them to PostgreSQL.
   */
  async processFile(
    repoId: string,
    fileId: string,
    filePath: string,
    content: string,
  ): Promise<number> {
    let chunks: ChunkRecord[] = [];

    // Small files threshold (e.g., < 200 characters or < 10 lines)
    if (content.length < 200 || content.split('\n').length < 10) {
      chunks = [
        {
          content,
          startLine: 1,
          endLine: content.split('\n').length,
          chunkType: ChunkType.FULL_FILE,
          tokenCount: countTokens(content),
        },
      ];
    } else if (/\.md$/i.test(filePath)) {
      chunks = this.markdownStrategy.chunk(content, filePath);
    } else if (/\.(ts|tsx|js|jsx)$/i.test(filePath)) {
      chunks = this.codeStrategy.chunk(content, filePath);
    } else {
      chunks = this.fallbackStrategy.chunk(content, filePath);
    }

    // Persist chunks
    const chunkCreates = chunks.map((chunk, index) => {
      return {
        repoId,
        fileId,
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkType: chunk.chunkType,
        chunkIndex: index,
        tokenCount: chunk.tokenCount,
      };
    });

    if (chunkCreates.length > 0) {
      await prisma.chunk.createMany({
        data: chunkCreates,
      });
    }

    return chunkCreates.length;
  }
}

export const chunkingService = new ChunkingService();
