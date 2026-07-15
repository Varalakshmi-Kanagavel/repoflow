const BINARY_EXTENSIONS = new Set([
  // Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.bmp',
  '.tiff',
  // Audio/Video
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.webm',
  '.ogg',
  // Fonts
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  // Documents
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  // Archives/Compressed
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.bz2',
  '.xz',
  // Binaries
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.jar',
  '.class',
  '.pyc',
  '.pyo',
  '.pyd',
]);

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  '__pycache__',
  '.next',
  '.nuxt',
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Gemfile.lock',
  'poetry.lock',
  'composer.lock',
  '.DS_Store',
  'thumbs.db',
]);

export function shouldIngestFile(filePath: string): boolean {
  const parts = filePath.split('/');

  // Check if any directory in the path is ignored
  for (const part of parts.slice(0, -1)) {
    if (IGNORED_DIRECTORIES.has(part)) {
      return false;
    }
  }

  const fileName = parts[parts.length - 1];
  if (!fileName) {
    return false;
  }

  // Check if file is explicitly ignored
  if (IGNORED_FILES.has(fileName)) {
    return false;
  }

  // Check for binary extensions
  const extIndex = fileName.lastIndexOf('.');
  if (extIndex > 0) {
    const ext = fileName.slice(extIndex).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) {
      return false;
    }
  }

  return true;
}
