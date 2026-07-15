import { describe, it, expect } from 'vitest';
import { countTokens, truncateToTokenLimit, EMBEDDING_TOKEN_LIMIT } from './token-counter.js';

describe('countTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('counts tokens accurately for a known string', () => {
    // "hello world" encodes to exactly 2 tokens in cl100k_base
    expect(countTokens('hello world')).toBe(2);
  });

  it('returns a positive integer for non-trivial code', () => {
    const code = `export function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`;
    const count = countTokens(code);
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });
});

describe('truncateToTokenLimit', () => {
  it('returns the original string when under the limit', () => {
    const short = 'just a short string';
    expect(truncateToTokenLimit(short, 50)).toBe(short);
  });

  it('truncates a string that exceeds the limit', () => {
    // Build a string that is definitely > 10 tokens
    const long = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
    const truncated = truncateToTokenLimit(long, 10);
    expect(countTokens(truncated)).toBeLessThanOrEqual(10);
    expect(truncated.length).toBeLessThan(long.length);
  });

  it('defaults to EMBEDDING_TOKEN_LIMIT when no limit is provided', () => {
    // A short string should come back unchanged
    const text = 'hello';
    expect(truncateToTokenLimit(text)).toBe(text);
    expect(EMBEDDING_TOKEN_LIMIT).toBe(8191);
  });
});
