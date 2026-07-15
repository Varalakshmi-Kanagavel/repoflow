const API_BASE_URL = 'http://localhost:3001/v1';

export interface RepoIngestResponse {
  success: boolean;
  message: string;
  data: {
    repoId: string;
  };
}

export interface RepositoryMetadata {
  id: string;
  githubUrl: string;
  owner: string;
  name: string;
  status: 'PENDING' | 'FETCHING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'COMPLETED' | 'FAILED';
  statusMessage?: string;
  totalFiles: number;
  totalChunks: number;
}

export interface RagCitation {
  chunkId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  similarityScore: number;
}

export interface RagResponse {
  answer: string;
  citations: RagCitation[];
  confidenceScore: 'High' | 'Medium' | 'Low';
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface ChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations: RagCitation[] | null;
  confidenceScore: number | null;
  createdAt: string;
}

class ApiClient {
  async getSessions(repoId: string): Promise<ChatSession[]> {
    const res = await fetch(`${API_BASE_URL}/repos/${repoId}/sessions`);
    if (!res.ok) throw new Error('Failed to fetch sessions');
    const json = await res.json();
    return json.data;
  }

  async getSessionMessages(repoId: string, sessionId: string): Promise<ChatMessage[]> {
    const res = await fetch(`${API_BASE_URL}/repos/${repoId}/sessions/${sessionId}/messages`);
    if (!res.ok) throw new Error('Failed to fetch session messages');
    const json = await res.json();
    return json.data;
  }

  async ingestRepository(githubUrl: string): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/repos/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ githubUrl }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to ingest repository');
    }

    const json = (await res.json()) as RepoIngestResponse;
    return json.data.repoId;
  }

  async getRepository(repoId: string): Promise<RepositoryMetadata> {
    const res = await fetch(`${API_BASE_URL}/repos/${repoId}`);

    if (!res.ok) {
      throw new Error('Failed to fetch repository metadata');
    }

    const json = await res.json();
    return json.data;
  }

  /**
   * Reads from the SSE streaming endpoint and calls callbacks for metadata and chunks.
   */
  async streamChat(
    repoId: string,
    question: string,
    sessionId: string | undefined,
    callbacks: {
      onMetadata: (citations: RagCitation[], confidence: string) => void;
      onChunk: (text: string) => void;
      onDone: () => void;
      onError: (err: Error) => void;
    },
  ) {
    try {
      const res = await fetch(`${API_BASE_URL}/repos/${repoId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, stream: true, sessionId }),
      });

      if (!res.ok) {
        throw new Error('Failed to start chat stream');
      }

      if (!res.body) {
        throw new Error('No readable stream returned');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          callbacks.onDone();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE messages are separated by \n\n
        const parts = buffer.split('\n\n');

        // The last part might be incomplete, so keep it in the buffer
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.trim() === '') continue;

          // SSE format: "data: {...}"
          if (part.startsWith('data: ')) {
            const dataStr = part.replace(/^data:\s*/, '');

            if (dataStr === '[DONE]') {
              callbacks.onDone();
              return;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.type === 'metadata') {
                callbacks.onMetadata(data.citations, data.confidenceScore);
              } else if (data.type === 'chunk') {
                callbacks.onChunk(data.text);
              }
            } catch {
              console.warn('Failed to parse SSE JSON chunk', dataStr);
            }
          }
        }
      }
    } catch (err) {
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export const apiClient = new ApiClient();
