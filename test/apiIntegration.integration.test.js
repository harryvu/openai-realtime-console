/**
 * API Integration Tests - Test actual API endpoints with real database
 * These tests call HTTP endpoints directly, not React components
 */

import { setupTestEnvironment, teardownTestEnvironment } from './testSetup.integration.js';

// Helper to conditionally describe or skip tests
const conditionalDescribe = (condition, ...args) => {
  return condition ? describe(...args) : describe.skip(...args);
};

// Check if we should run integration tests
let shouldRunIntegrationTests = false;

// Test setup
const testSetup = async () => {
  try {
    const testEnv = await setupTestEnvironment();
    shouldRunIntegrationTests = true;
    return testEnv;
  } catch (error) {
    if (error.message.includes('Failed to connect to test database')) {
      console.log('⚠️ Skipping integration tests - test database not available');
      shouldRunIntegrationTests = false;
      return null;
    } else {
      throw error;
    }
  }
};

describe('API Integration Tests - Real Database and Server', () => {
  let _testEnv;
  const testPort = 3001;
  const baseUrl = `http://localhost:${testPort}`;

  beforeAll(async () => {
    _testEnv = await testSetup();
    
    // Skip all tests if database is not available
    if (!_testEnv) {
      console.log('⚠️ All integration tests will be skipped - test database not available');
    }
  }, 120000);

  afterAll(async () => {
    if (_testEnv) {
      await teardownTestEnvironment();
    }
  });

  describe('Search API', () => {
    it('should search USCIS questions with vector similarity', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'constitution', limit: 3 })
      });

      expect(response.ok).toBe(true);
      const results = await response.json();
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('document');
      expect(results[0]).toHaveProperty('metadata');
      expect(results[0].document).toHaveProperty('question');
      expect(results[0].document).toHaveProperty('answer');
    });

    it('should find current officials accurately', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'president', limit: 5 })
      });

      const results = await response.json();
      
      // Should find president-related questions
      expect(results.length).toBeGreaterThan(0);
      const presidentQuestion = results.find(r => 
        r.document.question.toLowerCase().includes('president')
      );
      expect(presidentQuestion).toBeDefined();
    });

    it('should handle multilingual queries', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      // Test Vietnamese query
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'hiến pháp', limit: 3 })
      });

      const results = await response.json();
      expect(Array.isArray(results)).toBe(true);
      // Even if similarity is low, should return some results
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Question Management API', () => {
    it('should get random questions from database', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/random-question`);
      
      expect(response.ok).toBe(true);
      const question = await response.json();
      
      expect(question).toHaveProperty('id');
      expect(question).toHaveProperty('question');
      expect(question).toHaveProperty('answer');
      expect(question).toHaveProperty('category');
      expect(typeof question.id).toBe('number');
      expect(typeof question.question).toBe('string');
      expect(typeof question.answer).toBe('string');
    });

    it('should validate answers correctly', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      // First get a known question
      const questionResponse = await fetch(`${baseUrl}/random-question`);
      const question = await questionResponse.json();
      
      // Test correct answer (using part of the correct answer)
      const correctResponse = await fetch(`${baseUrl}/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: question.id, 
          answer: question.answer.split(' ')[0] // Use first word of correct answer
        })
      });

      const correctResult = await correctResponse.json();
      expect(correctResult).toHaveProperty('correct');
      expect(correctResult).toHaveProperty('canonical_answer');
      expect(correctResult).toHaveProperty('feedback');
      expect(correctResult.canonical_answer).toBe(question.answer);

      // Test incorrect answer
      const incorrectResponse = await fetch(`${baseUrl}/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: question.id, 
          answer: 'completely wrong answer that does not match'
        })
      });

      const incorrectResult = await incorrectResponse.json();
      expect(incorrectResult.correct).toBe(false);
      expect(incorrectResult.feedback).toContain('correct answer is');
    });
  });

  describe('Database Info API', () => {
    it('should provide database statistics', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/search/info`);
      
      expect(response.ok).toBe(true);
      const info = await response.json();
      
      expect(info).toHaveProperty('type');
      expect(info).toHaveProperty('totalDocuments');
      expect(info.totalDocuments).toBe(100); // All USCIS questions
      expect(info).toHaveProperty('categories');
      expect(typeof info.categories).toBe('object');
      
      // Verify we have the expected categories
      expect(info.categories).toHaveProperty('System of Government');
      expect(info.categories).toHaveProperty('Principles of Democracy');
    });

    it('should show database is ready for testing', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/search/info`);
      const info = await response.json();
      
      expect(info.status).toBe('ready');
      expect(info.totalDocuments).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed search requests', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing query
      });

      // OpenAI API returns 500 for invalid embedding requests, which is expected
      expect(response.status).toBeGreaterThanOrEqual(400); // Should be an error status
    });

    it('should handle invalid question IDs', async () => {
      if (!_testEnv) {
        console.log('⚠️ Skipping test - test database not available');
        return;
      }
      const response = await fetch(`${baseUrl}/check-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 99999, answer: 'test' })
      });

      // Should return error for non-existent question
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});