import fs from 'fs';
import path from 'path';
import { SimpleVectorDatabase } from '../lib/simpleVectorDatabase.js';
import { processUSCISDocuments } from './processDocuments.js';
import 'dotenv/config';

async function ingestDocuments() {
  console.log('🚀 Starting document ingestion...');
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize vector database
    const vectorDB = new SimpleVectorDatabase();
    await vectorDB.initialize();

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

    // Ask user if they want to clear existing data
    if (dbInfo.count > 0) {
      console.log('⚠️ Database already contains data. Clearing and re-ingesting...');
      vectorDB.clear();
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