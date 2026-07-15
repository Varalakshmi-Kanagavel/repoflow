import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../shared/logger.js';
import { IngestionStatus } from '@prisma/client';
import { sentenceTransformersProvider } from './sentence-transformers.provider.js';
import { pineconeClient, type ChunkMetadata } from './pinecone.client.js';
import { truncateToTokenLimit, EMBEDDING_TOKEN_LIMIT } from '../../shared/token-counter.js';
import type { PineconeRecord } from '@pinecone-database/pinecone';

// Pinecone recommends batches of ≤100 vectors per upsert.
// OpenAI accepts up to 2048 inputs per embedding request but a smaller batch
// keeps memory predictable and makes retries cheaper.
const BATCH_SIZE = 100;

interface ChunkRow {
  id: string;
  content: string;
  fileId: string;
  chunkType: string;
}

export class EmbeddingService {
  /**
   * Embeds all un-indexed chunks for a repository and upserts them to Pinecone.
   *
   * Status transitions:
   *   CHUNKING → EMBEDDING (generating vectors)
   *   EMBEDDING → INDEXING  (upserting to Pinecone)
   *   INDEXING  → COMPLETED
   *
   * If anything throws, status is set to FAILED and the error is re-thrown so
   * the ingestion pipeline can log it at the top level.
   */
  async processRepository(repoId: string, namespace: string): Promise<void> {
    try {
      await this.updateStatus(repoId, IngestionStatus.EMBEDDING, 'Generating embeddings locally');

      // ── 1. Load all un-embedded chunks ──────────────────────────────────
      const chunks: ChunkRow[] = await prisma.chunk.findMany({
        where: { repoId, pineconeVectorId: null },
        select: { id: true, content: true, fileId: true, chunkType: true },
        orderBy: { createdAt: 'asc' },
      });

      if (chunks.length === 0) {
        logger.info(`[EmbeddingService] No pending chunks for repo ${repoId} — skipping`);
        await this.updateStatus(
          repoId,
          IngestionStatus.COMPLETED,
          'Completed (no chunks to embed)',
        );
        return;
      }

      logger.info(`[EmbeddingService] Embedding ${chunks.length} chunks for repo ${repoId}`);

      // ── 2. Clear old Pinecone namespace for idempotent re-ingestion ──────
      await pineconeClient.ensureIndex();
      await pineconeClient.deleteNamespace(namespace);

      // ── 3. Process in batches ────────────────────────────────────────────
      let processedCount = 0;
      let switchedToIndexing = false;

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        // Guard: truncate any chunk that exceeds the model token limit
        // (can happen with minified files or giant generated files).
        const inputs = batch.map((chunk) => {
          const tokenGuarded = truncateToTokenLimit(chunk.content, EMBEDDING_TOKEN_LIMIT);
          if (tokenGuarded.length < chunk.content.length) {
            logger.warn(
              `[EmbeddingService] Chunk ${chunk.id} truncated to ${EMBEDDING_TOKEN_LIMIT} tokens before embedding`,
            );
          }
          return tokenGuarded;
        });

        // a. Generate embeddings locally via SentenceTransformers
        const embeddings = await sentenceTransformersProvider.generateEmbeddings(inputs);

        // Switch status to INDEXING on first successful batch of embeddings
        if (!switchedToIndexing) {
          await this.updateStatus(
            repoId,
            IngestionStatus.INDEXING,
            `Indexing ${chunks.length} chunks into Pinecone`,
          );
          switchedToIndexing = true;
        }

        // b. Build Pinecone records — generate stable UUIDs now so we can
        //    write them back to Postgres immediately after upsert.
        const vectorIds = batch.map(() => randomUUID());

        const pineconeRecords: PineconeRecord<ChunkMetadata>[] = batch.map((chunk, idx) => ({
          id: vectorIds[idx]!,
          values: embeddings[idx]!,
          metadata: {
            chunkId: chunk.id,
            fileId: chunk.fileId,
            repoId,
            chunkType: chunk.chunkType,
          },
        }));

        // c. Upsert vectors into the repository's dedicated Pinecone namespace
        await pineconeClient.upsertVectors(namespace, pineconeRecords);

        // d. Write pineconeVectorId back to each Chunk row in Postgres
        //    Prisma doesn't have a bulk-update-with-different-values API, so we
        //    wrap individual updates in a transaction to keep them atomic.
        await prisma.$transaction(
          batch.map((chunk, idx) =>
            prisma.chunk.update({
              where: { id: chunk.id },
              data: { pineconeVectorId: vectorIds[idx] },
            }),
          ),
        );

        processedCount += batch.length;
        logger.debug(
          `[EmbeddingService] ${processedCount}/${chunks.length} chunks embedded & indexed`,
        );
      }

      // ── 4. Mark pipeline complete ────────────────────────────────────────
      await this.updateStatus(
        repoId,
        IngestionStatus.COMPLETED,
        'Ingestion, chunking, embedding, and indexing completed successfully',
      );
      logger.info(`[EmbeddingService] Fully completed for repo ${repoId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown embedding error';
      await this.updateStatus(repoId, IngestionStatus.FAILED, `Embedding failed: ${message}`);
      throw error;
    }
  }

  private async updateStatus(id: string, status: IngestionStatus, message: string): Promise<void> {
    await prisma.repository.update({
      where: { id },
      data: { status, statusMessage: message },
    });
  }
}

export const embeddingService = new EmbeddingService();
