import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Loader2, Code2, Database, MessageSquare, Plus } from 'lucide-react';
import { apiClient, type RagCitation, type ChatSession } from '../services/api.client.js';
import { useRepository } from '../hooks/useRepository.js';
import { MessageBubble } from '../components/chat/MessageBubble.js';
import { CitationCard } from '../components/chat/CitationCard.js';
import { cn } from '../lib/utils.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: RagCitation[];
  confidenceScore?: 'High' | 'Medium' | 'Low';
  isStreaming?: boolean;
}

export function ChatPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const navigate = useNavigate();
  const { data: repo, isLoading } = useRepository(repoId!);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch sessions on mount
  useEffect(() => {
    if (repoId) {
      apiClient
        .getSessions(repoId)
        .then((data) => {
          setSessions(data);
          const firstSession = data[0];
          if (firstSession && !currentSessionId) {
            loadSession(firstSession.id);
          }
        })
        .catch(console.error);
    }
  }, [repoId]);

  const loadSession = async (sessionId: string) => {
    if (!repoId) return;
    try {
      setIsHistoryLoading(true);
      setCurrentSessionId(sessionId);
      const apiMessages = await apiClient.getSessionMessages(repoId, sessionId);
      setMessages(
        apiMessages.map((m) => ({
          id: m.id,
          role: m.role.toLowerCase() as 'user' | 'assistant',
          content: m.content,
          citations: m.citations || [],
          confidenceScore: m.confidenceScore
            ? m.confidenceScore > 0.8
              ? 'High'
              : m.confidenceScore > 0.5
                ? 'Medium'
                : 'Low'
            : undefined,
        })),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const startNewSession = () => {
    setCurrentSessionId(undefined);
    setMessages([]);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Redirect if repo not ready
  useEffect(() => {
    if (repo && repo.status !== 'COMPLETED') {
      navigate(`/repo/${repoId}/ingest`);
    }
  }, [repo, repoId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || !repoId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const assistantMsgId = crypto.randomUUID();

    // Add empty assistant message placeholder
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        citations: [],
      },
    ]);

    await apiClient.streamChat(repoId, userMessage.content, currentSessionId, {
      onMetadata: (citations, confidence) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                { ...msg, citations, confidenceScore: confidence as any }
              : msg,
          ),
        );
      },
      onChunk: (text) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: msg.content + text } : msg,
          ),
        );
      },
      onDone: () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg)),
        );
        // Refresh sessions list
        if (repoId) {
          apiClient.getSessions(repoId).then(setSessions).catch(console.error);
        }
      },
      onError: () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: msg.content || 'An error occurred while fetching the answer.',
                  isStreaming: false,
                }
              : msg,
          ),
        );
      },
    });
  };

  if (isLoading || !repo) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // Get citations from the latest assistant message
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeCitations = lastAssistantMessage?.citations || [];

  return (
    <div className="flex-1 flex gap-4 h-[calc(100vh-8rem)]">
      {/* Sessions Sidebar */}
      <div className="w-64 hidden md:flex flex-col bg-surface-900/30 border border-surface-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="h-14 border-b border-surface-800 bg-surface-900/80 px-4 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-surface-200">Chats</h3>
          <button
            onClick={startNewSession}
            className="p-1 hover:bg-surface-800 rounded text-surface-400 hover:text-surface-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center text-xs text-surface-500 p-4">No past chats</div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 truncate transition-colors',
                  s.id === currentSessionId
                    ? 'bg-brand-500/10 text-brand-400 font-medium'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200',
                )}
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">{s.title || 'New Chat'}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-surface-900/30 border border-surface-800 rounded-2xl overflow-hidden shadow-xl min-w-0">
        {/* Repo Header */}
        <div className="h-14 border-b border-surface-800 bg-surface-900/80 px-4 flex items-center gap-3">
          <Database className="w-4 h-4 text-brand-400" />
          <span className="font-mono text-sm text-surface-200">
            {repo.owner}/{repo.name}
          </span>
          <span className="ml-auto text-xs text-surface-500">{repo.totalFiles} files indexed</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isHistoryLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-surface-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
              <Code2 className="w-12 h-12 text-surface-500" />
              <div>
                <p className="text-lg font-medium text-surface-200">Repository Indexed</p>
                <p className="text-sm text-surface-400">
                  Ask a question about the architecture, dependencies, or logic.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                confidenceScore={msg.confidenceScore}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 bg-surface-900/50 border-t border-surface-800">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the code..."
              disabled={isTyping}
              className="w-full bg-surface-950 border border-surface-700 rounded-xl py-3 pl-4 pr-12 text-surface-50 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="absolute right-2 p-2 text-brand-400 hover:text-brand-300 disabled:text-surface-600 transition-colors"
            >
              {isTyping ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Citations Sidebar */}
      <div className="w-80 hidden lg:flex flex-col bg-surface-900/30 border border-surface-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="h-14 border-b border-surface-800 bg-surface-900/80 px-4 flex items-center">
          <h3 className="font-semibold text-sm text-surface-200">Source Citations</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeCitations.length === 0 ? (
            <div className="text-center text-sm text-surface-500 mt-10">No active citations.</div>
          ) : (
            activeCitations.map((citation, i) => (
              <CitationCard key={`${citation.chunkId}-${i}`} citation={citation} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
