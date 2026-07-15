import { describe, it, expect } from 'vitest';
import { CodeStrategy } from './code.strategy.js';
import { ChunkType } from '@prisma/client';

describe('CodeStrategy', () => {
  it('should chunk a TS file by functions and classes', () => {
    const strategy = new CodeStrategy();
    const content = `import { Something } from 'somewhere';

export class MyClass {
  methodOne() {
    return 1;
  }
}

export function myFunction() {
  return 'hello';
}

const x = 10;
`;

    const chunks = strategy.chunk(content, 'test.ts');

    // It should find the class and the function
    expect(chunks.length).toBe(2);

    expect(chunks[0]!.chunkType).toBe(ChunkType.CLASS);
    expect(chunks[0]!.content).toContain('export class MyClass');

    expect(chunks[1]!.chunkType).toBe(ChunkType.FUNCTION);
    expect(chunks[1]!.content).toContain('export function myFunction');
  });

  it('should fallback to sliding window if not a supported extension', () => {
    const strategy = new CodeStrategy();
    const content = `def hello():
    print("world")
`;

    const chunks = strategy.chunk(content, 'test.py');

    // Because it's .py and it's small, it falls back to FULL_FILE or SLIDING_WINDOW
    // SlidingWindowStrategy produces FULL_FILE for small files
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.chunkType).toBe(ChunkType.FULL_FILE);
  });
});
