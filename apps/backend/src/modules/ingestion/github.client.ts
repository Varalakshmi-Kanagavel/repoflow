import { Octokit } from 'octokit';
import { env } from '../../config/env.js';

/** Minimal HTTP-error shape Octokit throws */
interface OctokitError {
  status?: number;
  message?: string;
}

function isOctokitError(err: unknown): err is OctokitError {
  return typeof err === 'object' && err !== null && 'status' in err;
}

export class GithubClient {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: env.GITHUB_TOKEN,
    });
  }

  async getRepository(owner: string, repo: string) {
    try {
      const response = await this.octokit.rest.repos.get({ owner, repo });
      return response.data;
    } catch (error: unknown) {
      if (isOctokitError(error)) {
        if (error.status === 404) {
          throw new Error(`Repository ${owner}/${repo} not found. It may be private or deleted.`);
        }
        if (error.status === 403) {
          throw new Error(`GitHub API rate limit exceeded. Consider adding a GITHUB_TOKEN.`);
        }
      }
      throw error;
    }
  }

  async getRepositoryTree(owner: string, repo: string, treeSha: string) {
    try {
      const response = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: 'true',
      });

      if (response.data.truncated) {
        console.warn(
          `[GithubClient] Warning: The git tree for ${owner}/${repo} is truncated because it is too large.`,
        );
      }

      return response.data.tree;
    } catch (error: unknown) {
      if (isOctokitError(error) && error.status === 403) {
        throw new Error(`GitHub API rate limit exceeded.`);
      }
      throw error;
    }
  }

  async getFileContent(owner: string, repo: string, filePath: string) {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        mediaType: { format: 'raw' },
      });

      // When requesting 'raw' format, the data is a string
      return response.data as unknown as string;
    } catch (error: unknown) {
      if (isOctokitError(error) && error.status === 403) {
        throw new Error(`GitHub API rate limit exceeded while fetching file ${filePath}.`);
      }
      throw error;
    }
  }
}

export const githubClient = new GithubClient();
