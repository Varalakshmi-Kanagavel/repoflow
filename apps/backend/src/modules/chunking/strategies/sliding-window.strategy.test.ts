import { describe, it, expect } from 'vitest';
import { SlidingWindowStrategy } from './sliding-window.strategy.js';
import { ChunkType } from '@prisma/client';

describe('SlidingWindowStrategy', () => {
  it('should chunk a small file as a single FULL_FILE chunk', () => {
    const strategy = new SlidingWindowStrategy(10, 2);
    const content = 'line1\nline2\nline3';

    const chunks = strategy.chunk(content, 'test.txt');

    expect(chunks.length).toBe(1);
    expect(chunks[0]!.chunkType).toBe(ChunkType.FULL_FILE);
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(3);
    expect(chunks[0]!.content).toBe(content);
  });

  it('should split a large file with overlapping windows', () => {
    const strategy = new SlidingWindowStrategy(5, 2);
    const lines = Array.from({ length: 12 }, (_, i) => `line${i + 1}`);
    const content = lines.join('\n');

    const chunks = strategy.chunk(content, 'test.txt');

    expect(chunks.length).toBeGreaterThan(1);

    // Chunk 1: lines 1-5
    expect(chunks[0]!.chunkType).toBe(ChunkType.SLIDING_WINDOW);
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(5);
    expect(chunks[0]!.content).toBe(lines.slice(0, 5).join('\n'));

    // Chunk 2: overlap 2 means it starts from (endLine - overlap) = 5 - 2 = line 3 (index 2) Wait, if overlap is 2, it means it shares 2 lines.
    // Wait, the logic in implementation: currentLine = endLine - overlap;
    // EndLine was 5. currentLine becomes 3. So next chunk starts at line 4 (index 3). It shares lines 4 and 5 (which is 2 lines). Correct.
    expect(chunks[1]!.startLine).toBe(4);
    expect(chunks[1]!.endLine).toBe(8);
  });
});
