-- Initialize pg_vector extension for the citizenship database
-- This script runs automatically when the container starts for the first time

\c citizenship_db;

-- Create the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Log successful initialization
\echo 'pg_vector extension initialized successfully';