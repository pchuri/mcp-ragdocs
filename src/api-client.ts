import OpenAI from 'openai';
import { chromium } from 'playwright';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ISearchClient } from '../types.js';
import { QdrantSearchClient } from '../search-clients/qdrant-client.js';
import { OpenSearchClient } from '../search-clients/opensearch-client.js'; // Added import

// Environment variables for configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SEARCH_CLIENT_TYPE = process.env.SEARCH_CLIENT_TYPE; // New environment variable
const DEFAULT_COLLECTION_NAME = process.env.DEFAULT_COLLECTION_NAME || 'documentation';

export class ApiClient {
  openaiClient?: OpenAI;
  browser: any;
  searchClient: ISearchClient;

  constructor() {
    // Initialize OpenAI client if API key is provided
    if (OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: OPENAI_API_KEY,
      });
    }

    // Initialize Search Client based on SEARCH_CLIENT_TYPE
    try {
      if (SEARCH_CLIENT_TYPE === 'opensearch') {
        console.log('Initializing OpenSearchClient...');
        this.searchClient = new OpenSearchClient();
      } else if (SEARCH_CLIENT_TYPE === 'qdrant') {
        console.log('Initializing QdrantSearchClient...');
        this.searchClient = new QdrantSearchClient();
      } else {
        if (SEARCH_CLIENT_TYPE) {
          console.warn(
            `Unsupported SEARCH_CLIENT_TYPE: "${SEARCH_CLIENT_TYPE}". Defaulting to Qdrant.`
          );
        } else {
          console.log('SEARCH_CLIENT_TYPE not set. Defaulting to Qdrant.');
        }
        this.searchClient = new QdrantSearchClient();
      }

      // Automatically initialize the default collection for the selected search client
      // This is an async operation, but constructor cannot be async.
      // We'll call it and let it run. Errors during this auto-init should be handled within initCollection.
      this.searchClient.initCollection(DEFAULT_COLLECTION_NAME)
        .then(() => {
          console.log(`Default collection "${DEFAULT_COLLECTION_NAME}" initialization process started for ${this.searchClient.constructor.name}.`);
        })
        .catch(error => {
          // Log critical failure of auto-initialization. The app might still run but search will fail.
          console.error(
            `CRITICAL: Auto-initialization of default collection "${DEFAULT_COLLECTION_NAME}" failed for ${this.searchClient.constructor.name}:`,
            error
          );
        });

    } catch (error) {
      console.error("Failed to initialize Search Client:", error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to initialize search client: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Reinstated initCollection method
  async initCollection(collectionName: string): Promise<void> {
    if (!this.searchClient) {
      throw new McpError(ErrorCode.InternalError, "Search client is not initialized.");
    }
    try {
      await this.searchClient.initCollection(collectionName);
      console.log(`Collection "${collectionName}" initialized successfully via ApiClient for ${this.searchClient.constructor.name}.`);
    } catch (error) {
      console.error(`Failed to initialize collection "${collectionName}" via ApiClient:`, error);
      // Re-throw as McpError or handle as appropriate
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to initialize collection "${collectionName}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async getEmbeddings(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'OpenAI API key not configured'
      );
    }

    try {
      const response = await this.openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate embeddings: ${error}`
      );
    }
  }
}
