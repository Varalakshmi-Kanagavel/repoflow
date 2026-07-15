import { User, Bot } from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  confidenceScore?: 'High' | 'Medium' | 'Low';
}

export function MessageBubble({ role, content, confidenceScore }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-4 p-4 rounded-lg', isUser ? 'bg-surface-850' : 'bg-transparent')}>
      <div className="shrink-0 pt-1">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white">
            <User className="w-5 h-5" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-brand-400">
            <Bot className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-surface-300">
            {isUser ? 'You' : 'RepoFlow'}
          </span>
          {!isUser && confidenceScore && (
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border',
                confidenceScore === 'High' && 'bg-success/10 text-success border-success/20',
                confidenceScore === 'Medium' && 'bg-warning/10 text-warning border-warning/20',
                confidenceScore === 'Low' && 'bg-error/10 text-error border-error/20',
              )}
            >
              {confidenceScore} Confidence
            </span>
          )}
        </div>
        <div className="prose prose-invert max-w-none text-surface-50 break-words whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </div>
  );
}
