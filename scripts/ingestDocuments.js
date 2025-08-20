import fs from 'fs';
import path from 'path';
import { PostgresVectorDatabase } from '../lib/postgresVectorDatabase.js';
import { testConnection } from '../lib/db/connection.js';
import { processUSCISDocuments } from './processDocuments.js';
import { db } from '../lib/db/connection.js';
import { civicsQuestions } from '../lib/db/schema.js';
import 'dotenv/config';

// Helper function to clear PostgreSQL database
async function clearDatabase(_vectorDB) {
  try {
    // Delete all records from civics_questions table
    await db.delete(civicsQuestions);
    console.log('🗑️ Cleared all records from civics_questions table');
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
}

async function ingestDocuments() {
  console.log('🚀 Starting document ingestion...');
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize PostgreSQL vector database  
    console.log('🐘 Initializing PostgreSQL vector database...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to PostgreSQL. Please check DATABASE_URL in .env file.');
    }
    
    const vectorDB = new PostgresVectorDatabase();
    await vectorDB.initialize();
    console.log('✅ PostgreSQL vector database initialized');

    // Check if documents are already processed
    const processedPath = path.join('./data', 'processed-questions.json');
    let questions;

    if (fs.existsSync(processedPath)) {
      console.log('📂 Loading existing processed questions...');
      questions = JSON.parse(fs.readFileSync(processedPath, 'utf8'));
    } else {
      console.log('🔄 Processing documents first...');
      questions = await processUSCISDocuments();
    }

    // Get current database info
    const dbInfo = vectorDB.getInfo();
    console.log(`📊 Current database has ${dbInfo.count} documents`);

    // Clear existing data to ensure fresh ingestion with current officials
    if (dbInfo.count > 0) {
      console.log('⚠️ Database already contains data. Clearing and re-ingesting with current officials...');
      
      // Clear the database by deleting all records
      console.log('🗑️ Clearing existing data...');
      await clearDatabase(vectorDB);
      console.log('✅ Database cleared');
    }

    // Ingest documents
    console.log(`📥 Ingesting ${questions.length} questions...`);
    await vectorDB.ingestDocuments(questions);

    // Verify ingestion
    const finalInfo = vectorDB.getInfo();
    console.log(`✅ Ingestion complete! Database now has ${finalInfo.count} documents`);

    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    const testQuery = 'What is the Constitution?';
    console.log(`Query: "${testQuery}"`);
    
    const searchResults = await vectorDB.search(testQuery, 3);
    console.log('\n📋 Search results:');
    
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. [Similarity: ${(result.similarity * 100).toFixed(1)}%]`);
      console.log(`   Question: ${result.metadata.question}`);
      console.log(`   Answer: ${result.metadata.answer}`);
      console.log(`   Category: ${result.metadata.category}`);
    });

    console.log('\n🎉 Document ingestion and testing complete!');
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestDocuments().catch(console.error);
}

export { ingestDocuments };