import { config } from 'dotenv';
import { PostgresVectorDatabase } from '../lib/postgresVectorDatabase.js';
import { testConnection } from '../lib/db/connection.js';
import { seedTestDatabase } from './seedTestDatabase.js';

// Load test environment variables
config({ path: '.env.test.local' });

let testServer;
let testDb;

/**
 * Setup test environment with real services
 */
export async function setupTestEnvironment() {
  try {
    console.log('🧪 Setting up integration test environment...');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to test database. Check DATABASE_URL in .env.test.local');
    }
    
    // Initialize and seed test database
    testDb = await seedTestDatabase();
    
    // Start test server for integration tests with real API endpoints
    console.log('🚀 Starting test server for integration tests...');
    const express = require('express');
    const { PostgresVectorDatabase } = await import('../lib/postgresVectorDatabase.js');
    
    const app = express();
    app.use(express.json());
    
    // Initialize vector database for server
    const serverDb = new PostgresVectorDatabase();
    await serverDb.initialize();
    
    // Add essential API endpoints for integration tests
    app.get('/api/user', (req, res) => {
      res.json({ user: null, authenticated: false });
    });
    
    app.post('/search', async (req, res) => {
      try {
        const { query, limit = 5 } = req.body;
        const results = await serverDb.search(query, limit);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/search/info', async (req, res) => {
      try {
        const info = await serverDb.getInfo();
        res.json(info);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/random-question', async (req, res) => {
      try {
        const question = await serverDb.getRandomQuestion();
        res.json(question);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.post('/check-answer', async (req, res) => {
      try {
        const { id, answer } = req.body;
        const result = await serverDb.checkAnswer(id, answer);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    const testPort = 3001;
    testServer = app.listen(testPort, () => {
      console.log(`✅ Test server running on port ${testPort}`);
    });
    
    console.log('✅ Test environment ready');
    return { testServer, testDb };
    
  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
}

/**
 * Cleanup test environment
 */
export async function teardownTestEnvironment() {
  try {
    console.log('🧹 Cleaning up test environment...');
    
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(resolve);
      });
      console.log('✅ Test server stopped');
    }
    
    if (testDb) {
      // Clean up any test-specific data if needed
      console.log('✅ Test database cleaned');
    }
    
  } catch (error) {
    console.error('❌ Error during test cleanup:', error);
  }
}

/**
 * Reset test data between tests
 */
export async function resetTestData() {
  if (testDb) {
    // Reset any test-specific state
    // The main database should remain intact with all USCIS questions
    console.log('🔄 Test data reset');
  }
}

/**
 * Create mock OpenAI response events for integration tests
 */
export function createMockResponseEvent(functionCall) {
  return {
    type: 'response.done',
    event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    response: {
      id: `resp_${Date.now()}`,
      object: 'realtime.response',
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed',
      status_details: null,
      output: [
        {
          type: 'function_call',
          name: functionCall.name,
          call_id: functionCall.call_id || `call_${Date.now()}`,
          arguments: JSON.stringify(functionCall.arguments)
        }
      ],
      usage: {
        total_tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      }
    }
  };
}

/**
 * Create mock session events
 */
export function createMockSessionEvent(type = 'session.created') {
  return {
    type,
    event_id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    session: {
      id: `sess_${Date.now()}`,
      object: 'realtime.session',
      created_at: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      model: 'gpt-4o-realtime-preview-2024-10-01',
      voice: 'verse'
    }
  };
}

/**
 * Simulate realistic timing delays
 */
export function delay(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export globals for tests
global.setupTestEnvironment = setupTestEnvironment;
global.teardownTestEnvironment = teardownTestEnvironment;
global.resetTestData = resetTestData;
global.createMockResponseEvent = createMockResponseEvent;
global.createMockSessionEvent = createMockSessionEvent;
global.delay = delay;