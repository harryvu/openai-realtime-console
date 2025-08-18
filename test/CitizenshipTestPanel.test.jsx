import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CitizenshipTestPanel from '../client/components/CitizenshipTestPanel.jsx';

// Mock fetch globally
global.fetch = jest.fn();

describe('CitizenshipTestPanel', () => {
  const defaultProps = {
    isSessionActive: true,
    sendClientEvent: jest.fn(),
    events: [],
    sendTextMessage: jest.fn(),
    isPaused: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('renders without crashing', () => {
      render(<CitizenshipTestPanel {...defaultProps} />);
      expect(screen.getByText('Ask me anything about the US citizenship test!')).toBeInTheDocument();
    });

    it('shows inactive state when session is not active', () => {
      render(<CitizenshipTestPanel {...defaultProps} isSessionActive={false} />);
      expect(screen.getByText('Start the session to begin practicing for your citizenship test')).toBeInTheDocument();
    });

    it('renders search input when session is active', () => {
      render(<CitizenshipTestPanel {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search citizenship topics...')).toBeInTheDocument();
    });
  });

  describe('Function Management (Server-Side)', () => {
    it('marks functions as handled when session becomes active', () => {
      const sendClientEvent = jest.fn();
      
      render(<CitizenshipTestPanel {...defaultProps} sendClientEvent={sendClientEvent} isSessionActive={true} />);
      
      // Should not send session.update since functions are now server-side
      expect(sendClientEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.update'
        })
      );
    });

    it('logs that functions are defined server-side', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<CitizenshipTestPanel {...defaultProps} isSessionActive={true} />);
      
      expect(consoleSpy).toHaveBeenCalledWith('🔧 DEBUG: Session is active, functions are defined server-side');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Practice Question Function Calls', () => {
    beforeEach(() => {
      fetch.mockImplementation((url) => {
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
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });
    });

    it('handles practice question function call correctly', async () => {
      const events = [
        {
          type: 'response.done',
          response: {
            output: [{
              type: 'function_call',
              name: 'request_practice_question',
              arguments: JSON.stringify({
                question: 'What is the supreme law of the land?',
                category: 'Principles of Democracy'
              })
            }]
          }
        },
        { type: 'session.created' }
      ];

      render(<CitizenshipTestPanel {...defaultProps} events={events} />);

      await waitFor(() => {
        expect(screen.getByText('Question #1')).toBeInTheDocument();
        expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
        expect(screen.getByText('Principles of Democracy')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'What is the supreme law of the land?', limit: 1 })
      });
    });

    it('displays Show Answer button for practice questions', async () => {
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

      render(<CitizenshipTestPanel {...defaultProps} events={events} />);

      await waitFor(() => {
        expect(screen.getByText('Show Answer')).toBeInTheDocument();
      });
    });

    it('shows answer when Show Answer button is clicked', async () => {
      fetch.mockImplementation((url) => {
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
        return Promise.reject(new Error('Unknown URL'));
      });

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

      render(<CitizenshipTestPanel {...defaultProps} events={events} />);

      await waitFor(() => {
        expect(screen.getByText('Show Answer')).toBeInTheDocument();
      });

      const showAnswerButton = screen.getByText('Show Answer');
      fireEvent.click(showAnswerButton);

      await waitFor(() => {
        expect(screen.getByText('Answer:')).toBeInTheDocument();
        expect(screen.getByText('the Constitution')).toBeInTheDocument();
      });
    });
  });

  describe('Pause/Resume State Management', () => {
    it('clears function call output when transitioning from paused to active', () => {
      // First render with practice question displayed
      const eventsWithPracticeQuestion = [
        { type: 'session.created' },
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
        }
      ];

      const { rerender } = render(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={eventsWithPracticeQuestion} 
          isPaused={false} 
        />
      );

      // Simulate pause
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={eventsWithPracticeQuestion} 
          isPaused={true} 
        />
      );

      // Simulate resume - should clear practice question
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={eventsWithPracticeQuestion} 
          isPaused={false} 
        />
      );

      // Should show default state after resume
      expect(screen.getByText('Ask me anything about the US citizenship test!')).toBeInTheDocument();
    });

    it('resets functionAdded flag when resuming from pause', () => {
      const sendClientEvent = jest.fn();
      
      // Start with session active and functions marked as handled
      const { rerender } = render(
        <CitizenshipTestPanel 
          {...defaultProps} 
          sendClientEvent={sendClientEvent}
          events={[{ type: 'session.created' }]} 
          isPaused={false} 
        />
      );

      // Should not send session.update since functions are server-side
      expect(sendClientEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.update'
        })
      );

      // Simulate pause
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          sendClientEvent={sendClientEvent}
          events={[{ type: 'session.created' }]} 
          isPaused={true} 
        />
      );

      // Simulate resume - functionAdded flag should reset to false then true
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          sendClientEvent={sendClientEvent}
          events={[{ type: 'session.created' }]} 
          isPaused={false} 
        />
      );

      // Should still not send session.update after resume since functions are server-side
      expect(sendClientEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.update'
        })
      );
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      fetch.mockImplementation((url) => {
        if (url === '/search') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              results: [
                {
                  metadata: {
                    question: 'What is the supreme law of the land?',
                    answer: 'the Constitution'
                  }
                }
              ]
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
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });
    });

    it('performs search when search button is clicked', async () => {
      const sendTextMessage = jest.fn();
      
      render(<CitizenshipTestPanel {...defaultProps} sendTextMessage={sendTextMessage} />);

      const searchInput = screen.getByPlaceholderText('Search citizenship topics...');
      const searchButton = screen.getByRole('button', { name: /search/i });

      // Type in search input
      fireEvent.change(searchInput, { target: { value: 'constitution' } });
      fireEvent.click(searchButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'constitution', limit: 3 })
        });
      }, { timeout: 3000 });

      // Wait for the message to be sent
      await waitFor(() => {
        expect(sendTextMessage).toHaveBeenCalledWith(
          expect.stringContaining('Here are the top citizenship questions related to "constitution"')
        );
      }, { timeout: 3000 });
    }, 10000);

    it('performs search when Enter key is pressed', async () => {
      const sendTextMessage = jest.fn();
      render(<CitizenshipTestPanel {...defaultProps} sendTextMessage={sendTextMessage} />);

      const searchInput = screen.getByPlaceholderText('Search citizenship topics...');

      // Simulate typing and Enter key
      fireEvent.change(searchInput, { target: { value: 'constitution' } });
      fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'constitution', limit: 3 })
        });
      }, { timeout: 3000 });
    }, 10000);

    it('does not search with empty query', async () => {
      // Clear any previous fetch calls
      fetch.mockClear();
      
      render(<CitizenshipTestPanel {...defaultProps} />);

      // Let the component initialize and make its initial /search/info call
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/search/info');
      });
      
      // Clear the initial call
      fetch.mockClear();

      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);

      // Should not make any search calls with empty query
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Timer Management', () => {
    beforeEach(() => {
      // Ensure fresh fetch mock for timer tests
      fetch.mockImplementation((url) => {
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
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });
    });

    it('sets practice question timer after function call', async () => {
      const sendClientEvent = jest.fn();
      const events = [
        { type: 'session.created' },
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
        }
      ];

      render(<CitizenshipTestPanel {...defaultProps} sendClientEvent={sendClientEvent} events={events} />);

      // Wait for the practice question to be processed and timer set
      await waitFor(() => {
        expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
      });

      // Clear the initial session setup call
      sendClientEvent.mockClear();

      // Fast-forward 20 seconds to trigger the timer
      jest.advanceTimersByTime(20000);

      await waitFor(() => {
        expect(sendClientEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'response.create',
            response: expect.objectContaining({
              instructions: expect.stringContaining('Gently check in with the user')
            })
          })
        );
      });
    });

    it('clears timer on user activity', () => {
      const sendClientEvent = jest.fn();
      const { rerender } = render(
        <CitizenshipTestPanel 
          {...defaultProps} 
          sendClientEvent={sendClientEvent}
          events={[
            { type: 'session.created' },
            {
              type: 'response.done',
              response: {
                output: [{
                  type: 'function_call',
                  name: 'request_practice_question',
                  arguments: JSON.stringify({ question: 'Test question?' })
                }]
              }
            }
          ]} 
        />
      );

      sendClientEvent.mockClear();

      // Simulate user activity
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          sendClientEvent={sendClientEvent}
          events={[
            { type: 'input_audio_buffer.speech_started' },
            { type: 'session.created' },
            {
              type: 'response.done',
              response: {
                output: [{
                  type: 'function_call',
                  name: 'request_practice_question',
                  arguments: JSON.stringify({ question: 'Test question?' })
                }]
              }
            }
          ]} 
        />
      );

      // Fast-forward 20 seconds - timer should not fire
      jest.advanceTimersByTime(20000);

      expect(sendClientEvent).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles database search errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Database error'));
      
      const events = [
        { type: 'session.created' },
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
        }
      ];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<CitizenshipTestPanel {...defaultProps} events={events} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error matching spoken question to database:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('handles malformed function call arguments', async () => {
      const events = [
        { type: 'session.created' },
        {
          type: 'response.done',
          response: {
            output: [{
              type: 'function_call',
              name: 'request_practice_question',
              arguments: 'invalid json'
            }]
          }
        }
      ];

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<CitizenshipTestPanel {...defaultProps} events={events} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});