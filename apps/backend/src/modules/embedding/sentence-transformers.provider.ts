import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import type { EmbeddingProvider } from './embedding.provider.js';

// Configure transformers to not download models automatically to cache if possible,
// or set up proper caching paths. For this MVP, we'll let it use the default local cache.
// transformersEnv.allowLocalModels = false; // We fetch from HF hub by default

class SentenceTransformersProvider implements EmbeddingProvider {
  private modelName: string;
  private pipePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor() {
    this.modelName = `Xenova/${env.EMBEDDING_MODEL}`;
  }

  /**
   * Lazy load the model pipeline.
   * This prevents the server from hanging on startup while downloading the model
   * and only initializes it when an embedding is actually needed.
   */
  private async getPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.pipePromise) {
      logger.info(`[SentenceTransformersProvider] Loading model ${this.modelName}...`);
      this.pipePromise = pipeline('feature-extraction', this.modelName).catch((error) => {
        logger.error(`[SentenceTransformersProvider] Failed to load model ${this.modelName}`, {
          error,
        });
        this.pipePromise = null;
        throw error;
      });
    }
    return this.pipePromise;
  }

  async generateEmbeddings(inputs: string[]): Promise<number[][]> {
    if (!inputs.length) return [];

    try {
      const extractor = await this.getPipeline();

      // Run feature extraction
      // pooling: 'mean' and normalize: true are standard for sentence transformers (like all-mpnet-base-v2)
      const output = await extractor(inputs, { pooling: 'mean', normalize: true });

      // output.tolist() converts the Tensor to a standard JS array
      // For a batch of N items, it returns an N x D array.
      const embeddings: number[][] = output.tolist();

      return embeddings;
    } catch (error) {
      logger.error('[SentenceTransformersProvider] Failed to generate embeddings', { error });
      throw error;
    }
  }

  async generateSingleEmbedding(input: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([input]);
    if (!embeddings.length || !embeddings[0]) {
      throw new Error('Failed to generate embedding: empty response from SentenceTransformers');
    }
    return embeddings[0];
  }
}

export const sentenceTransformersProvider = new SentenceTransformersProvider();
