
import { render, waitFor } from '@testing-library/react';
import App from '../client/components/App.jsx';

// Mock the AuthContext
jest.mock('../client/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
    logout: jest.fn()
  })
}));

// Test the complete App pause/resume flow
describe('App Component Pause/Resume with Practice Questions', () => {
  let _mockStartSession, _mockPauseSession, _mockResumeSession;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock all the WebRTC and fetch calls
    global.fetch = jest.fn((url) => {
      if (url === '/token') {
        return Promise.resolve({
          json: () => Promise.resolve({
            client_secret: { value: 'test-token' }
          })
        });
      }
      if (url === '/api/user') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            user: { id: 'test-user', email: 'test@example.com' }
          })
        });
      }
      if (url === '/search') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{
              metadata: {
                question: 'What is the supreme law of the land?',
                answer: 'the Constitution',
                category: 'Principles of Democracy',
                question_id: 1
              },
              similarity: 0.95
            }]
          })
        });
      }
      if (url === '/search/info') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            count: 100,
            embedding_model: 'text-embedding-3-small'
          })
        });
      }
      if (url === '/enhance-message') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            enhancedMessage: 'Test enhanced message',
            hasContext: true
          })
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    // Mock WebRTC
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

    // Mock navigator.mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn(() => Promise.resolve({
          getTracks: () => [{ stop: jest.fn() }]
        }))
      },
      configurable: true
    });
  });

  it('should debug the actual App pause/resume behavior with CitizenshipTestPanel', async () => {
    // This test will help us understand what happens in the real App
    const { container } = render(<App />);
    
    console.log('=== TEST: App component rendered ===');
    
    // Since App has authentication, we might need to mock that too
    // For now, let's just check what gets rendered
    await waitFor(() => {
      // Look for any content that indicates the app loaded
      const body = container.innerHTML;
      console.log('App HTML:', body.substring(0, 500) + '...');
    });
  });
});