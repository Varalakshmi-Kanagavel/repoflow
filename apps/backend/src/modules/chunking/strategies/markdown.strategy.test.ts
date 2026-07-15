import { describe, it, expect } from 'vitest';
import { MarkdownStrategy } from './markdown.strategy.js';
import { ChunkType } from '@prisma/client';

describe('MarkdownStrategy', () => {
  it('should chunk markdown files by headings', () => {
    const strategy = new MarkdownStrategy();
    const content = `# Heading 1
Some text here.

## Heading 2
More text here.
Line 3.`;

    const chunks = strategy.chunk(content, 'test.md');

    expect(chunks.length).toBe(2);

    expect(chunks[0]!.chunkType).toBe(ChunkType.HEADING_SECTION);
    expect(chunks[0]!.startLine).toBe(1);
    expect(chunks[0]!.endLine).toBe(3);

    expect(chunks[1]!.chunkType).toBe(ChunkType.HEADING_SECTION);
    expect(chunks[1]!.startLine).toBe(4);
    expect(chunks[1]!.endLine).toBe(6);
  });
});
