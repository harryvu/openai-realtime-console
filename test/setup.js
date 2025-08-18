import '@testing-library/jest-dom';
import 'whatwg-fetch';

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

// Mock fetch globally
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({})
}));

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