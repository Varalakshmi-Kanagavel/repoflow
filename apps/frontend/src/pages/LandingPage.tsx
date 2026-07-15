import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, GitBranch } from 'lucide-react';
import { apiClient } from '../services/api.client.js';

export function LandingPage() {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    try {
      setIsSubmitting(true);
      setError('');
      const repoId = await apiClient.ingestRepository(url);
      navigate(`/repo/${repoId}/ingest`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center -mt-16">
      <div className="max-w-3xl w-full text-center space-y-8 animate-slide-up">
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">
            Chat with any <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-600">
              GitHub Repository
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto">
            RepoFlow parses, chunks, and embeds entire codebases using AI. Drop a link below to
            start exploring code instantly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto relative group">
          <div className="absolute inset-0 bg-brand-500/20 rounded-xl blur-xl group-focus-within:bg-brand-500/30 transition-colors duration-500"></div>
          <div className="relative flex items-center bg-surface-900 border border-surface-700 rounded-xl overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all shadow-2xl">
            <div className="pl-4 pr-3 text-surface-400">
              <GitBranch className="w-6 h-6" />
            </div>
            <input
              type="url"
              required
              placeholder="https://github.com/owner/repo"
              className="flex-1 bg-transparent border-none py-4 px-2 text-surface-50 placeholder:text-surface-500 focus:outline-none focus:ring-0 text-lg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !url}
              className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-4 font-medium transition-colors disabled:opacity-50 flex items-center gap-2 h-full"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Analyze</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="text-error bg-error/10 px-4 py-3 rounded-lg border border-error/20 inline-block animate-fade-in">
            {error}
          </div>
        )}

        <div className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
          <Feature
            title="1. Ingest"
            description="We clone and parse the AST of every file in the repository."
          />
          <Feature
            title="2. Embed"
            description="Chunks are embedded via OpenAI and stored in Pinecone for semantic search."
          />
          <Feature
            title="3. Ask"
            description="Query the codebase using natural language and get cited answers instantly."
          />
        </div>
      </div>
    </div>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-surface-900/50 border border-surface-800">
      <h3 className="font-semibold text-brand-300 mb-2">{title}</h3>
      <p className="text-surface-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
