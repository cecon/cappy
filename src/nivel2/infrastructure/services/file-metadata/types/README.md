# File Metadata Types

This folder contains TypeScript type definitions for the File Metadata module.

## Files

### `repository.ts`
Contains types related to repository operations:

- **`PaginationOptions`**: Options for paginated queries
  - `page`: Current page number
  - `limit`: Items per page
  - `status`: Optional status filter
  - `sortBy`: Sort field (id, created_at, updated_at)
  - `sortOrder`: Sort order (asc, desc)

- **`PaginatedResult`**: Result of a paginated query
  - `files`: Array of file metadata
  - `total`: Total number of files
  - `page`: Current page
  - `limit`: Items per page
  - `totalPages`: Total number of pages

- **`SQLiteFileRow`**: Raw SQLite row structure for file metadata
  - Maps database column names to TypeScript types
  - Uses snake_case as returned by SQLite

- **`SQLiteCountRow`**: SQLite count result
  - `total`: Count result

- **`SQLiteStatsRow`**: SQLite status statistics row
  - `status`: Status name
  - `count`: Number of files with that status

- **`SQLiteAggregatedStatsRow`**: SQLite aggregated statistics
  - Contains counts for all status types

## Usage

```typescript
import type { PaginationOptions, PaginatedResult } from './types';

// Use in function signatures
async function getFiles(options: PaginationOptions): Promise<PaginatedResult> {
  // Implementation
}
```

## Benefits

- **Type Safety**: Ensures correct data types at compile time
- **Documentation**: Self-documenting through TypeScript types
- **IDE Support**: Better autocomplete and IntelliSense
- **Maintainability**: Centralized type definitions
