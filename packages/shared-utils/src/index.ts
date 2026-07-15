// ─────────────────────────────────────────────────────────────
// RepoFlow Shared Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Parse a GitHub URL into owner and repository name.
 *
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch
 * - http://github.com/owner/repo
 *
 * @param url - GitHub repository URL
 * @returns Parsed owner and repo name, or null if invalid
 */
export function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== 'github.com') {
      return null;
    }

    const parts = parsed.pathname
      .replace(/^\//, '')
      .replace(/\.git$/, '')
      .split('/');

    const owner = parts[0];
    const name = parts[1];

    if (!owner || !name) {
      return null;
    }

    return { owner, name };
  } catch {
    return null;
  }
}

/**
 * Normalize a GitHub URL to a canonical form.
 * Removes .git suffix, tree/branch paths, and trailing slashes.
 *
 * @param url - GitHub repository URL
 * @returns Normalized URL or null if invalid
 */
export function normalizeGitHubUrl(url: string): string | null {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return null;
  return `https://github.com/${parsed.owner}/${parsed.name}`;
}

/**
 * Check if a file path should be excluded from ingestion.
 * Filters out build artifacts, dependencies, and binary files.
 *
 * @param filePath - Relative file path within the repository
 * @returns true if the file should be skipped
 */
export function shouldExcludeFile(filePath: string): boolean {
  const excludedDirs = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    'coverage/',
    '__pycache__/',
    '.next/',
    '.nuxt/',
    '.turbo/',
    'vendor/',
    '.cache/',
    'tmp/',
  ];

  const excludedExtensions = [
    '.min.js',
    '.min.css',
    '.map',
    '.lock',
    '.snap',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.mp4',
    '.mp3',
    '.zip',
    '.tar',
    '.gz',
    '.pdf',
    '.exe',
    '.dll',
    '.so',
    '.dylib',
  ];

  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check excluded directories
  for (const dir of excludedDirs) {
    if (normalizedPath.includes(dir)) {
      return true;
    }
  }

  // Check excluded extensions
  const lowerPath = normalizedPath.toLowerCase();
  for (const ext of excludedExtensions) {
    if (lowerPath.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect the programming language from a file extension.
 *
 * @param filePath - File path or name
 * @returns Detected language string or null
 */
export function detectLanguage(filePath: string): string | null {
  const extensionMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.dockerfile': 'dockerfile',
    '.graphql': 'graphql',
    '.proto': 'protobuf',
  };

  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    // Handle files without extensions
    const basename = filePath.split('/').pop()?.toLowerCase();
    if (basename === 'dockerfile') return 'dockerfile';
    if (basename === 'makefile') return 'makefile';
    return null;
  }

  const ext = filePath.slice(lastDot).toLowerCase();
  return extensionMap[ext] ?? null;
}

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Sleep for a given number of milliseconds.
 * Useful for rate-limiting API calls.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a byte count into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
