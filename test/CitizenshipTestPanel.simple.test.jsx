import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import CitizenshipTestPanel from '../client/components/CitizenshipTestPanel.jsx';

// Simple test to debug the core functionality
describe('CitizenshipTestPanel - Debug', () => {
  const defaultProps = {
    isSessionActive: true,
    sendClientEvent: jest.fn(),
    events: [],
    sendTextMessage: jest.fn(),
    isPaused: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fetch with detailed logging
    global.fetch = jest.fn((url, options) => {
      console.log('FETCH CALLED:', url, options);
      
      if (url === '/search' && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => {
            console.log('RETURNING SEARCH RESULTS');
            return Promise.resolve({
              results: [{
                metadata: {
                  question: 'What is the supreme law of the land?',
                  answer: 'the Constitution',
                  category: 'Principles of Democracy',
                  question_id: 1
                },
                similarity: 0.95
              }]
            });
          }
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
      
      console.log('UNEXPECTED FETCH:', url);
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('should handle basic function call processing', async () => {
    const events = [
      {
        type: 'response.done',
        response: {
          output: [{
            type: 'function_call',
            name: 'request_practice_question',
            arguments: JSON.stringify({
              question: 'What is the supreme law of the land?'
            })
          }]
        }
      },
      { type: 'session.created' }
    ];

    await act(async () => {
      render(<CitizenshipTestPanel {...defaultProps} events={events} />);
    });

    // Wait for the async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Check if fetch was called
    expect(global.fetch).toHaveBeenCalledWith('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'What is the supreme law of the land?', limit: 1 })
    });

    // Wait for the question to appear
    await waitFor(() => {
      const questionElement = screen.queryByText('What is the supreme law of the land?');
      if (questionElement) {
        console.log('FOUND QUESTION ELEMENT');
      } else {
        console.log('QUESTION ELEMENT NOT FOUND, current HTML:', document.body.innerHTML);
      }
      expect(questionElement).toBeInTheDocument();
    }, { timeout: 10000 });
  });
});