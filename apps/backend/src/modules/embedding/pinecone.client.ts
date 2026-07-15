import { Pinecone, type PineconeRecord, type RecordMetadata } from '@pinecone-database/pinecone';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

export interface ChunkMetadata extends RecordMetadata {
  chunkId: string;
  fileId: string;
  repoId: string;
  chunkType: string;
}

class PineconeClient {
  private client: Pinecone;
  private indexName: string;

  constructor() {
    this.client = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    this.indexName = env.PINECONE_INDEX_NAME;
  }

  /**
   * Ensures the Pinecone index exists and has the correct dimension (768 for all-mpnet-base-v2).
   * If it exists with a different dimension, it deletes and recreates it.
   */
  async ensureIndex(): Promise<void> {
    const targetDimension = 768;
    const existingIndexes = await this.client.listIndexes();
    const indexMeta = existingIndexes.indexes?.find((idx) => idx.name === this.indexName);

    if (indexMeta) {
      if (indexMeta.dimension === targetDimension) {
        logger.debug(
          `[PineconeClient] Index "${this.indexName}" exists and has correct dimension (${targetDimension}).`,
        );
        return;
      }
      logger.warn(
        `[PineconeClient] Index "${this.indexName}" has incorrect dimension (${indexMeta.dimension}). Recreating with dimension ${targetDimension}...`,
      );
      await this.client.deleteIndex(this.indexName);
    } else {
      logger.info(`[PineconeClient] Index "${this.indexName}" does not exist. Creating...`);
    }

    await this.client.createIndex({
      name: this.indexName,
      dimension: targetDimension,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });
    logger.info(
      `[PineconeClient] Successfully created index "${this.indexName}" with dimension ${targetDimension}.`,
    );
  }

  /**
   * Upserts vectors into a repository-specific namespace.
   * The Pinecone SDK v7 upsert API expects { records: PineconeRecord[] }.
   * We store only lightweight metadata here; full content lives in Postgres.
   */
  async upsertVectors(namespace: string, records: PineconeRecord<ChunkMetadata>[]): Promise<void> {
    if (records.length === 0) return;

    try {
      const index = this.client.Index<ChunkMetadata>(this.indexName);
      await index.namespace(namespace).upsert({ records });
      logger.debug(
        `[PineconeClient] Upserted ${records.length} vectors → namespace "${namespace}"`,
      );
    } catch (error) {
      logger.error(`[PineconeClient] Upsert failed for namespace "${namespace}"`, { error });
      throw error;
    }
  }

  /**
   * Clears a namespace before re-ingestion so stale vectors don't accumulate.
   * Silently ignores errors (namespace may not exist on first run).
   */
  async deleteNamespace(namespace: string): Promise<void> {
    try {
      const index = this.client.Index(this.indexName);
      await index.namespace(namespace).deleteAll();
      logger.debug(`[PineconeClient] Cleared namespace "${namespace}"`);
    } catch {
      // Non-fatal — namespace simply may not exist yet
    }
  }
  /**
   * Queries vectors in a repository-specific namespace.
   * Retrieves the top `topK` matches for a given query vector.
   */
  async queryVectors(namespace: string, queryVector: number[], topK: number = 10) {
    try {
      const index = this.client.Index<ChunkMetadata>(this.indexName);
      const queryResponse = await index.namespace(namespace).query({
        vector: queryVector,
        topK,
        includeMetadata: true,
      });

      logger.debug(
        `[PineconeClient] Queried namespace "${namespace}", returned ${queryResponse.matches.length} matches`,
      );

      return queryResponse.matches;
    } catch (error) {
      logger.error(`[PineconeClient] Query failed for namespace "${namespace}"`, { error });
      throw error;
    }
  }
}

export const pineconeClient = new PineconeClient();
