import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, FileCode, Database, Cpu, Network } from 'lucide-react';
import { useRepository } from '../hooks/useRepository.js';
import { cn } from '../lib/utils.js';

const STAGES = [
  { id: 'PENDING', label: 'Queued', icon: Loader2 },
  { id: 'FETCHING', label: 'Cloning Repository', icon: Network },
  { id: 'CHUNKING', label: 'Parsing & Chunking', icon: FileCode },
  { id: 'EMBEDDING', label: 'Generating Embeddings', icon: Cpu },
  { id: 'INDEXING', label: 'Upserting to Pinecone', icon: Database },
  { id: 'COMPLETED', label: 'Ready for Chat', icon: CheckCircle2 },
];

export function IngestionPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const { data: repo, isLoading, error } = useRepository(repoId!);

  useEffect(() => {
    if (repo?.status === 'COMPLETED') {
      // Small delay for UX so they see the success state
      const timer = setTimeout(() => {
        navigate(`/repo/${repoId}/chat`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [repo?.status, navigate, repoId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-12 h-12 text-error mx-auto" />
          <h2 className="text-xl font-semibold">Failed to load repository</h2>
          <p className="text-surface-400">{error?.message || 'Repository not found'}</p>
        </div>
      </div>
    );
  }

  if (repo.status === 'FAILED') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <XCircle className="w-16 h-16 text-error mx-auto" />
          <h2 className="text-2xl font-bold">Ingestion Failed</h2>
          <p className="text-surface-400 bg-surface-900 p-4 rounded-lg font-mono text-sm break-words border border-surface-800">
            {repo.statusMessage || 'An unknown error occurred during ingestion.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg font-medium transition-colors"
          >
            Try Another Repository
          </button>
        </div>
      </div>
    );
  }

  // Determine active step index
  let activeIndex = STAGES.findIndex((s) => s.id === repo.status);
  if (activeIndex === -1) activeIndex = 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
      <div className="bg-surface-900/50 border border-surface-800 rounded-2xl p-8 sm:p-12 w-full shadow-xl">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-surface-50 mb-2">Analyzing Repository</h2>
          <p className="text-surface-400 text-sm">
            {repo.owner}/{repo.name}
          </p>
        </div>

        <div className="space-y-6">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const isCompleted = index < activeIndex || repo.status === 'COMPLETED';
            const isActive = index === activeIndex && repo.status !== 'COMPLETED';

            return (
              <div key={stage.id} className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500',
                    isCompleted
                      ? 'bg-success/20 text-success'
                      : isActive
                        ? 'bg-brand-500/20 text-brand-400 ring-2 ring-brand-500/50 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                        : 'bg-surface-800 text-surface-600',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isActive ? (
                    <Icon className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1">
                  <h4
                    className={cn(
                      'font-medium transition-colors duration-300',
                      isCompleted
                        ? 'text-surface-200'
                        : isActive
                          ? 'text-brand-300'
                          : 'text-surface-600',
                    )}
                  >
                    {stage.label}
                  </h4>
                  {isActive && stage.id === 'CHUNKING' && repo.totalFiles > 0 && (
                    <p className="text-xs text-brand-400/80 mt-1">
                      Processed {repo.totalFiles} files
                    </p>
                  )}
                  {isActive && stage.id === 'EMBEDDING' && repo.totalChunks > 0 && (
                    <p className="text-xs text-brand-400/80 mt-1">
                      Embedding {repo.totalChunks} chunks
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
