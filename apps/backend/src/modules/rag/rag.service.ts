import { prisma } from '../../config/prisma.js';
import { sentenceTransformersProvider } from '../embedding/sentence-transformers.provider.js';
import { pineconeClient } from '../embedding/pinecone.client.js';
import { groqClient, type ChatMessage } from './groq.client.js';
import { truncateToTokenLimit } from '../../shared/token-counter.js';
import { NotFoundError } from '../../shared/errors.js';

export interface Citation {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  similarityScore: number;
}

export interface RagResponse {
  answer?: string;
  stream?: unknown; // Groq Stream Type
  citations: Citation[];
  confidenceScore: 'High' | 'Medium' | 'Low';
}

class RagService {
  /**
   * Generates a grounded answer based on the repository contents using RAG.
   */
  async queryRepository(
    repoId: string,
    question: string,
    stream: boolean = false,
  ): Promise<RagResponse> {
    // 1. Verify Repository Exists
    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
    });
    if (!repo) {
      throw new NotFoundError('Repository', repoId);
    }

    // 2. Embed Question
    const queryEmbedding = await sentenceTransformersProvider.generateSingleEmbedding(question);

    // 3. Query Pinecone
    const matches = await pineconeClient.queryVectors(
      repo.pineconeNamespace,
      queryEmbedding,
      10, // topK
    );

    if (!matches.length) {
      return this.buildEmptyResponse();
    }

    // 4. Hydrate Chunks from Postgres
    // matches contain { id, score, metadata } where id is pineconeVectorId, but metadata has chunkId
    const chunkIds = matches.map((m) => m.metadata?.chunkId as string).filter(Boolean);

    const chunks = await prisma.chunk.findMany({
      where: { id: { in: chunkIds } },
      include: { file: true },
    });

    // Create a map to preserve Pinecone sorting and scores
    const chunksMap = new Map(chunks.map((c) => [c.id, c]));

    let contextText = '';
    const citations: Citation[] = [];

    // 5. Build Context Window (Rerank/Trim)
    for (const match of matches) {
      const chunkId = match.metadata?.chunkId as string;
      const chunk = chunksMap.get(chunkId);

      if (!chunk) continue;

      const score = match.score || 0;

      citations.push({
        chunkId: chunk.id,
        filePath: chunk.file.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        similarityScore: score,
      });

      // Format for the LLM
      contextText += `\n\n--- FILE: ${chunk.file.filePath} (Lines ${chunk.startLine}-${chunk.endLine}) ---\n`;
      contextText += chunk.content;
    }

    // Compute average score and top‑K scores for confidence assessment
    const topScores = matches.map((m) => m.score ?? 0).sort((a, b) => b - a);
    const confidenceScore = this.computeConfidence(citations, question, topScores);

    // Truncate context if it gets too large (Groq context window protection)
    // llama3-70b-8192 has 8192 context window. We cap context text around 6000 tokens.
    contextText = truncateToTokenLimit(contextText, 6000);

    // 6. Build Prompt
    const systemPrompt = `You are a strict technical assistant answering questions based solely on the provided repository code chunks.
Follow these rules strictly:
1. Answer ONLY using the information from the provided context chunks.
2. If the context does not contain the answer, say "I don't have enough information in the current context to answer that."
3. Cite your sources using the file paths and line numbers provided in the context headers (e.g., "In \`src/main.ts\` (Lines 10-20)...").
4. Never invent or hallucinate code, file names, or functions that are not in the context.
5. Be concise and direct.

CONTEXT:
${contextText}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    // 7. Generate Response
    if (stream) {
      const streamResponse = await groqClient.streamResponse(messages);
      return {
        stream: streamResponse,
        citations,
        confidenceScore,
      };
    } else {
      const answer = await groqClient.generateResponse(messages);
      return {
        answer,
        citations,
        confidenceScore,
      };
    }
  }

  private buildEmptyResponse(): RagResponse {
    return {
      answer: "I couldn't find any relevant code in the repository to answer your question.",
      citations: [],
      confidenceScore: 'Low',
    };
  }

  // Multi‑signal confidence assessment
  private computeConfidence(
    citations: Citation[],
    question: string,
    topScores: number[],
  ): 'High' | 'Medium' | 'Low' {
    if (citations.length === 0) return 'Low';
    const bestScore = topScores[0] ?? 0;
    const avgTop3 =
      topScores.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, topScores.length);
    const usefulMatchCount = citations.filter((c) => c.similarityScore > 0.6).length;
    const lowerQuestion = question.toLowerCase();
    const exactFileMatch = citations.some((c) => lowerQuestion.includes(c.filePath.toLowerCase()));
    // Bonus for multiple chunks from same file
    const fileCounts: Record<string, number> = {};
    citations.forEach((c) => {
      fileCounts[c.filePath] = (fileCounts[c.filePath] || 0) + 1;
    });
    const maxChunksFromOneFile = Math.max(...Object.values(fileCounts));
    // Heuristic scoring
    let score = 0;
    if (bestScore > 0.85) score += 2;
    if (avgTop3 > 0.75) score += 2;
    if (usefulMatchCount >= 2) score += 1;
    if (exactFileMatch) score += 2;
    if (maxChunksFromOneFile >= 2) score += 1;
    if (score >= 5) return 'High';
    if (score >= 3) return 'Medium';
    return 'Low';
  }
}

export const ragService = new RagService();
