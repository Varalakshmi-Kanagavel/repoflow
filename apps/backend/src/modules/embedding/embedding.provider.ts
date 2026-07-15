export interface EmbeddingProvider {
  /**
   * Generates embeddings for a batch of text inputs.
   * @param inputs Array of strings to embed.
   * @returns Array of embedding vectors.
   */
  generateEmbeddings(inputs: string[]): Promise<number[][]>;

  /**
   * Generates a single embedding for a given text input.
   * @param input String to embed.
   * @returns A single embedding vector.
   */
  generateSingleEmbedding(input: string): Promise<number[]>;
}
