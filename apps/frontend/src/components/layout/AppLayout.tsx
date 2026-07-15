import { Outlet, Link } from 'react-router-dom';
import { GitBranch, Database } from 'lucide-react';

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-surface-800 bg-surface-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-brand-400 hover:text-brand-300 transition-colors"
          >
            <Database className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">RepoFlow</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-surface-400 hover:text-surface-50 transition-colors"
            >
              <GitBranch className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      <footer className="border-t border-surface-800 py-6 text-center text-sm text-surface-400">
        <p>RepoFlow &copy; {new Date().getFullYear()} — Built for intelligent codebase search.</p>
      </footer>
    </div>
  );
}
