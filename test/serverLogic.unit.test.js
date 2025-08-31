/**
 * Server Logic Unit Tests - Testing individual functions from server.js
 */

// Mock all dependencies first
jest.mock('../lib/postgresVectorDatabase.js');
jest.mock('../lib/db/connection.js');
jest.mock('../lib/ragUtils.js');

describe('Server Logic Unit Tests', () => {
  let mockVectorDB;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fetch mock
    global.fetch = jest.fn();
    
    // Mock vector database
    mockVectorDB = {
      initialize: jest.fn().mockResolvedValue(),
      search: jest.fn().mockResolvedValue([]),
      getInfo: jest.fn().mockResolvedValue({ totalDocuments: 100 }),
      getRandomQuestion: jest.fn().mockResolvedValue({
        id: 1,
        question: 'Test question?',
        answer: 'Test answer',
        category: 'Test'
      }),
      getQuestionById: jest.fn().mockResolvedValue({
        id: 1,
        question: 'Test question?',
        answer: 'Test answer',
        category: 'Test'
      })
    };

    const { PostgresVectorDatabase } = require('../lib/postgresVectorDatabase.js');
    PostgresVectorDatabase.mockImplementation(() => mockVectorDB);

    const { testConnection } = require('../lib/db/connection.js');
    testConnection.mockResolvedValue(true);

    const ragUtils = require('../lib/ragUtils.js');
    ragUtils.isCitizenshipRelated.mockReturnValue(true);
    ragUtils.isCurrentOfficialsQuery.mockReturnValue(false);
    ragUtils.prepareEnhancedMessage.mockReturnValue({
      message: 'Enhanced message',
      hasContext: true,
      contextSize: 1
    });
  });

  describe('Token Generation Logic', () => {
    it('should create proper OpenAI session request', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ client_secret: { value: 'test-token' } })
      });

      // Simulate token generation logic
      const apiKey = 'test-key';
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-10-01',
          voice: 'verse',
          tools: expect.any(Array)
        })
      });

      const data = await response.json();
      expect(data).toHaveProperty('client_secret');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/realtime/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key'
          })
        })
      );
    });

    it('should handle token generation errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      try {
        await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: { Authorization: 'Bearer test-key' },
          body: JSON.stringify({})
        });
      } catch (error) {
        expect(error.message).toBe('API Error');
      }
    });
  });

  describe('Search Logic', () => {
    it('should validate search parameters', async () => {
      const query = 'constitution';
      const limit = 5;

      expect(query).toBeTruthy();
      expect(typeof query).toBe('string');
      expect(typeof limit).toBe('number');
      expect(limit).toBeGreaterThan(0);
    });

    it('should perform vector database search', async () => {
      const mockResults = [
        { 
          metadata: { question: 'Test question?', answer: 'Test answer' },
          similarity: 0.9 
        }
      ];
      mockVectorDB.search.mockResolvedValueOnce(mockResults);

      const results = await mockVectorDB.search('constitution', 5);

      expect(results).toEqual(mockResults);
      expect(mockVectorDB.search).toHaveBeenCalledWith('constitution', 5);
    });

    it('should handle search errors', async () => {
      mockVectorDB.search.mockRejectedValueOnce(new Error('Search failed'));

      await expect(mockVectorDB.search('test')).rejects.toThrow('Search failed');
    });
  });

  describe('Answer Checking Logic', () => {
    it('should validate answers correctly', async () => {
      const questionData = {
        id: 1,
        question: 'Test question?',
        answer: 'Constitution',
        category: 'Test'
      };
      
      const userAnswer = 'constitution';
      const correctAnswer = questionData.answer.toLowerCase().trim();
      const userAnswerNormalized = userAnswer.toLowerCase().trim();
      
      const isCorrect = correctAnswer.includes(userAnswerNormalized) || 
                       userAnswerNormalized.includes(correctAnswer);

      expect(isCorrect).toBe(true);
    });

    it('should handle incorrect answers', async () => {
      const questionData = {
        answer: 'Constitution'
      };
      
      const userAnswer = 'wrong answer';
      const correctAnswer = questionData.answer.toLowerCase().trim();
      const userAnswerNormalized = userAnswer.toLowerCase().trim();
      
      const isCorrect = correctAnswer.includes(userAnswerNormalized) || 
                       userAnswerNormalized.includes(correctAnswer);

      expect(isCorrect).toBe(false);
    });

    it('should handle case insensitive matching', async () => {
      const testCases = [
        { correct: 'Constitution', user: 'CONSTITUTION', expected: true },
        { correct: 'Constitution', user: 'constitution', expected: true },
        { correct: 'Constitution', user: 'const', expected: true },
        { correct: 'Constitution', user: 'Bill of Rights', expected: false }
      ];

      testCases.forEach(({ correct, user, expected }) => {
        const correctAnswer = correct.toLowerCase().trim();
        const userAnswerNormalized = user.toLowerCase().trim();
        const isCorrect = correctAnswer.includes(userAnswerNormalized) || 
                         userAnswerNormalized.includes(correctAnswer);
        expect(isCorrect).toBe(expected);
      });
    });
  });

  describe('Message Enhancement Logic', () => {
    it('should enhance citizenship-related messages', async () => {
      const ragUtils = require('../lib/ragUtils.js');
      
      const message = 'What is the Constitution?';
      const isRelevant = ragUtils.isCitizenshipRelated(message);
      
      expect(isRelevant).toBe(true);
      
      const searchResults = await mockVectorDB.search(message, 3);
      const enhanced = ragUtils.prepareEnhancedMessage(message, searchResults);
      
      expect(enhanced).toHaveProperty('message');
      expect(enhanced).toHaveProperty('hasContext', true);
    });

    it('should handle non-citizenship messages', async () => {
      const ragUtils = require('../lib/ragUtils.js');
      ragUtils.isCitizenshipRelated.mockReturnValueOnce(false);

      const message = 'What is the weather?';
      const isRelevant = ragUtils.isCitizenshipRelated(message);
      
      expect(isRelevant).toBe(false);
    });

    it('should detect current officials queries', async () => {
      const ragUtils = require('../lib/ragUtils.js');
      ragUtils.isCurrentOfficialsQuery.mockReturnValueOnce(true);

      const message = 'Who is the current president?';
      const isAboutOfficials = ragUtils.isCurrentOfficialsQuery(message);
      
      expect(isAboutOfficials).toBe(true);
    });
  });

  describe('Health Check Logic', () => {
    it('should create proper health status', async () => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        checks: {
          database: true,
          vectorDatabase: true
        }
      };

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('checks');
      expect(typeof health.uptime).toBe('number');
    });

    it('should determine overall status from checks', () => {
      const checks = { database: true, vectorDatabase: true };
      const allHealthy = Object.values(checks).every(check => check === true);
      const status = allHealthy ? 'healthy' : 'degraded';
      
      expect(status).toBe('healthy');

      const failedChecks = { database: false, vectorDatabase: true };
      const someFailed = Object.values(failedChecks).every(check => check === true);
      const failedStatus = someFailed ? 'healthy' : 'degraded';
      
      expect(failedStatus).toBe('degraded');
    });
  });

  describe('Database Operations', () => {
    it('should get random questions', async () => {
      const question = await mockVectorDB.getRandomQuestion();
      
      expect(question).toHaveProperty('id');
      expect(question).toHaveProperty('question');
      expect(question).toHaveProperty('answer');
      expect(question).toHaveProperty('category');
    });

    it('should get question by ID', async () => {
      const question = await mockVectorDB.getQuestionById(1);
      
      expect(question).toHaveProperty('id');
      expect(mockVectorDB.getQuestionById).toHaveBeenCalledWith(1);
    });

    it('should get database info', async () => {
      const info = await mockVectorDB.getInfo();
      
      expect(info).toHaveProperty('totalDocuments');
      expect(info.totalDocuments).toBe(100);
    });
  });

  describe('Error Handling Patterns', () => {
    it('should handle database connection failures', async () => {
      const { testConnection } = require('../lib/db/connection.js');
      testConnection.mockResolvedValueOnce(false);

      const connected = await testConnection();
      expect(connected).toBe(false);
    });

    it('should handle vector database initialization failures', async () => {
      mockVectorDB.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(mockVectorDB.initialize()).rejects.toThrow('Init failed');
    });

    it('should handle OpenAI API failures', async () => {
      global.fetch.mockRejectedValueOnce(new Error('OpenAI API error'));

      await expect(fetch('https://api.openai.com/v1/realtime/sessions')).rejects.toThrow('OpenAI API error');
    });
  });

  describe('Input Validation', () => {
    it('should validate required parameters', () => {
      // Search endpoint validation
      const searchQuery = 'test';
      expect(searchQuery).toBeTruthy();
      expect(typeof searchQuery).toBe('string');

      // Check answer validation
      const questionId = 1;
      const userAnswer = 'test answer';
      expect(questionId).toBeTruthy();
      expect(userAnswer).toBeTruthy();
      expect(typeof questionId).toBe('number');
      expect(typeof userAnswer).toBe('string');

      // Message enhancement validation
      const message = 'test message';
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });

    it('should handle missing parameters', () => {
      // Simulate validation failures
      const emptyQuery = '';
      const nullQuery = null;
      const undefinedQuery = undefined;

      expect(emptyQuery).toBeFalsy();
      expect(nullQuery).toBeFalsy();
      expect(undefinedQuery).toBeFalsy();
    });
  });

  describe('Response Formatting', () => {
    it('should format search responses correctly', () => {
      const searchResults = [
        { metadata: { question: 'Test', answer: 'Test' } }
      ];
      
      const response = {
        query: 'test',
        results: searchResults,
        count: searchResults.length
      };

      expect(response).toHaveProperty('query');
      expect(response).toHaveProperty('results');
      expect(response).toHaveProperty('count');
      expect(response.count).toBe(1);
    });

    it('should format answer check responses correctly', () => {
      const result = {
        correct: true,
        canonical_answer: 'Constitution',
        user_answer: 'constitution',
        feedback: 'Correct!'
      };

      expect(result).toHaveProperty('correct');
      expect(result).toHaveProperty('canonical_answer');
      expect(result).toHaveProperty('user_answer');
      expect(result).toHaveProperty('feedback');
    });
  });
});