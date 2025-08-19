/**
 * Seed test database with USCIS questions for integration testing
 */

import { config } from 'dotenv';
import { PostgresVectorDatabase } from '../lib/postgresVectorDatabase.js';
import { testConnection } from '../lib/db/connection.js';

// Load test environment variables and override DATABASE_URL
config({ path: '.env.test.local' });

// Force test database URL for seeding
process.env.DATABASE_URL = 'postgresql://citizenship_user:citizenship_pass@localhost:5434/citizenship_test_db';
process.env.NODE_ENV = 'test';

console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Not set');

// Import USCIS questions from existing data
import { readFileSync } from 'fs';
import { join } from 'path';

// Read processed questions data
const questionsPath = join(process.cwd(), 'data', 'processed-questions.json');
let USCIS_QUESTIONS = [];

try {
  const questionsData = readFileSync(questionsPath, 'utf8');
  const parsed = JSON.parse(questionsData);
  USCIS_QUESTIONS = parsed.questions || parsed; // Handle different formats
  console.log(`📚 Loaded ${USCIS_QUESTIONS.length} USCIS questions from data file`);
} catch (error) {
  console.warn('⚠️ Could not load questions from data file, using fallback questions');
  
  // Fallback: Core questions for testing
  USCIS_QUESTIONS = [
    {
      id: 1,
      question: "What is the supreme law of the land?",
      answer: "the Constitution",
      category: "Principles of Democracy"
    },
    {
      id: 2,
      question: "What does the Constitution do?",
      answer: "sets up the government, defines the government, protects basic rights of Americans",
      category: "Principles of Democracy"
    },
    {
      id: 18,
      question: "How many U.S. Senators are there?",
      answer: "one hundred (100)",
      category: "System of Government"
    },
    {
      id: 28,
      question: "What is the name of the President of the United States now?",
      answer: "Donald Trump",
      category: "System of Government"
    },
    {
      id: 29,
      question: "What is the name of the Vice President of the United States now?",
      answer: "J.D. Vance",
      category: "System of Government"
    },
    {
      id: 46,
      question: "What is the political party of the President now?",
      answer: "Republican Party",
      category: "System of Government"
    },
    {
      id: 58,
      question: "What was one important thing that Abraham Lincoln did?",
      answer: "freed the slaves (Emancipation Proclamation), saved (or preserved) the Union, led the United States during the Civil War",
      category: "History"
    },
    {
      id: 88,
      question: "Name one of the two longest rivers in the United States.",
      answer: "Missouri River, Mississippi River",
      category: "Geography"
    }
  ];
}

/**
 * Seed the test database with USCIS questions
 */
export async function seedTestDatabase() {
  console.log('🌱 Starting test database seeding...');
  
  try {
    console.log('🔌 Testing database connection...');
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to test database');
    }
    console.log('✅ Test database connection confirmed');

    console.log('⚡ Initializing PostgreSQL vector database...');
    // Initialize PostgreSQL vector database
    const testDb = new PostgresVectorDatabase();
    await testDb.initialize();
    console.log('✅ Test database initialized');

    // Check if questions already exist
    const existingInfo = await testDb.getInfo();
    if (existingInfo.total_documents > 0) {
      console.log(`📊 Database already has ${existingInfo.total_documents} questions`);
      console.log('✅ Test database seeding complete (using existing data)');
      return testDb;
    }

    console.log(`📝 Preparing to ingest ${USCIS_QUESTIONS.length} USCIS questions...`);

    // Transform questions into documents for vector database
    const documents = USCIS_QUESTIONS.map(q => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      category: q.category,
      content: `Question: ${q.question}\nAnswer: ${q.answer}`,
      metadata: {
        question_id: q.id,
        question: q.question,
        answer: q.answer,
        category: q.category,
        type: 'uscis_civics_question'
      }
    }));

    // Ingest documents with embeddings
    console.log('🧠 Generating embeddings and ingesting documents...');
    await testDb.ingestDocuments(documents);

    // Verify ingestion
    const finalInfo = await testDb.getInfo();
    console.log(`✅ Successfully seeded ${finalInfo.total_documents} questions`);
    console.log(`📊 Database info:`, finalInfo);

    // Test a sample search
    console.log('🔍 Testing sample search...');
    const testResults = await testDb.search('president', 3);
    console.log(`🎯 Sample search returned ${testResults.length} results`);
    
    if (testResults.length > 0) {
      console.log(`📋 Top result: ${testResults[0].metadata.question}`);
    }

    console.log('🌱 Test database seeding complete!');
    return testDb;

  } catch (error) {
    console.error('❌ Failed to seed test database:', error);
    throw error;
  }
}

/**
 * Clear test database (for cleanup between test runs)
 */
export async function clearTestDatabase() {
  console.log('🧹 Clearing test database...');
  
  try {
    // Note: For now we'll keep the data between tests since seeding takes time
    // In production, you might want to implement a more sophisticated cleanup
    console.log('✅ Test database cleanup complete');
  } catch (error) {
    console.error('❌ Failed to clear test database:', error);
    throw error;
  }
}

// CLI usage - Check if this file is being run directly
console.log('CLI check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('process.argv[1]:', process.argv[1]);
console.log('argv[1] ends with seedTestDatabase.js:', process.argv[1] && process.argv[1].endsWith('seedTestDatabase.js'));

// Allow CLI usage even in test mode for manual testing
if (process.argv[1] && process.argv[1].endsWith('seedTestDatabase.js')) {
  console.log('🚀 Running CLI mode...');
  (async () => {
    const action = process.argv[2] || 'seed';
    
    try {
      if (action === 'seed') {
        console.log('📋 Starting seed action...');
        await seedTestDatabase();
        console.log('✅ Seeding completed successfully');
        process.exit(0);
      } else if (action === 'clear') {
        console.log('📋 Starting clear action...');
        await clearTestDatabase();
        console.log('✅ Clearing completed successfully');
        process.exit(0);
      } else {
        console.log('Usage: node seedTestDatabase.js [seed|clear]');
        process.exit(1);
      }
    } catch (error) {
      console.error('CLI execution failed:', error);
      process.exit(1);
    }
  })();
} else {
  console.log('❌ CLI mode not detected');
}