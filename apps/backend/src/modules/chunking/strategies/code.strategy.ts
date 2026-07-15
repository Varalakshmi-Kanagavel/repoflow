import * as ts from 'typescript';
import { ChunkType } from '@prisma/client';
import type { ChunkingStrategy, ChunkRecord } from './base.strategy.js';
import { approximateTokenCount } from './base.strategy.js';
import { SlidingWindowStrategy } from './sliding-window.strategy.js';

export class CodeStrategy implements ChunkingStrategy {
  private fallbackStrategy = new SlidingWindowStrategy();

  chunk(content: string, filePath: string): ChunkRecord[] {
    const isTypeScriptOrJavaScript = /\.(ts|tsx|js|jsx)$/i.test(filePath);

    if (!isTypeScriptOrJavaScript) {
      // If not supported by our AST parser, fallback to sliding window
      return this.fallbackStrategy.chunk(content, filePath);
    }

    try {
      const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

      const chunks: ChunkRecord[] = [];
      const lines = content.split('\n');

      // Helper to convert pos to line number (1-based)
      const getLineNumber = (pos: number) => {
        return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
      };

      // Helper to add a chunk
      const addChunk = (node: ts.Node, type: ChunkType) => {
        const startPos = node.getStart(sourceFile);
        const endPos = node.getEnd();

        const startLine = getLineNumber(startPos);
        const endLine = getLineNumber(endPos);

        // Extract exact text using line numbers (or node.getText)
        // node.getText(sourceFile) does not include leading comments, getFullText does.
        // We'll just slice the lines directly to be consistent and avoid weird whitespace
        const chunkContent = lines.slice(startLine - 1, endLine).join('\n');

        chunks.push({
          content: chunkContent,
          startLine,
          endLine,
          chunkType: type,
          tokenCount: approximateTokenCount(chunkContent),
        });
      };

      // Walk AST
      const visit = (node: ts.Node) => {
        if (ts.isClassDeclaration(node)) {
          addChunk(node, ChunkType.CLASS);
          // Don't traverse inside class if we consider the whole class one chunk,
          // but if it's too large we might want to chunk methods.
          // For MVP, just the whole class is one chunk.
        } else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          addChunk(node, ChunkType.FUNCTION);
        } else if (
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.length > 0 &&
          node.declarationList.declarations[0]!.initializer &&
          (ts.isArrowFunction(node.declarationList.declarations[0]!.initializer) ||
            ts.isFunctionExpression(node.declarationList.declarations[0]!.initializer))
        ) {
          addChunk(node, ChunkType.FUNCTION);
        } else {
          ts.forEachChild(node, visit);
        }
      };

      ts.forEachChild(sourceFile, visit);

      // If we couldn't find any functions or classes (e.g., it's just a bunch of top-level code or types),
      // we fallback to sliding window.
      if (chunks.length === 0) {
        return this.fallbackStrategy.chunk(content, filePath);
      }

      // Sort chunks by startLine
      chunks.sort((a, b) => a.startLine - b.startLine);

      // We might have missed some global top-level code, but for MVP
      // capturing the classes and functions is sufficient for semantic retrieval.
      return chunks;
    } catch (error) {
      console.warn(
        `[CodeStrategy] AST parsing failed for ${filePath}, falling back to sliding window.`,
        error,
      );
      return this.fallbackStrategy.chunk(content, filePath);
    }
  }
}
