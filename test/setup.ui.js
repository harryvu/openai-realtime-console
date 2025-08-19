// UI test setup - uses CommonJS syntax for compatibility
require('@testing-library/jest-dom');
require('whatwg-fetch');

// Add Node.js globals that are needed for PostgreSQL and other Node modules
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock console methods to reduce test noise
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
};

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock WebRTC APIs
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createDataChannel: jest.fn(() => ({
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn()
  })),
  createOffer: jest.fn(() => Promise.resolve({ sdp: 'test-offer' })),
  setLocalDescription: jest.fn(() => Promise.resolve()),
  setRemoteDescription: jest.fn(() => Promise.resolve()),
  addTrack: jest.fn(),
  getSenders: jest.fn(() => []),
  close: jest.fn(),
  ontrack: null
}));

global.MediaStream = jest.fn();
global.MediaStreamTrack = jest.fn();

// Mock getUserMedia
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }]
    }))
  },
  configurable: true
});

// Mock Audio element
global.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  autoplay: false,
  srcObject: null
}));

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: jest.fn(() => 'test-uuid')
};

// Mock fetch globally with comprehensive API responses
global.fetch = jest.fn((url) => {
  // Mock user authentication endpoint
  if (url.includes('/api/user')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ user: null, authenticated: false })
    });
  }
  
  // Mock search endpoint
  if (url.includes('/search')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        {
          document: { question: "What is the supreme law of the land?", answer: "the Constitution" },
          metadata: { question_id: 1, category: "Principles of Democracy" },
          similarity: 0.95
        }
      ])
    });
  }
  
  // Mock random question endpoint
  if (url.includes('/random-question')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 1,
        question: "What is the supreme law of the land?",
        category: "Principles of Democracy"
      })
    });
  }
  
  // Mock check answer endpoint
  if (url.includes('/check-answer')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        correct: true,
        canonical_answer: "the Constitution",
        feedback: "Correct!"
      })
    });
  }
  
  // Mock database info endpoint
  if (url.includes('/search/info')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        total_documents: 100,
        status: 'ready',
        categories: { 'Principles of Democracy': 12, 'System of Government': 35 }
      })
    });
  }
  
  // Default mock response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});

// Console warnings/errors that are expected in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is deprecated') ||
       args[0].includes('Warning: React.createFactory is deprecated'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('componentWillReceiveProps has been renamed')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});

// Clean up any timers
afterEach(() => {
  if (jest.isMockFunction(setTimeout)) {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  }
});