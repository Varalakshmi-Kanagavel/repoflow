import { get_encoding, type Tiktoken } from 'tiktoken';

// cl100k_base is the encoding for:
//   - text-embedding-3-small
//   - text-embedding-ada-002
//   - gpt-4 / gpt-3.5-turbo
// Sprint 4 target model: text-embedding-3-small — same encoding, same limit (8191 tokens).
const ENCODING_NAME = 'cl100k_base';

// The token limit for text-embedding-3-small is 8191 tokens.
export const EMBEDDING_TOKEN_LIMIT = 8191;

let _encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!_encoder) {
    _encoder = get_encoding(ENCODING_NAME);
  }
  return _encoder;
}

/**
 * Returns the exact token count for a given text using tiktoken (cl100k_base).
 * Replaces the Sprint 3 heuristic of `wordCount * 1.3`.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  const encoder = getEncoder();
  return encoder.encode(text).length;
}

/**
 * Truncates text so that its token count does not exceed maxTokens.
 * Used to guard against accidentally exceeding the embedding model's context window.
 */
export function truncateToTokenLimit(text: string, maxTokens = EMBEDDING_TOKEN_LIMIT): string {
  const encoder = getEncoder();
  const tokens = encoder.encode(text);
  if (tokens.length <= maxTokens) return text;
  // Decode only the first maxTokens tokens back to a string
  const truncated = tokens.slice(0, maxTokens);
  return new TextDecoder().decode(encoder.decode(truncated));
}
