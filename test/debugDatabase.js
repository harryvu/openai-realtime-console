/**
 * Debug script to check database state and initialize if needed
 */

import { config } from 'dotenv';
import pkg from 'pg';
import { db } from '../lib/db/connection.js';
import { sql } from 'drizzle-orm';

const { Pool } = pkg;

// Load test environment variables
config({ path: '.env.test.local' });

// Use test database URL directly
const testDbUrl = 'postgresql://citizenship_user:citizenship_pass@localhost:5434/citizenship_test_db';
console.log('Using database URL:', testDbUrl);

// Create direct connection for debugging
const pool = new Pool({
  connectionString: testDbUrl,
  ssl: false,
});

async function debugDatabase() {
  console.log('🔍 Starting database debug...');
  
  try {
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Connected to test database');
    
    // Check PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', versionResult.rows[0].version);
    
    // Check if pgvector extension exists
    const extensionResult = await client.query(`
      SELECT name, default_version, installed_version 
      FROM pg_available_extensions 
      WHERE name = 'vector'
    `);
    
    if (extensionResult.rows.length > 0) {
      console.log('✅ pgvector extension available:', extensionResult.rows[0]);
      
      // Check if extension is installed
      const installedResult = await client.query(`
        SELECT * FROM pg_extension WHERE extname = 'vector'
      `);
      
      if (installedResult.rows.length > 0) {
        console.log('✅ pgvector extension is installed');
      } else {
        console.log('⚠️ pgvector extension not installed, installing...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ pgvector extension installed');
      }
    } else {
      console.error('❌ pgvector extension not available in this PostgreSQL installation');
    }
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'civics_questions'
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('✅ civics_questions table exists');
      
      // Check table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'civics_questions'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Table structure:', columnsResult.rows);
      
      // Check record count
      const countResult = await client.query('SELECT COUNT(*) FROM civics_questions');
      console.log('📊 Records in table:', countResult.rows[0].count);
      
    } else {
      console.log('⚠️ civics_questions table does not exist');
      console.log('🔧 Running migration...');
      
      // Create table manually for debugging
      await client.query(`
        CREATE TABLE IF NOT EXISTS civics_questions (
          id SERIAL PRIMARY KEY,
          question_id INTEGER NOT NULL UNIQUE,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          category TEXT NOT NULL,
          embedding vector(1536),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      
      console.log('✅ civics_questions table created');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database debug failed:', error);
  } finally {
    await pool.end();
  }
}

// Run debug
debugDatabase();