export function parseGithubUrl(url: string): { owner: string; name: string } {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'github.com') {
      throw new Error('Not a valid GitHub URL. Hostname must be github.com');
    }

    const parts = parsedUrl.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Invalid GitHub URL format. Expected https://github.com/owner/repo');
    }

    const owner = parts[0];
    let name = parts[1];

    if (!owner || !name) {
      throw new Error('Invalid GitHub URL format. Expected https://github.com/owner/repo');
    }

    if (name.endsWith('.git')) {
      name = name.slice(0, -4);
    }

    return { owner, name };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid URL provided');
    }
    throw error;
  }
}
