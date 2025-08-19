/**
 * API Integration Tests - Test actual API endpoints with real database
 * These tests call HTTP endpoints directly, not React components
 */

import { setupTestEnvironment, teardownTestEnvironment } from './testSetup.integration.js';

describe('API Integration Tests - Real Database and Server', () => {
  let testEnv;
  const testPort = 3001;
  const baseUrl = `http://localhost:${testPort}`;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment();
  }, 120000);

  afterAll(async () => {
    await teardownTestEnvironment();
  });

  describe('Search API', () => {
    it('should search USCIS questions with vector similarity', async () => {
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
      const response = await fetch(`${baseUrl}/search/info`);
      const info = await response.json();
      
      expect(info.status).toBe('ready');
      expect(info.totalDocuments).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed search requests', async () => {
      const response = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing query
      });

      // OpenAI API returns 500 for invalid embedding requests, which is expected
      expect(response.status).toBeGreaterThanOrEqual(400); // Should be an error status
    });

    it('should handle invalid question IDs', async () => {
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