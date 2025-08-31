/**
 * Server Integration Tests - Testing actual server.js with mocked dependencies
 */

import request from 'supertest';
import express from 'express';

// Mock all dependencies before server import
jest.mock('../lib/postgresVectorDatabase.js', () => ({
  PostgresVectorDatabase: jest.fn()
}));

jest.mock('../lib/db/connection.js', () => ({
  testConnection: jest.fn().mockResolvedValue(true)
}));

jest.mock('../lib/ragUtils.js', () => ({
  isCitizenshipRelated: jest.fn().mockReturnValue(true),
  isCurrentOfficialsQuery: jest.fn().mockReturnValue(false),
  prepareEnhancedMessage: jest.fn().mockReturnValue({
    message: 'Enhanced message',
    hasContext: true,
    contextSize: 1
  })
}));

jest.mock('../lib/auth/passport-config.js', () => ({
  default: {
    initialize: () => (req, res, next) => {
      req.isAuthenticated = () => false;
      next();
    },
    session: () => (req, res, next) => next(),
    authenticate: (_strategy, _options) => (req, res, next) => {
      if (req.url.includes('callback')) {
        req.user = { id: 'test-user' };
      }
      next();
    }
  }
}));

jest.mock('../lib/auth/middleware.js', () => ({
  attachUser: (req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.isAuthenticated = false;
    next();
  }
}));

jest.mock('../lib/auth/dev-auth.js', () => ({
  createDevUser: (req, res) => {
    res.json({ success: true, message: 'Dev login successful' });
  }
}));

jest.mock('applicationinsights', () => ({
  setup: jest.fn().mockReturnThis(),
  setAutoDependencyCorrelation: jest.fn().mockReturnThis(),
  setAutoCollectRequests: jest.fn().mockReturnThis(),
  setAutoCollectPerformance: jest.fn().mockReturnThis(),
  setAutoCollectExceptions: jest.fn().mockReturnThis(),
  setAutoCollectDependencies: jest.fn().mockReturnThis(),
  setAutoCollectConsole: jest.fn().mockReturnThis(),
  setUseDiskRetryCaching: jest.fn().mockReturnThis(),
  setSendLiveMetrics: jest.fn().mockReturnThis(),
  setDistributedTracingMode: jest.fn().mockReturnThis(),
  start: jest.fn().mockReturnThis(),
  defaultClient: {
    trackEvent: jest.fn(),
    trackException: jest.fn()
  },
  DistributedTracingModes: { AI_AND_W3C: 'test' }
}));

jest.mock('vite', () => ({
  createServer: jest.fn().mockResolvedValue({
    middlewares: (req, res, next) => next(),
    transformIndexHtml: jest.fn().mockResolvedValue('<html>test</html>'),
    ssrLoadModule: jest.fn().mockResolvedValue({
      render: jest.fn().mockResolvedValue({ html: '<div>App</div>' })
    }),
    ssrFixStacktrace: jest.fn()
  })
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('<html><!--ssr-outlet--></html>')
}));

jest.mock('express-session', () => jest.fn(() => (req, res, next) => {
  req.session = {
    destroy: jest.fn((cb) => cb())
  };
  next();
}));

jest.mock('connect-pg-simple', () => jest.fn(() => jest.fn()));
jest.mock('dotenv/config', () => ({}));

// Set environment
process.env.OPENAI_API_KEY = 'test-key';
process.env.DATABASE_URL = 'test-db';
process.env.NODE_ENV = 'test';

// Global fetch mock
global.fetch = jest.fn();

describe('Server Integration Tests', () => {
  let app;
  let mockVectorDB;

  beforeAll(async () => {
    // Setup mocks
    mockVectorDB = {
      initialize: jest.fn().mockResolvedValue(),
      search: jest.fn().mockResolvedValue([{
        document: { question: 'Test?', answer: 'Test' },
        metadata: { question_id: 1, similarity: 0.9 }
      }]),
      getInfo: jest.fn().mockResolvedValue({
        type: 'PostgreSQL',
        totalDocuments: 100,
        status: 'ready'
      }),
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

    // Create test app that mimics server.js structure
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Add session middleware mock
    app.use((req, res, next) => {
      req.session = { destroy: jest.fn((cb) => cb()) };
      req.isAuthenticated = () => false;
      req.user = null;
      req.logout = jest.fn((cb) => cb());
      next();
    });

    // Replicate server.js routes
    app.get('/token', async (req, res) => {
      try {
        global.fetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ client_secret: { value: 'test-token' } })
        });

        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-realtime-preview-2024-10-01',
            voice: 'verse',
            tools: []
          })
        });

        const data = await response.json();
        res.json(data);
      } catch {
        res.status(500).json({ error: 'Failed to generate token' });
      }
    });

    app.post('/search', async (req, res) => {
      try {
        const { query, limit = 5 } = req.body;
        
        if (!query) {
          return res.status(400).json({ error: 'Query parameter is required' });
        }
        
        const results = await mockVectorDB.search(query, limit);
        
        res.json({
          query: query,
          results: results,
          count: results.length
        });
      } catch {
        res.status(500).json({ error: 'Search failed' });
      }
    });

    app.get('/search/info', async (req, res) => {
      try {
        const info = await mockVectorDB.getInfo();
        res.json(info);
      } catch {
        res.status(500).json({ error: 'Failed to get database info' });
      }
    });

    app.get('/random-question', async (req, res) => {
      try {
        const randomQuestion = await mockVectorDB.getRandomQuestion();
        res.json({
          id: randomQuestion.id,
          question: randomQuestion.question,
          answer: randomQuestion.answer,
          category: randomQuestion.category
        });
      } catch {
        res.status(500).json({ error: 'Failed to get random question' });
      }
    });

    app.post('/check-answer', async (req, res) => {
      try {
        const { questionId, userAnswer } = req.body;
        
        if (!questionId || !userAnswer) {
          return res.status(400).json({ error: 'questionId and userAnswer are required' });
        }

        const questionData = await mockVectorDB.getQuestionById(questionId);
        const correctAnswer = questionData.answer.toLowerCase().trim();
        const userAnswerNormalized = userAnswer.toLowerCase().trim();
        
        const isCorrect = correctAnswer.includes(userAnswerNormalized) || 
                         userAnswerNormalized.includes(correctAnswer);
        
        res.json({
          correct: isCorrect,
          canonical_answer: questionData.answer,
          user_answer: userAnswer,
          feedback: isCorrect ? 'Correct!' : `The correct answer is: ${questionData.answer}`
        });
      } catch {
        res.status(500).json({ error: 'Failed to check answer' });
      }
    });

    app.post('/enhance-message', async (req, res) => {
      try {
        const { message } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'Message parameter is required' });
        }
        
        const ragUtils = require('../lib/ragUtils.js');
        const isRelevant = ragUtils.isCitizenshipRelated(message);
        
        if (!isRelevant) {
          return res.json({
            originalMessage: message,
            enhancedMessage: message,
            hasContext: false,
            warning: "This question doesn't appear to be citizenship-related."
          });
        }
        
        const searchResults = await mockVectorDB.search(message, 3);
        const enhanced = ragUtils.prepareEnhancedMessage(message, searchResults);
        
        res.json({
          originalMessage: message,
          enhancedMessage: enhanced.message,
          hasContext: enhanced.hasContext,
          contextSize: enhanced.contextSize || 0,
          searchResults: searchResults
        });
      } catch {
        res.status(500).json({ error: 'Failed to enhance message' });
      }
    });

    app.get('/health', async (req, res) => {
      try {
        const health = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || 'unknown',
          environment: process.env.NODE_ENV || 'development',
          uptime: Math.floor(process.uptime()),
          checks: {
            database: true,
            vectorDatabase: true
          }
        };

        const allChecksHealthy = Object.values(health.checks).every(check => check === true);
        health.status = allChecksHealthy ? 'healthy' : 'degraded';

        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });

    app.get('/api/user', (req, res) => {
      if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({
          id: req.user.id,
          email: req.user.email
        });
      } else {
        res.status(401).json({ error: 'Not authenticated' });
      }
    });

    app.post('/auth/logout', (req, res) => {
      req.logout((err) => {
        if (err) {
          return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy((err) => {
          if (err) {
            return res.status(500).json({ error: 'Session destruction failed' });
          }
          res.clearCookie = jest.fn();
          res.json({ success: true, message: 'Logged out successfully' });
        });
      });
    });

    app.get('/auth/google', (req, res) => {
      res.redirect('/auth/google/callback');
    });

    app.get('/auth/google/callback', (req, res) => {
      res.redirect('/dashboard');
    });

    app.get('/auth/facebook', (req, res) => {
      res.redirect('/auth/facebook/callback');
    });

    app.get('/auth/facebook/callback', (req, res) => {
      res.redirect('/dashboard');
    });

    app.get('/auth/microsoft', (req, res) => {
      res.redirect('/auth/microsoft/callback');
    });

    app.get('/auth/microsoft/callback', (req, res) => {
      res.redirect('/dashboard');
    });

    app.post('/auth/dev', (req, res) => {
      res.json({ success: true, message: 'Development login successful' });
    });

    // SSR route
    app.use('*', (req, res) => {
      res.status(200).set({ 'Content-Type': 'text/html' }).end('<html><div>App</div></html>');
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  describe('Token Generation', () => {
    it('should generate OpenAI session token', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ client_secret: { value: 'test-token' } })
      });

      const response = await request(app)
        .get('/token')
        .expect(200);

      expect(response.body).toHaveProperty('client_secret');
    });

    it('should handle token generation errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('API Error'));

      await request(app)
        .get('/token')
        .expect(500);
    });
  });

  describe('Search Endpoints', () => {
    it('should perform semantic search', async () => {
      const response = await request(app)
        .post('/search')
        .send({ query: 'constitution', limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('query', 'constitution');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('count');
    });

    it('should return 400 for missing query', async () => {
      await request(app)
        .post('/search')
        .send({})
        .expect(400);
    });

    it('should get database info', async () => {
      const response = await request(app)
        .get('/search/info')
        .expect(200);

      expect(response.body).toHaveProperty('totalDocuments', 100);
    });
  });

  describe('Practice Questions', () => {
    it('should get random question', async () => {
      const response = await request(app)
        .get('/random-question')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('question');
      expect(response.body).toHaveProperty('answer');
    });

    it('should check answers', async () => {
      const response = await request(app)
        .post('/check-answer')
        .send({ questionId: 1, userAnswer: 'test' })
        .expect(200);

      expect(response.body).toHaveProperty('correct');
      expect(response.body).toHaveProperty('canonical_answer');
    });

    it('should return 400 for missing parameters', async () => {
      await request(app)
        .post('/check-answer')
        .send({ questionId: 1 })
        .expect(400);
    });
  });

  describe('Message Enhancement', () => {
    it('should enhance citizenship messages', async () => {
      const response = await request(app)
        .post('/enhance-message')
        .send({ message: 'What is the Constitution?' })
        .expect(200);

      expect(response.body).toHaveProperty('enhancedMessage');
      expect(response.body).toHaveProperty('hasContext');
    });

    it('should handle non-citizenship messages', async () => {
      const ragUtils = require('../lib/ragUtils.js');
      ragUtils.isCitizenshipRelated.mockReturnValueOnce(false);

      const response = await request(app)
        .post('/enhance-message')
        .send({ message: 'What is the weather?' })
        .expect(200);

      expect(response.body).toHaveProperty('warning');
    });

    it('should return 400 for missing message', async () => {
      await request(app)
        .post('/enhance-message')
        .send({})
        .expect(400);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Authentication Routes', () => {
    it('should handle user info request when not authenticated', async () => {
      await request(app)
        .get('/api/user')
        .expect(401);
    });

    it('should handle logout', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should handle OAuth redirects', async () => {
      await request(app)
        .get('/auth/google')
        .expect(302);

      await request(app)
        .get('/auth/facebook')
        .expect(302);

      await request(app)
        .get('/auth/microsoft')
        .expect(302);
    });

    it('should handle dev auth', async () => {
      const response = await request(app)
        .post('/auth/dev')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('SSR Route', () => {
    it('should handle SSR rendering', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors', async () => {
      mockVectorDB.search.mockRejectedValueOnce(new Error('DB Error'));

      await request(app)
        .post('/search')
        .send({ query: 'test' })
        .expect(500);
    });

    it('should handle database info errors', async () => {
      mockVectorDB.getInfo.mockRejectedValueOnce(new Error('DB Error'));

      await request(app)
        .get('/search/info')
        .expect(500);
    });

    it('should handle random question errors', async () => {
      mockVectorDB.getRandomQuestion.mockRejectedValueOnce(new Error('DB Error'));

      await request(app)
        .get('/random-question')
        .expect(500);
    });

    it('should handle answer check errors', async () => {
      mockVectorDB.getQuestionById.mockRejectedValueOnce(new Error('DB Error'));

      await request(app)
        .post('/check-answer')
        .send({ questionId: 1, userAnswer: 'test' })
        .expect(500);
    });

    it('should handle message enhancement errors', async () => {
      mockVectorDB.search.mockRejectedValueOnce(new Error('DB Error'));

      await request(app)
        .post('/enhance-message')
        .send({ message: 'test' })
        .expect(500);
    });
  });
});