# Changelog

## [1.2.0] - 2024-03-16

### Feature: Configurable Search Backend
- Added support for multiple search backends (Qdrant and OpenSearch).
- Introduced `SEARCH_CLIENT_TYPE` environment variable to select the active search client.
  - Supported values: `qdrant`, `opensearch`. Defaults to `qdrant`.
- Introduced `DEFAULT_COLLECTION_NAME` environment variable to configure the default search index/collection name.
- Implemented `OpenSearchClient` in `src/search-clients/opensearch-client.ts` supporting:
  - Connection to OpenSearch via environment variables (`OPENSEARCH_NODE`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`).
  - Index creation (`initCollection`) with k-NN compatible mappings.
  - k-NN search (`search`) functionality.
- Refactored `QdrantClient` to `QdrantSearchClient` in `src/search-clients/qdrant-client.ts`.
- Modified `ApiClient` to dynamically instantiate and manage the selected search client.
  - Search client attempts to auto-initialize the `DEFAULT_COLLECTION_NAME` on startup.
- Added `@opensearch-project/opensearch` package to dependencies.

### Documentation
- Updated `README.md` with instructions for configuring `SEARCH_CLIENT_TYPE` and related environment variables for both Qdrant and OpenSearch.
- Added this changelog entry.

## [1.1.0] - 2024-03-14

### Initial Feature Addition
- Implemented new clear_queue tool for queue management
  - Created src/tools/clear-queue.ts with core functionality
  - Added handler in src/handlers/clear-queue.ts
  - Integrated with existing queue management system
  - Added tool exports and registration

### Code Organization
- Improved tool ordering in handler-registry.ts
  - Moved remove_documentation before extract_urls
  - Enhanced logical grouping of related tools
  - Updated imports to match new ordering

### Documentation Enhancement Phase 1
- Enhanced tool descriptions in handler-registry.ts:
  1. search_documentation
     - Added natural language query support details
     - Clarified result ranking and context
     - Improved limit parameter documentation
  2. list_sources
     - Added details about indexed documentation
     - Clarified source information returned
  3. extract_urls
     - Enhanced URL crawling explanation
     - Added queue integration details
     - Clarified URL validation requirements
  4. remove_documentation
     - Added permanence warning
     - Clarified URL matching requirements
  5. list_queue
     - Added queue monitoring details
     - Clarified status checking capabilities
  6. run_queue
     - Added processing behavior details
     - Documented error handling
  7. clear_queue
     - Detailed queue clearing behavior
     - Added permanence warnings
     - Documented URL re-adding requirements

### Documentation Enhancement Phase 2
- Updated README.md
  - Removed add_documentation and queue_documentation tools
  - Updated tool descriptions to match handler-registry.ts
  - Added parameter format requirements
  - Enhanced usage guidance