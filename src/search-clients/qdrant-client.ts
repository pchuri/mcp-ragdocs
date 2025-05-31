import { QdrantClient as ActualQdrantClient, Schemas } from '@qdrant/js-client-rest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ISearchClient, SearchResult, DocumentPayload, isDocumentPayload } from '../types.js';

// Environment variables for configuration
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

export class QdrantSearchClient implements ISearchClient {
  private qdrantClient: ActualQdrantClient;

  constructor() {
    if (!QDRANT_URL) {
      throw new McpError(ErrorCode.InvalidRequest,'QDRANT_URL environment variable is required for QdrantSearchClient');
    }
    if (!QDRANT_API_KEY) {
      throw new McpError(ErrorCode.InvalidRequest, 'QDRANT_API_KEY environment variable is required for QdrantSearchClient');
    }

    this.qdrantClient = new ActualQdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }

  async initCollection(collectionName: string): Promise<void> {
    try {
      const collections = await this.qdrantClient.getCollections();
      const collectionExists = collections.collections.some(c => c.name === collectionName);

      if (!collectionExists) {
        await this.qdrantClient.createCollection(collectionName, {
          vectors: {
            size: 1536, // OpenAI text-embedding-3-small embedding size
            distance: 'Cosine' as Schemas.Distance, // Explicitly cast to Schemas.Distance
          },
          optimizers_config: {
            default_segment_number: 2,
            memmap_threshold: 20000,
          } as Schemas.OptimizersConfigDiff, // Explicitly cast
          replication_factor: 2,
        });
        console.log(`Collection ${collectionName} created.`);
      } else {
        console.log(`Collection ${collectionName} already exists.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('unauthorized')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Failed to authenticate with Qdrant. Please check your API key.'
          );
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
          throw new McpError(
            ErrorCode.InternalError,
            'Failed to connect to Qdrant. Please check your QDRANT_URL.'
          );
        }
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to initialize Qdrant collection ${collectionName}: ${error}`
      );
    }
  }

  async search(
    collectionName: string,
    queryEmbedding: number[],
    limit: number,
    options?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const searchResults = await this.qdrantClient.search(collectionName, {
        vector: queryEmbedding,
        limit,
        with_payload: options?.with_payload ?? true,
        with_vector: options?.with_vector ?? false,
        score_threshold: options?.score_threshold ?? 0.7,
        // Include any other options passed, or use defaults
        ...(options || {}),
      });

      return searchResults.map(result => {
        // Ensure the payload is of the expected type DocumentPayload
        // The id field is part of Qdrant's PointId type (string or number)
        // The score field is part of Qdrant's ScoredPoint type
        if (!isDocumentPayload(result.payload)) {
          // Handle cases where payload is not DocumentPayload or is null
          // For now, we'll throw an error or return a SearchResult with null payload
          // depending on strictness requirements.
          // Based on current usage, a valid DocumentPayload is expected.
          console.warn(`Invalid payload type for result ID ${result.id}:`, result.payload);
          // Returning with null payload if it's not matching, or skip this result
          return {
            id: result.id,
            score: result.score,
            payload: null,
          };
        }
        return {
          id: result.id,
          score: result.score,
          payload: result.payload as DocumentPayload, // Cast is safe due to isDocumentPayload check
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('unauthorized')) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Failed to authenticate with Qdrant while searching.'
          );
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
          throw new McpError(
            ErrorCode.InternalError,
            'Connection to Qdrant failed while searching.'
          );
        }
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed in Qdrant collection ${collectionName}: ${error}`
      );
    }
  }
}
