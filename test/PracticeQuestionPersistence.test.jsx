
import { render, screen, waitFor, act } from '@testing-library/react';
import CitizenshipTestPanel from '../client/components/CitizenshipTestPanel.jsx';

// Test specifically for practice question persistence during pause/resume
describe('Practice Question Sidebar Persistence', () => {
  const defaultProps = {
    isSessionActive: true,
    sendClientEvent: jest.fn(),
    events: [],
    sendTextMessage: jest.fn(),
    isPaused: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock fetch for database operations
    global.fetch = jest.fn((url, options) => {
      if (url === '/search' && options.method === 'POST') {
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
      
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
  });

  it('should display practice question in sidebar after function call', async () => {
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

    // Wait for the practice question to appear
    await waitFor(() => {
      expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
      expect(screen.getByText('Question #1')).toBeInTheDocument();
      expect(screen.getByText('Principles of Democracy')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should PRESERVE practice question in sidebar during pause/resume cycle', async () => {
    // Step 1: Setup with practice question displayed
    const eventsWithPracticeQuestion = [
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

    const { rerender } = render(
      <CitizenshipTestPanel 
        {...defaultProps} 
        events={eventsWithPracticeQuestion} 
        isPaused={false} 
      />
    );

    // Wait for practice question to appear initially
    await waitFor(() => {
      expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
    });

    // Step 2: Simulate pause
    await act(async () => {
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={eventsWithPracticeQuestion} 
          isPaused={true} 
        />
      );
    });

    // Practice question should still be visible during pause
    expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
    expect(screen.getByText('Question #1')).toBeInTheDocument();

    // Step 3: Simulate resume
    await act(async () => {
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={eventsWithPracticeQuestion} 
          isPaused={false} 
        />
      );
    });

    // CRITICAL TEST: Practice question should STILL be visible after resume
    await waitFor(() => {
      expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
      expect(screen.getByText('Question #1')).toBeInTheDocument();
      expect(screen.getByText('Principles of Democracy')).toBeInTheDocument();
    }, { timeout: 1000 });

    // The Show Answer button should still work
    expect(screen.getByText('Show Answer')).toBeInTheDocument();
  });

  it('should demonstrate the current BUG: practice question disappears after resume', async () => {
    // This test documents the current broken behavior
    const eventsWithPracticeQuestion = [
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

    const { rerender } = render(
      <CitizenshipTestPanel 
        {...defaultProps} 
        events={eventsWithPracticeQuestion} 
        isPaused={false} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('What is the supreme law of the land?')).toBeInTheDocument();
    });

    // Pause then resume
    rerender(
      <CitizenshipTestPanel 
        {...defaultProps} 
        events={eventsWithPracticeQuestion} 
        isPaused={true} 
      />
    );

    await act(async () => {
      rerender(
        <CitizenshipTestPanel 
          {...defaultProps} 
          events={eventsWithPracticeQuestion} 
          isPaused={false} 
        />
      );
    });

    // Current behavior: Practice question disappears (this should be fixed)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('=== DEBUG: Current HTML after resume ===');
    console.log(document.body.innerHTML);
    
    const practiceQuestion = screen.queryByText('What is the supreme law of the land?');
    if (practiceQuestion) {
      console.log('✅ Practice question found after resume');
    } else {
      console.log('❌ Practice question MISSING after resume - THIS IS THE BUG');
    }
  });
});