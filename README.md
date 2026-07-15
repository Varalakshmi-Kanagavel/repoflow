# RepoFlow

RepoFlow is a RAG (Retrieval-Augmented Generation) application for questioning GitHub repositories.

## Architecture Change: SentenceTransformers Embeddings

We recently replaced OpenAI's `text-embedding-3-small` with local SentenceTransformers using the `all-mpnet-base-v2` model.

### Why SentenceTransformers?

- **Cost**: Local embeddings are free to generate and don't require an external API key (no more `OPENAI_API_KEY` required).
- **Privacy**: Source code chunks are embedded locally without sending them to a third-party embedding service.
- **Performance**: `all-mpnet-base-v2` offers state-of-the-art text embedding quality that is highly competitive with commercial models, making it ideal for code and documentation retrieval.

### Pinecone Configuration & Dimension Change

- `text-embedding-3-small` generated vectors with 1536 dimensions.
- `all-mpnet-base-v2` generates vectors with **768 dimensions**.

**Important**:
If you are migrating an existing instance of RepoFlow, the backend now automatically ensures that the Pinecone index `repoflow-chunks` is configured for 768 dimensions. If it finds a mismatch, it will delete and recreate the index. This means previous embeddings will be lost and repositories will need to be re-ingested.

### Groq LLM

The application now uses `llama-3.3-70b-versatile` through Groq for extremely fast, grounded answers.
