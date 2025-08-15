# PostgreSQL Migration Guide

This guide explains how to migrate from the JSON-based vector database to PostgreSQL with pg_vector extension.

## Prerequisites

1. **PostgreSQL with pg_vector**: Set up a PostgreSQL database with the pg_vector extension
2. **Environment Variables**: Configure DATABASE_URL in your .env file

## Migration Steps

### 1. Set up PostgreSQL Database

Create a PostgreSQL database and install the pg_vector extension:

```sql
-- Connect to your PostgreSQL server
CREATE DATABASE citizenship_db;

-- Connect to the new database
\c citizenship_db;

-- Install pg_vector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Configure Environment Variables

Update your `.env` file:

```bash
# Required
OPENAI_API_KEY="your-openai-api-key"

# For PostgreSQL migration
DATABASE_URL="postgresql://username:password@localhost:5432/citizenship_db"

# Optional: Force JSON database usage
# USE_POSTGRES=false
```

### 3. Generate and Run Migrations

Generate the database schema and run migrations:

```bash
# Generate migration files
npm run db:generate

# Apply migrations to create tables
npm run db:push
```

### 4. Migrate Data from JSON to PostgreSQL

Run the migration script to transfer all vector data:

```bash
# Make sure your JSON database has data first
node scripts/processDocuments.js

# Migrate data to PostgreSQL
node scripts/migrateToPostgres.js
```

### 5. Test the Migration

Start the application and verify PostgreSQL is being used:

```bash
npm run dev
```

You should see:
```
🐘 Using PostgreSQL vector database...
✅ PostgreSQL connected: PostgreSQL 15.x on...
✅ PostgreSQL vector database initialized
```

Test the search functionality:

```bash
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Who is the current president?", "limit": 2}'
```

## Database Management

### Drizzle Studio

Open the database management interface:

```bash
npm run db:studio
```

### Schema Changes

When modifying the database schema:

1. Update `lib/db/schema.js`
2. Generate migration: `npm run db:generate`
3. Apply changes: `npm run db:push`

### Rollback to JSON Database

To temporarily use the JSON database:

```bash
# Option 1: Remove DATABASE_URL from .env
# Option 2: Set USE_POSTGRES=false in .env
```

The application will automatically fall back to the JSON database.

## Production Deployment

### Azure PostgreSQL

For Azure App Service deployment:

1. **Create Azure Database for PostgreSQL Flexible Server**
2. **Install pg_vector extension** in Azure portal
3. **Set CONNECTION_STRING** in App Service environment variables
4. **Run migrations** using Azure CLI or during deployment

### Environment Variables in Production

```bash
DATABASE_URL="postgresql://user:password@server.postgres.database.azure.com:5432/citizenship_db?ssl=true"
OPENAI_API_KEY="your-production-key"
```

## Troubleshooting

### pg_vector Extension Missing

```sql
-- Install manually if automatic installation fails
CREATE EXTENSION IF NOT EXISTS vector;
```

### Connection Issues

1. Check DATABASE_URL format
2. Verify PostgreSQL server is running
3. Ensure database and user exist
4. Check firewall/security group settings

### Migration Fails

1. Ensure JSON database has data: `node scripts/processDocuments.js`
2. Check PostgreSQL connection
3. Verify pg_vector extension is installed
4. Check logs for specific error messages

## Performance Considerations

### Indexing

For large datasets, consider adding vector indexes:

```sql
-- Create HNSW index for faster similarity search
CREATE INDEX CONCURRENTLY civics_questions_embedding_idx 
ON civics_questions 
USING hnsw (embedding vector_cosine_ops);
```

### Connection Pooling

The application uses pg connection pooling by default. Adjust pool size in `lib/db/connection.js` if needed.

## Schema Overview

### Tables Created

1. **civics_questions** - USCIS questions with vector embeddings
2. **user_profiles** - User authentication (future feature)
3. **test_progress** - User progress tracking (future feature)
4. **search_queries** - Analytics and query logging

### Vector Operations

- **Embedding Dimensions**: 1536 (OpenAI text-embedding-3-small)
- **Similarity Metric**: Cosine distance
- **Search Method**: KNN with configurable result limits