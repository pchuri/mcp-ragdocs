import { Client } from '@opensearch-project/opensearch';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ISearchClient, SearchResult, DocumentPayload } from '../types.js';

// Environment variables for OpenSearch configuration
const OPENSEARCH_NODE = process.env.OPENSEARCH_NODE;
const OPENSEARCH_USERNAME = process.env.OPENSEARCH_USERNAME;
const OPENSEARCH_PASSWORD = process.env.OPENSEARCH_PASSWORD;

// Default dimension for knn_vector
const EMBEDDING_DIMENSION = 1536; // Assuming text-embedding-3-small

export class OpenSearchClient implements ISearchClient {
  private client: Client;

  constructor() {
    if (!OPENSEARCH_NODE) {
      throw new McpError(ErrorCode.InvalidRequest, 'OPENSEARCH_NODE environment variable is required.');
    }
    if (!OPENSEARCH_USERNAME) {
      throw new McpError(ErrorCode.InvalidRequest, 'OPENSEARCH_USERNAME environment variable is required.');
    }
    if (!OPENSEARCH_PASSWORD) {
      throw new McpError(ErrorCode.InvalidRequest, 'OPENSEARCH_PASSWORD environment variable is required.');
    }

    this.client = new Client({
      node: OPENSEARCH_NODE,
      auth: {
        username: OPENSEARCH_USERNAME,
        password: OPENSEARCH_PASSWORD,
      },
      // Depending on your OpenSearch setup, you might need SSL options, e.g.:
      // ssl: {
      //   rejectUnauthorized: false // Use with caution, ideally use a proper CA
      // }
    });
  }

  async initCollection(collectionName: string): Promise<void> {
    try {
      const { body: indexExists } = await this.client.indices.exists({ index: collectionName });

      if (indexExists) {
        console.log(`OpenSearch index ${collectionName} already exists.`);
        return;
      }

      const mappingProperties: Record<string, any> = {
        embedding: {
          type: 'knn_vector',
          dimension: EMBEDDING_DIMENSION,
          method: { // Ensure method is specified if required by your OS version for cosinesimil
            name: 'hnsw',
            space_type: 'cosinesimil',
            engine: 'lucene', // lucene is often default in newer versions
          },
        },
        title: { type: 'text' },
        text: { type: 'text' },
        url: { type: 'keyword' }, // Using keyword for URLs to ensure they are not tokenized
        timestamp: { type: 'date' },
        _type: { type: 'keyword' }, // To store 'DocumentChunk'
      };

      await this.client.indices.create({
        index: collectionName,
        body: {
          settings: {
            'index.knn': true, // Enable k-NN for the index
            // "index.knn.algo_param.ef_search": 100 // Optional: fine-tune search performance
          },
          mappings: {
            properties: mappingProperties,
          },
        },
      });
      console.log(`OpenSearch index ${collectionName} created successfully with k-NN mapping.`);

    } catch (error: any) {
      console.error(`Error initializing OpenSearch collection ${collectionName}:`, error.meta?.body || error);
      const errorMessage = error.meta?.body?.error?.reason || error.message || 'Failed to initialize OpenSearch collection';
      throw new McpError(ErrorCode.InternalError, `OpenSearch Init Error: ${errorMessage}`);
    }
  }

  async search(
    collectionName: string,
    queryEmbedding: number[],
    limit: number,
    options?: Record<string, any> // options can include score_threshold, etc.
  ): Promise<SearchResult[]> {
    try {
      const requestBody: any = {
        size: limit,
        query: {
          knn: {
            embedding: { // Assuming 'embedding' is the k-NN vector field name
              vector: queryEmbedding,
              k: limit, // k is typically the number of neighbors to find
            },
          },
        },
        // _source: true, // Explicitly request _source, default is usually true
      };

      // OpenSearch k-NN search doesn't directly use a score_threshold in the query itself like Qdrant.
      // Filtering by score would typically be done client-side after receiving results,
      // or by combining k-NN with a post_filter if applicable and supported for k-NN scores.
      // For now, we retrieve 'k' results and can filter client-side if options.score_threshold is provided.

      const response = await this.client.search({
        index: collectionName,
        body: requestBody,
      });

      const hits = response.body.hits.hits;
      let searchResults: SearchResult[] = hits.map((hit: any) => {
        const payload = hit._source as DocumentPayload; // Assuming _source matches DocumentPayload
        // OpenSearch k-NN scores are distances (e.g., 0.0 to 2.0 for cosinesimil).
        // To make it comparable to Qdrant's similarity scores (higher is better, e.g., 0.0 to 1.0 for cosine):
        // For cosinesimil, score = 1 / (1 + distance). Or if it's already 0-1, adjust as needed.
        // The JS client might return scores that are already 0-1 for cosinesimil if properly configured.
        // Let's assume for now hit._score is directly usable or needs minimal adjustment.
        // If hit._score is a distance (e.g. for cosinesimil where 0 is identical),
        // a common conversion to similarity is 1 / (1 + distance) or ensuring it's already in desired format.
        // Qdrant's cosine similarity is 0-1 (higher is better).
        // OpenSearch's default cosine similarity for knn_vector is often also 0-1 (higher is better).
        // If the score is `null` or `undefined` for some reason, default to 0.
        const score = (hit._score !== undefined && hit._score !== null) ? Number(hit._score) : 0;

        return {
          id: hit._id,
          score: score,
          payload: payload && typeof payload === 'object' ? payload : null,
        };
      });

      if (options?.score_threshold && typeof options.score_threshold === 'number') {
        searchResults = searchResults.filter(result => result.score >= (options.score_threshold as number));
      }

      return searchResults;

    } catch (error: any) {
      console.error(`Error searching OpenSearch collection ${collectionName}:`, error.meta?.body || error);
      const errorMessage = error.meta?.body?.error?.reason || error.message || 'Failed to search OpenSearch collection';
      throw new McpError(ErrorCode.InternalError, `OpenSearch Search Error: ${errorMessage}`);
    }
  }
}
