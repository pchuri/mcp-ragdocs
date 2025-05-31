export interface DocumentChunk {
  text: string;
  url: string;
  title: string;
  timestamp: string;
}

export interface DocumentPayload extends DocumentChunk {
  _type: 'DocumentChunk';
  [key: string]: unknown;
}

export function isDocumentPayload(payload: unknown): payload is DocumentPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Partial<DocumentPayload>;
  return (
    p._type === 'DocumentChunk' &&
    typeof p.text === 'string' &&
    typeof p.url === 'string' &&
    typeof p.title === 'string' &&
    typeof p.timestamp === 'string'
  );
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface McpToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export interface SearchResult {
  id: string | number;
  payload: DocumentPayload | null;
  score: number;
  // Potentially other fields from Qdrant like 'version', 'shard_key', etc.
  // Keeping it simple based on current usage.
}

export interface ISearchClient {
  search(
    collectionName: string,
    queryEmbedding: number[],
    limit: number,
    options?: Record<string, any> // For parameters like with_payload, with_vector, score_threshold etc.
  ): Promise<SearchResult[]>;

  initCollection(collectionName: string): Promise<void>;
}
