import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { BaseHandler } from './base-handler.js';
import { McpToolResponse, SearchResult, isDocumentPayload, DocumentPayload } from '../types.js';

const COLLECTION_NAME = 'documentation';

export class SearchDocumentationHandler extends BaseHandler {
  async handle(args: any): Promise<McpToolResponse> {
    if (!args.query || typeof args.query !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Query is required');
    }

    const limit = args.limit || 5;
    const scoreThreshold = args.score_threshold ?? 0.7; // Allow overriding threshold

    try {
      const queryEmbedding = await this.apiClient.getEmbeddings(args.query);
      
      // Use the new searchClient from ApiClient
      const searchResults: SearchResult[] = await this.apiClient.searchClient.search(
        COLLECTION_NAME,
        queryEmbedding,
        limit,
        {
          with_payload: true,
          with_vector: false, // Optimize network transfer
          score_threshold: scoreThreshold,
        }
      );

      const formattedResults = searchResults
        .filter(result => result.payload && isDocumentPayload(result.payload)) // Ensure payload exists and is valid
        .map(result => {
          const payload = result.payload as DocumentPayload; // Safe cast after filter
          return `[${payload.title}](${payload.url})\nScore: ${result.score.toFixed(3)}\nContent: ${payload.text}\n`;
        })
        .join('\n---\n');

      return {
        content: [
          {
            type: 'text',
            text: formattedResults || 'No results found matching the query.',
          },
        ],
      };
    } catch (error) {
      // The searchClient methods are expected to throw McpError for known issues.
      // So, we can simplify the catch block or make it more generic.
      const message = error instanceof McpError ? error.message : (error instanceof Error ? error.message : String(error));
      // If the error is already an McpError, we might want to rethrow it or handle it specifically.
      // For now, wrap it in a generic "Search failed" McpToolResponse.
      // Consider logging the original error for debugging.
      console.error(`SearchDocumentationHandler Error: ${message}`, error);

      // Check if it's an McpError and if we want to pass its details along
      if (error instanceof McpError) {
        // You could choose to return the specific McpError details
        // For example: throw error; or return its specific message
        // For now, returning a generic tool error response
      }

      return {
        content: [
          {
            type: 'text',
            text: `Search failed: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
}