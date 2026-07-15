import React from 'react';
import { FileCode, Percent } from 'lucide-react';
import type { RagCitation } from '../../services/api.client.js';

interface CitationCardProps {
  citation: RagCitation;
  index: number;
}

export function CitationCard({ citation, index }: CitationCardProps) {
  const percentage = Math.round(citation.similarityScore * 100);

  return (
    <div className="bg-surface-850 border border-surface-800 rounded-lg p-3 hover:border-brand-500/50 transition-colors group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-brand-300 font-mono text-xs break-all">
          <span className="w-5 h-5 rounded bg-surface-800 flex items-center justify-center shrink-0 text-surface-400">
            {index + 1}
          </span>
          <FileCode className="w-3.5 h-3.5 shrink-0" />
          <span className="group-hover:text-brand-400 transition-colors" title={citation.filePath}>
            {citation.filePath.split('/').pop()}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-medium text-surface-400 shrink-0 bg-surface-900 px-1.5 py-0.5 rounded border border-surface-800">
          <Percent className="w-3 h-3" />
          {percentage}%
        </div>
      </div>
      <div className="text-xs text-surface-400 font-mono">
        Lines {citation.startLine} - {citation.endLine}
      </div>
    </div>
  );
}
