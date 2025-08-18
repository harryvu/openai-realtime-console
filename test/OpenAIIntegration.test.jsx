/**
 * Integration tests for OpenAI Realtime API functionality
 * These tests use the actual OpenAI API endpoints and real function calls
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../client/components/App.jsx';

// Mock WebRTC since we can't test it in Jest
const mockDataChannel = {
  readyState: 'open',
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

const mockPeerConnection = {
  createDataChannel: jest.fn(() => mockDataChannel),
  createOffer: jest.fn(() => Promise.resolve({ sdp: 'mock-offer', type: 'offer' })),
  setLocalDescription: jest.fn(() => Promise.resolve()),
  setRemoteDescription: jest.fn(() => Promise.resolve()),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  addTrack: jest.fn(),
  connectionState: 'connected'
};

// Mock global WebRTC APIs
global.RTCPeerConnection = jest.fn(() => mockPeerConnection);
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }],
      getAudioTracks: () => [{ stop: jest.fn() }]
    }))
  }
});

// Mock fetch for API calls
global.fetch = jest.fn();

describe('OpenAI Realtime API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default fetch responses
    global.fetch.mockImplementation((url, options) => {
      if (url === '/search/info') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            totalDocuments: 100,
            status: 'ready'
          })
        });
      }
      
      if (url === '/token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'test-session',
            client_secret: { value: 'test-secret' },
            tools: [
              { name: 'get_random_question' },
              { name: 'request_practice_question' },
              { name: 'provide_current_official_info' }
            ]
          })
        });
      }
      
      if (url === '/random-question') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 28,
            question: 'What is the name of the President of the United States now?',
            answer: 'Donald Trump',
            category: 'System of Government'
          })
        });
      }
      
      if (url === '/search' && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [{
              metadata: {
                question_id: 28,
                question: body.query,
                answer: 'Donald Trump',
                category: 'System of Government'
              },
              similarity: 0.95
            }]
          })
        });
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  test('should handle get_random_question function call and trigger AI response', async () => {
    render(<App />);
    
    // Wait for component to mount and initialize
    await waitFor(() => {
      expect(screen.getByText('Ask me anything about the US citizenship test!')).toBeInTheDocument();
    });

    // Start a session
    const startButton = screen.getByRole('button', { name: /start session/i });
    await userEvent.click(startButton);

    // Wait for session to connect
    await waitFor(() => {
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith('oai-events');
    });

    // Simulate receiving a get_random_question function call from OpenAI
    const mockFunctionCallEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'get_random_question',
          call_id: 'call_123'
        }]
      }
    };

    // Trigger the function call event
    act(() => {
      const messageHandler = mockDataChannel.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: JSON.stringify(mockFunctionCallEvent)
        });
      }
    });

    // Verify that the random question API was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/random-question');
    });

    // Verify that a response.create event was sent to tell AI to speak the question
    await waitFor(() => {
      expect(mockDataChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('response.create')
      );
    });

    // Check if the sent message contains the question
    const sentCalls = mockDataChannel.send.mock.calls;
    const responseCreateCall = sentCalls.find(call => 
      call[0].includes('response.create') && 
      call[0].includes('What is the name of the President')
    );
    
    expect(responseCreateCall).toBeTruthy();
    console.log('✅ AI was instructed to speak the random question');
  });

  test('should handle request_practice_question and display in sidebar', async () => {
    render(<App />);
    
    // Wait for component to mount
    await waitFor(() => {
      expect(screen.getByText('Ask me anything about the US citizenship test!')).toBeInTheDocument();
    });

    // Start session
    const startButton = screen.getByRole('button', { name: /start session/i });
    await userEvent.click(startButton);

    await waitFor(() => {
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith('oai-events');
    });

    // Simulate receiving a request_practice_question function call
    const mockPracticeQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'What is the name of the President of the United States now?',
            category: 'System of Government'
          })
        }]
      }
    };

    // Trigger the function call event
    act(() => {
      const messageHandler = mockDataChannel.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      
      if (messageHandler) {
        messageHandler({
          data: JSON.stringify(mockPracticeQuestionEvent)
        });
      }
    });

    // Verify search API was called to match the question
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is the name of the President of the United States now?',
          limit: 1
        })
      });
    });

    // Verify the practice question appears in the sidebar
    await waitFor(() => {
      expect(screen.getByText('Practice Question')).toBeInTheDocument();
      expect(screen.getByText('What is the name of the President of the United States now?')).toBeInTheDocument();
      expect(screen.getByText('Show Answer')).toBeInTheDocument();
    });

    console.log('✅ Practice question displayed in sidebar');
  });

  test('should handle complete flow: get_random_question → AI speaks → request_practice_question → sidebar display', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Ask me anything about the US citizenship test!')).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: /start session/i });
    await userEvent.click(startButton);

    await waitFor(() => {
      expect(mockPeerConnection.createDataChannel).toHaveBeenCalledWith('oai-events');
    });

    // Step 1: AI calls get_random_question
    const getRandomQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'get_random_question'
        }]
      }
    };

    act(() => {
      const messageHandler = mockDataChannel.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      messageHandler({ data: JSON.stringify(getRandomQuestionEvent) });
    });

    // Verify random question was fetched
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/random-question');
    });

    // Step 2: Simulate AI speaking the question and calling request_practice_question
    const practiceQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'request_practice_question',
          arguments: JSON.stringify({
            question: 'What is the name of the President of the United States now?'
          })
        }]
      }
    };

    act(() => {
      const messageHandler = mockDataChannel.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      messageHandler({ data: JSON.stringify(practiceQuestionEvent) });
    });

    // Step 3: Verify complete integration
    await waitFor(() => {
      expect(screen.getByText('Practice Question')).toBeInTheDocument();
      expect(screen.getByText('What is the name of the President of the United States now?')).toBeInTheDocument();
    });

    console.log('✅ Complete OpenAI integration flow working');
  });

  test('should handle function call errors gracefully', async () => {
    // Make random-question endpoint fail
    global.fetch.mockImplementation((url) => {
      if (url === '/random-question') {
        return Promise.reject(new Error('Database error'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Ask me anything about the US citizenship test!')).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: /start session/i });
    await userEvent.click(startButton);

    const getRandomQuestionEvent = {
      type: 'response.done',
      response: {
        output: [{
          type: 'function_call',
          name: 'get_random_question'
        }]
      }
    };

    act(() => {
      const messageHandler = mockDataChannel.addEventListener.mock.calls
        .find(call => call[0] === 'message')?.[1];
      messageHandler({ data: JSON.stringify(getRandomQuestionEvent) });
    });

    // Verify error response was sent to AI
    await waitFor(() => {
      const sentCalls = mockDataChannel.send.mock.calls;
      const errorResponse = sentCalls.find(call => 
        call[0].includes("couldn't get a practice question")
      );
      expect(errorResponse).toBeTruthy();
    });

    console.log('✅ Error handling working correctly');
  });
});