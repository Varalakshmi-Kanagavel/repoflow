import { prisma } from '../../config/prisma.js';
import { logger } from '../../shared/logger.js';
import { parseGithubUrl } from './url.parser.js';
import { githubClient } from './github.client.js';
import { shouldIngestFile } from './file.filter.js';
import { IngestionStatus } from '@prisma/client';
import { chunkingService } from '../chunking/chunking.service.js';
import { embeddingService } from '../embedding/embedding.service.js';

/** Minimal shape of a git-tree blob entry returned by Octokit */
interface TreeItem {
  type?: string;
  path?: string;
  sha?: string;
  size?: number;
}

export class IngestionService {
  /**
   * Start the ingestion process for a GitHub URL.
   * This handles the orchestration of parsing, fetching metadata, tree, and files.
   */
  async ingestRepository(githubUrl: string): Promise<string> {
    const { owner, name } = parseGithubUrl(githubUrl);

    // 1. Create or get the repository in PENDING state
    let repo = await prisma.repository.findUnique({
      where: { githubUrl },
    });

    if (!repo) {
      repo = await prisma.repository.create({
        data: {
          githubUrl,
          owner,
          name,
          pineconeNamespace: `${owner}-${name}`.toLowerCase(),
          status: IngestionStatus.PENDING,
        },
      });
    } else {
      repo = await prisma.repository.update({
        where: { id: repo.id },
        data: { status: IngestionStatus.PENDING, statusMessage: null },
      });
    }

    // Run the background process asynchronously
    // In a real production app without BullMQ, we might still want to return immediately
    // and let this run in the background. For this MVP, we just trigger it and let the promise float,
    // or we can await it if we want it synchronous. Since we return the ID, we'll let it float.
    this.runPipeline(repo.id, owner, name).catch((error) => {
      logger.error(`Ingestion pipeline failed for ${owner}/${name}`, { error });
    });

    return repo.id;
  }

  private async runPipeline(repoId: string, owner: string, name: string) {
    try {
      await this.updateStatus(repoId, IngestionStatus.FETCHING, 'Fetching repository metadata');

      // 2. Fetch repo metadata
      const repoData = await githubClient.getRepository(owner, name);
      const defaultBranch = repoData.default_branch || 'main';

      await prisma.repository.update({
        where: { id: repoId },
        data: {
          description: repoData.description,
          language: repoData.language,
          stars: repoData.stargazers_count,
          defaultBranch,
        },
      });

      // 3. Fetch recursive tree
      await this.updateStatus(repoId, IngestionStatus.FETCHING, 'Fetching repository tree');
      const tree = await githubClient.getRepositoryTree(owner, name, defaultBranch);

      // 4. Filter files
      const filesToIngest = (tree as TreeItem[])
        .filter((item) => item.type === 'blob' && item.path)
        .filter((item) => shouldIngestFile(item.path!));

      logger.info(
        `[Ingestion] Discovered ${filesToIngest.length} files to ingest for ${owner}/${name}`,
      );

      // 5. Batch download and chunk file contents
      await this.updateStatus(
        repoId,
        IngestionStatus.CHUNKING,
        `Downloading and chunking ${filesToIngest.length} files`,
      );

      const BATCH_SIZE = 20;
      let processedFiles = 0;
      let totalChunksCreated = 0;

      // Clear existing files to avoid duplicates on re-ingestion
      await prisma.repositoryFile.deleteMany({
        where: { repoId },
      });

      for (let i = 0; i < filesToIngest.length; i += BATCH_SIZE) {
        const batch = filesToIngest.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (file: TreeItem) => {
            try {
              // Fetch file content. (path is guaranteed non-null — we filtered above)
              const filePath = file.path!;
              const content = await githubClient.getFileContent(owner, name, filePath);

              const repoFile = await prisma.repositoryFile.create({
                data: {
                  repoId,
                  filePath,
                  sizeBytes: file.size ?? Buffer.byteLength(content, 'utf8'),
                  sha: file.sha ?? '',
                },
              });

              // Process chunking for this file immediately
              const chunksGenerated = await chunkingService.processFile(
                repoId,
                repoFile.id,
                filePath,
                content,
              );
              totalChunksCreated += chunksGenerated;
            } catch (err) {
              logger.warn(`[Ingestion] Failed to fetch file ${file.path}:`, err);
            }
          }),
        );

        processedFiles += batch.length;
        logger.debug(`[Ingestion] Processed ${processedFiles}/${filesToIngest.length} files`);
      }

      await prisma.repository.update({
        where: { id: repoId },
        data: {
          totalFiles: processedFiles,
          totalChunks: totalChunksCreated,
          ingestedAt: new Date(),
        },
      });

      logger.info(`[Ingestion] Chunking completed for ${owner}/${name}, starting embeddings...`);

      // 6. Transition to Embedding & Indexing
      const pineconeNamespace = `${owner}-${name}`.toLowerCase();
      await embeddingService.processRepository(repoId, pineconeNamespace);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.updateStatus(repoId, IngestionStatus.FAILED, message);
      throw error;
    }
  }

  private async updateStatus(id: string, status: IngestionStatus, message: string) {
    await prisma.repository.update({
      where: { id },
      data: { status, statusMessage: message },
    });
  }
}

export const ingestionService = new IngestionService();
